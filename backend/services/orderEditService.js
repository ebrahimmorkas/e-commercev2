const Order = require('../models/Order');
const Address = require('../models/Address');
const common = require('../utils/common');
const logger = require('../utils/logger');
const adminPlaceOrderService = require('./adminPlaceOrderService');
const taxCalculationService = require('./taxCalculationService');
const commissionService = require('./commissionService');
const invoiceService = require('./invoiceService');
const orderService = require('./orderService');
const { ORDER_NOTIFICATION_TYPES } = require('../constants/orderRealtimeConstants');
const { RESERVED_STEP_CODES, TERMINAL_STEP_CODES } = require('../constants/orderStepConstants');
const { notifyOrderChanged } = require('./orderRealtimeService');

const round2 = (value) => Math.round(value * 100) / 100;

// An order stops being editable once it is finalized, cancelled or rejected,
// and once a payment has been taken (the total would no longer match what was
// paid). Same rule as editing an order's shipping price.
const EDIT_BLOCKED_STEP_CODES = [...TERMINAL_STEP_CODES, RESERVED_STEP_CODES.REJECTED];
const EDITABLE_PAYMENT_STATUSES = ['PENDING', 'FAILED'];

/*
|--------------------------------------------------------------------------
| PRODUCT PICKER DATA
|--------------------------------------------------------------------------
| The same category -> product -> variant -> size picker Place Order uses
| (adminPlaceOrderService), gated by isEditingOrderFeatureOn in the controller
| instead of the Place Order switch.
*/
const fetchCategoriesForEdit = async (vendorId) => {
    try {
        return await adminPlaceOrderService.loadCategories(vendorId);
    } catch (err) {
        throw err;
    }
};

const fetchProductsForEdit = async (vendorId, query) => {
    try {
        return await adminPlaceOrderService.loadActiveProducts(vendorId, query);
    } catch (err) {
        throw err;
    }
};

const fetchProductOptionsForEdit = async (vendorId, companySettingsData, productId) => {
    try {
        return await adminPlaceOrderService.loadProductOptions(vendorId, companySettingsData, productId);
    } catch (err) {
        throw err;
    }
};

// Where the order is going, for working out which taxes apply to the new
// lines - same rule as Place Order: its saved address if it still has one,
// otherwise (walk-in, typed-in address, no address) the store's own location.
const resolveTaxLocation = async (order, companySettingsData) => {
    try {
        let savedAddress = null;
        if (!order.isWalkInCustomer && order.shippingAddressId) {
            savedAddress = await Address.findById(order.shippingAddressId);
        }
        return adminPlaceOrderService.resolveAdminOrderTaxLocation({ savedAddress, companySettingsData });
    } catch (err) {
        throw err;
    }
};

// Added products convert from the store currency at the rate locked on the
// order when it was placed, so they match the lines already on it (orders
// from before multi-currency have rate 1).
const orderRateFields = (order) => ({
    exchangeRate: order.exchangeRate || 1,
    decimalPlaces: typeof order.currencyDecimalPlaces === 'number' ? order.currencyDecimalPlaces : 2
});

// Loads an order that can still be edited, plus the lines already on it.
// Orders placed before Order.items existed keep their lines only on the linked
// cart (legacyItems) - those are saved onto the order with the first addition.
const loadEditableOrder = async (vendorId, orderId) => {
    try {
        const order = await Order.findOne({ _id: orderId, vendorId, status: { $ne: 'D' } });
        if (!order) {
            return common.returnResult(false, 404, 'Order not found.');
        }
        if (EDIT_BLOCKED_STEP_CODES.includes(order.currentStepCode) || order.cancelledAt) {
            return common.returnResult(false, 400, 'This order has been finalized, cancelled or rejected and can no longer be edited.');
        }
        if (!EDITABLE_PAYMENT_STATUSES.includes(order.payment?.status || 'PENDING')) {
            return common.returnResult(false, 409, 'Payment has already been made for this order, so it can no longer be edited.');
        }

        const hasStoredItems = order.items && order.items.length > 0;
        const legacyItems = hasStoredItems ? [] : await orderService.deriveLegacyOrderItems(order);
        const existingLines = hasStoredItems ? order.items : legacyItems;
        // An order that was placed without tax (a walk-in sale with tax switched off) stays untaxed.
        const orderIsUntaxed = order.isWalkInCustomer && existingLines.every((item) => !(item.taxBreakdown || []).length);

        return common.returnResult(true, 200, 'All Good', { order, legacyItems, existingLines, orderIsUntaxed });
    } catch (err) {
        throw err;
    }
};

// Live preview of the auto-calculated tax on the products being added.
const previewAddProductsTax = async (vendorId, orderId, payload, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const { items, applyBulkPricing } = payload;
        const orderResult = await loadEditableOrder(vendorId, orderId);
        if (!orderResult.isSuccess) {
            return orderResult;
        }
        const { order, orderIsUntaxed } = orderResult.meta;

        const bulkPricingResult = await adminPlaceOrderService.resolveApplyBulkPricing(vendorId, applyBulkPricing, websiteMasterData, companyMasterData);
        if (!bulkPricingResult.isSuccess) {
            return common.returnResult(false, bulkPricingResult.statusCode, bulkPricingResult.message);
        }

        // Preview only - stock is re-checked (and reserved) when the products are added.
        const lineResult = await adminPlaceOrderService.resolveOrderLines(vendorId, items, true, bulkPricingResult.meta.isBulkPricingOn);
        if (lineResult.error) {
            return common.returnResult(false, 400, lineResult.error);
        }

        // Amounts come back in the order's own currency.
        const taxLocation = await resolveTaxLocation(order, companySettingsData);
        await adminPlaceOrderService.priceAdminOrderLines({
            lines: lineResult.lines, taxLocation, isTaxOff: orderIsUntaxed, isTaxManual: false, ...orderRateFields(order)
        });

        return common.returnResult(true, 200, 'Tax preview calculated successfully', adminPlaceOrderService.buildTaxPreview(lineResult.lines, taxLocation, orderIsUntaxed));
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| ADD PRODUCTS TO A PLACED ORDER
|--------------------------------------------------------------------------
| New lines are priced at the live size price and taxed like Place Order;
| stock is reserved for them (and given back if the order is cancelled).
| Subtotal, tax and grand total grow by exactly what was added - existing
| discounts and shipping are left alone (shipping can be changed with Edit
| Shipping Price). The order itself is updated in ONE conditional write, so an
| order that was paid / cancelled / finalized in the meantime is never changed.
*/
const addProductsToOrder = async (vendorId, adminUserId, orderId, payload, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const { items, applyBulkPricing, isTaxManual, manualTaxAmount } = payload;
        const orderResult = await loadEditableOrder(vendorId, orderId);
        if (!orderResult.isSuccess) {
            return orderResult;
        }
        // Once a product is added the order has its own items, which would hide
        // legacy cart-only lines - so they are saved onto the order together with the new ones.
        const { order, legacyItems, existingLines, orderIsUntaxed } = orderResult.meta;
        if (orderIsUntaxed && isTaxManual === true) {
            return common.returnResult(false, 400, 'This order was placed without tax, so tax cannot be entered for the added products.');
        }

        // The same product/variant/size can't appear twice on an order (returns and
        // exchanges are matched per line), so an item already on it can't be added again.
        const existingKeys = new Set(existingLines.map((item) => `${item.productId}:${item.variantId}:${item.sizeId}`));
        for (const item of items) {
            if (existingKeys.has(`${item.productId}:${item.variantId}:${item.sizeId}`)) {
                return common.returnResult(false, 400, 'One of these products is already on the order in that variant and size.');
            }
        }

        const allowOutOfStock = companySettingsData?.allowOutOfStockProductsAdding === true;
        const bulkPricingResult = await adminPlaceOrderService.resolveApplyBulkPricing(vendorId, applyBulkPricing, websiteMasterData, companyMasterData);
        if (!bulkPricingResult.isSuccess) {
            return common.returnResult(false, bulkPricingResult.statusCode, bulkPricingResult.message);
        }

        const lineResult = await adminPlaceOrderService.resolveOrderLines(vendorId, items, allowOutOfStock, bulkPricingResult.meta.isBulkPricingOn);
        if (lineResult.error) {
            return common.returnResult(false, 400, lineResult.error);
        }
        const lines = lineResult.lines;

        // Untaxed orders stay untaxed; otherwise the admin's typed total (in the
        // order's currency) or the location's taxes - lines priced in the order's currency.
        const taxLocation = await resolveTaxLocation(order, companySettingsData);
        await adminPlaceOrderService.priceAdminOrderLines({
            lines, taxLocation, isTaxOff: orderIsUntaxed, isTaxManual: isTaxManual === true, manualTaxAmount, ...orderRateFields(order)
        });

        // Reserve stock line by line; undo everything if any line loses a race.
        const deductions = [];
        for (const line of lines) {
            const deducted = await adminPlaceOrderService.deductStockForLine(line, allowOutOfStock);
            if (deducted === null) {
                await adminPlaceOrderService.restoreDeductedStock(deductions);
                return common.returnResult(false, 409, `"${line.productName}" - ${line.variantName} - ${line.sizeName} just went out of stock. Please review and try again.`);
            }
            line.stockDeductedQuantity = deducted;
            deductions.push({ productId: line.productId, variantId: line.variantId, sizeId: line.sizeId, deducted });
        }

        const newItems = lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            sizeId: line.sizeId,
            productName: line.productName,
            variantName: line.variantName,
            sizeName: line.sizeName,
            sku: line.sku,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineAmount: line.amount,
            taxBreakdown: line.taxBreakdown,
            lineTaxAmount: taxCalculationService.lineTaxAmount(line),
            stockDeductedQuantity: line.stockDeductedQuantity
        }));
        const addedSubtotal = round2(newItems.reduce((sum, item) => sum + item.lineAmount, 0));
        const addedTax = round2(newItems.reduce((sum, item) => sum + item.lineTaxAmount, 0));
        const addedTotal = round2(addedSubtotal + addedTax);

        let updated;
        try {
            updated = await Order.findOneAndUpdate(
                {
                    _id: orderId,
                    vendorId,
                    status: { $ne: 'D' },
                    currentStepCode: { $nin: EDIT_BLOCKED_STEP_CODES },
                    cancelledAt: null,
                    'payment.status': { $in: EDITABLE_PAYMENT_STATUSES },
                    // Nobody added the same line between our read and this write.
                    $nor: newItems.map((item) => ({ items: { $elemMatch: { productId: item.productId, variantId: item.variantId, sizeId: item.sizeId } } }))
                },
                [{
                    $set: {
                        // $literal so a product name starting with "$" is never read as an expression;
                        // $ifNull so an order with no items field can never turn into null.
                        items: { $concatArrays: [{ $ifNull: ['$items', []] }, { $literal: [...legacyItems, ...newItems] }] },
                        subtotal: { $round: [{ $add: ['$subtotal', addedSubtotal] }, 2] },
                        totalTaxAmount: { $round: [{ $add: ['$totalTaxAmount', addedTax] }, 2] },
                        // An admin COD order records the amount due; keep it in step.
                        'payment.amount': {
                            $cond: [
                                { $eq: ['$payment.amount', '$grandTotal'] },
                                { $round: [{ $add: ['$grandTotal', addedTotal] }, 2] },
                                '$payment.amount'
                            ]
                        },
                        grandTotal: { $round: [{ $add: ['$grandTotal', addedTotal] }, 2] },
                        updatedBy: adminUserId,
                        updatedAt: '$$NOW'
                    }
                }],
                { new: true, updatePipeline: true }
            );
        } catch (err) {
            await adminPlaceOrderService.restoreDeductedStock(deductions);
            throw err;
        }

        if (!updated) {
            // The order changed under us (paid, cancelled, finalized, or the same line added
            // concurrently) - give the stock back and report it.
            await adminPlaceOrderService.restoreDeductedStock(deductions);
            return common.returnResult(false, 409, 'This order was changed by someone else or can no longer be edited. Please reopen it and try again.');
        }

        await commissionService.syncCommissionForOrder(updated);
        await invoiceService.tryRefreshInvoiceForOrder(updated, { companySettingsData });
        notifyOrderChanged(updated, ORDER_NOTIFICATION_TYPES.ITEMS_UPDATED);

        logger.logInfo(1, 0, 'Products added to order', { vendorId, orderId, addedLines: newItems.length, addedTotal });
        return common.returnResult(true, 200, 'Products added to the order successfully', { order: updated });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchCategoriesForEdit,
    fetchProductsForEdit,
    fetchProductOptionsForEdit,
    previewAddProductsTax,
    addProductsToOrder
};
