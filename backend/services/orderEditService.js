const Order = require('../models/Order');
const Address = require('../models/Address');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Discount = require('../models/Discount');
const UserFreeCash = require('../models/UserFreeCash');
const OrderReturn = require('../models/OrderReturn');
const OrderExchange = require('../models/OrderExchange');
const common = require('../utils/common');
const logger = require('../utils/logger');
const adminPlaceOrderService = require('./adminPlaceOrderService');
const taxCalculationService = require('./taxCalculationService');
const commissionService = require('./commissionService');
const invoiceService = require('./invoiceService');
const orderService = require('./orderService');
const cartService = require('./cartService');
const currencyService = require('./currencyService');
const discountUsageService = require('./discountUsageService');
const { ORDER_NOTIFICATION_TYPES } = require('../constants/orderRealtimeConstants');
const { CLOSED_STEP_CODES } = require('../constants/orderStepConstants');
const orderStepService = require('./orderStepService');
const { notifyOrderChanged } = require('./orderRealtimeService');
const lowStockAlertService = require('./lowStockAlertService');
const internationalPrice = require('../utils/internationalPrice');

const round2 = (value) => Math.round(value * 100) / 100;

// An order stops being editable once it is finalized, cancelled or rejected,
// and once a payment has been taken (the total would no longer match what was
// paid). Same rule as editing an order's shipping price.

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

// An order placed with international prices keeps using them for added
// products (utils/internationalPrice.js), at its locked rate.
const orderPriceZone = (order) => (order.isInternationalPrice
    ? { isInternational: true, exchangeRate: order.exchangeRate || 1 }
    : internationalPrice.LOCAL_PRICE_ZONE);

// Loads an order that can still be edited, plus the lines already on it.
// Orders placed before Order.items existed keep their lines only on the linked
// cart (legacyItems) - those are saved onto the order with the first addition.
const loadEditableOrder = async (vendorId, orderId) => {
    try {
        const order = await Order.findOne({ _id: orderId, vendorId, status: { $ne: 'D' } });
        if (!order) {
            return common.returnResult(false, 404, 'Order not found.');
        }
        if (!orderStepService.isOrderActive(order) || order.cancelledAt) {
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
        const lineResult = await adminPlaceOrderService.resolveOrderLines(vendorId, items, true, bulkPricingResult.meta.isBulkPricingOn, orderPriceZone(order));
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

        const allowOutOfStock = adminPlaceOrderService.isOutOfStockAllowedForAdmin(companySettingsData);
        const bulkPricingResult = await adminPlaceOrderService.resolveApplyBulkPricing(vendorId, applyBulkPricing, websiteMasterData, companyMasterData);
        if (!bulkPricingResult.isSuccess) {
            return common.returnResult(false, bulkPricingResult.statusCode, bulkPricingResult.message);
        }

        const lineResult = await adminPlaceOrderService.resolveOrderLines(vendorId, items, allowOutOfStock, bulkPricingResult.meta.isBulkPricingOn, orderPriceZone(order));
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
        const stockChanges = [];
        for (const line of lines) {
            const deducted = await adminPlaceOrderService.deductStockForLine(line, allowOutOfStock, stockChanges);
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
                    isFinalized: { $ne: true },
                    currentStepCode: { $nin: CLOSED_STEP_CODES },
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

        // Emails the vendor about any size the added products just made low on stock.
        lowStockAlertService.sendLowStockAlertInBackground({
            vendorId, stockChanges, websiteMasterData, companyMasterData, companySettingsData, userId: adminUserId
        });

        await commissionService.syncCommissionForOrder(updated);
        await invoiceService.tryRefreshInvoiceForOrder(updated, { companySettingsData });
        notifyOrderChanged(updated, ORDER_NOTIFICATION_TYPES.ITEMS_UPDATED);

        logger.logInfo(1, 0, 'Products added to order', { vendorId, orderId, addedLines: newItems.length, addedTotal });
        return common.returnResult(true, 200, 'Products added to the order successfully', { order: updated });
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| CHANGE QUANTITIES / REMOVE PRODUCTS ON A PLACED ORDER
|--------------------------------------------------------------------------
| The admin sends the lines to change as [{ productId, variantId, sizeId,
| quantity }] - quantity 0 removes the line.
|   Increase : the whole line is re-priced at today's price (or its bulk tier
|              price when "Apply Bulk Pricing" is ticked) and re-taxed; stock
|              is taken for the extra units only. Going over the stock is the
|              admin's own switch (allowOutOfStockProductsAddingForAdmin).
|   Decrease : the line keeps the price and tax rates saved on the order; the
|              units taken off go back into stock.
|   Remove   : the line leaves the order and its stock goes back. An order
|              always keeps at least one product.
| A line that was changed holds its own stock from then on
| (stockDeductedQuantity), also when it came from the customer's cart - see
| orderService.restoreStockForCancelledOrder. The cart copy of the line is
| kept in step, because returns and exchanges read their items from it.
|
| Discounts and Free Cash: whenever something is reduced or removed, the ones
| the customer used are re-checked against the order as it now stands. One
| that still qualifies stays (never for more than before); one that no longer
| does comes off the order and is given back to the customer to use again.
| Shipping is left alone, like when products are added.
|
| planOrderItemChanges works everything out without writing anything (it is
| also the live preview); updateOrderItems then saves it with ONE conditional
| write on the order, so an order that changed in the meantime is never touched.
*/
const toPlainItem = (item) => {
    try {
        return item && typeof item.toObject === 'function' ? item.toObject() : { ...item };
    } catch (err) {
        throw err;
    }
};

const orderLineLabel = (line) => {
    try {
        return `"${line.productName}" - ${line.variantName} - ${line.sizeName}`;
    } catch (err) {
        throw err;
    }
};

// The stock a line is holding: its own stockDeductedQuantity, or - for a
// line still held through the customer's cart - its full quantity.
const heldStockOf = (line) => {
    try {
        return line.stockDeductedQuantity === null || line.stockDeductedQuantity === undefined
            ? line.quantity
            : line.stockDeductedQuantity;
    } catch (err) {
        throw err;
    }
};

const isManualTaxLine = (line) => {
    try {
        return (line.taxBreakdown || []).some((tax) => !tax.taxId && tax.taxName === taxCalculationService.MANUAL_TAX_NAME);
    } catch (err) {
        throw err;
    }
};

// The taxes saved on a line, scaled to its new amount (same rates).
const scaleTaxBreakdown = (taxBreakdown, ratio, roundMoney) => {
    try {
        return (taxBreakdown || []).map((tax) => ({
            taxId: tax.taxId || null,
            taxName: tax.taxName,
            taxRate: tax.taxRate,
            taxAmount: roundMoney(tax.taxAmount * ratio)
        }));
    } catch (err) {
        throw err;
    }
};

const readSizeStock = async (line) => {
    try {
        const product = await Product.findOne({ _id: line.productId }).select('variants').lean();
        const variant = product?.variants?.find((v) => v._id.toString() === line.variantId.toString());
        const size = variant?.sizes?.find((s) => s._id.toString() === line.sizeId.toString());
        return size ? Math.max(0, size.stock || 0) : 0;
    } catch (err) {
        throw err;
    }
};

// A line with a return or exchange request open on it can't be changed - the
// request was raised against the quantity and price it has now.
const findLineUnderReturnOrExchange = async (vendorId, orderId, edits) => {
    try {
        const closedStatuses = ['REJECTED', 'CANCELLED'];
        const [returns, exchanges] = await Promise.all([
            OrderReturn.find({ vendorId, orderId, status: { $ne: 'D' }, returnStatus: { $nin: closedStatuses } }).select('items').lean(),
            OrderExchange.find({ vendorId, orderId, status: { $ne: 'D' }, exchangeStatus: { $nin: closedStatuses } }).select('items').lean()
        ]);
        const requestedKeys = new Set([...returns, ...exchanges].flatMap((request) => (request.items || []).map((item) => cartService.orderLineKey(item))));
        return edits.find((edit) => requestedKeys.has(edit.key)) || null;
    } catch (err) {
        throw err;
    }
};

const findCartSizeEntry = (cart, line) => {
    try {
        const productEntry = cart.products.find((p) => p.productId.toString() === line.productId.toString());
        const variantEntry = productEntry?.variants.find((v) => v.variantId.toString() === line.variantId.toString());
        const sizeEntry = variantEntry?.sizes.find((s) => s.sizeId.toString() === line.sizeId.toString());
        return sizeEntry && sizeEntry.isCheckedOut ? sizeEntry : null;
    } catch (err) {
        throw err;
    }
};

// Re-checks the discounts and Free Cash the customer used on this order
// against its lines after the edit (storeLines: store currency, the one
// promotions are worked out in). Only what depends on the items is checked -
// who may use it, usage limits and dates were settled when the order was
// placed. Nothing is ever raised above what it was. Writes nothing.
const recheckOrderPromotions = async (vendorId, order, cart, storeLines) => {
    try {
        const formatMoney = (amount) => String(amount);
        const previousDiscounts = (cart.discounts || []).map(toPlainItem);
        const previousFreeCash = (cart.freeCash || []).map(toPlainItem);
        const subtotal = storeLines.reduce((sum, line) => sum + line.amount, 0);

        // --- Discounts ---
        const discountDocs = previousDiscounts.length > 0
            ? await Discount.find({ _id: { $in: previousDiscounts.map((d) => d.discountId) }, vendorId })
            : [];
        const discountById = new Map(discountDocs.map((d) => [d._id.toString(), d]));
        const ctx = await cartService.buildDiscountContext({
            vendorId, userId: order.userId, discounts: discountDocs, lines: storeLines, freeCashAmount: cart.totalFreeCashAmount, formatMoney
        });

        const discounts = [];
        const discountChanges = [];
        for (const previous of previousDiscounts) {
            const discount = discountById.get(previous.discountId.toString());
            // A discount that no longer exists can't be re-checked - it stays as it was.
            const result = discount ? cartService.resolveDiscountCartCriteria(discount, ctx) : { eligible: true, discountAmount: previous.discountAmount };
            const newAmount = result.eligible ? Math.min(result.discountAmount, previous.discountAmount) : 0;
            if (newAmount > 0) {
                discounts.push({ ...previous, discountAmount: newAmount });
            }
            if (newAmount !== previous.discountAmount) {
                discountChanges.push({ discountId: previous.discountId, name: previous.discountName, previousAmount: previous.discountAmount, newAmount });
            }
        }
        const totalDiscountAmount = cartService.sumAppliedDiscounts(discounts, subtotal);

        // --- Free Cash, against what the discounts leave ---
        let freeCash = [];
        const freeCashChanges = [];
        if (previousFreeCash.length > 0) {
            const grants = await UserFreeCash.find({ _id: { $in: previousFreeCash.map((f) => f.userFreeCashId) }, vendorId }).populate('freeCashId');
            const grantById = new Map(grants.map((grant) => [grant._id.toString(), grant]));
            // Each one can take off at most what it already took off this order.
            const grantMap = new Map();
            for (const previous of previousFreeCash) {
                const grant = grantById.get(previous.userFreeCashId.toString());
                if (!grant || !grant.freeCashId) continue;
                grantMap.set(grant.freeCashId._id.toString(), { _id: grant._id, remainingAmount: previous.amountApplied, freeCashId: grant.freeCashId });
            }

            ({ applied: freeCash } = cartService.allocateFreeCash({
                freeCashIds: previousFreeCash.map((f) => f.freeCashId),
                grantMap,
                lines: storeLines,
                productCategoryMap: ctx.productCategoryMap,
                discounts,
                totalDiscountAmount,
                multipleAllowed: true,
                formatMoney
            }));

            for (const previous of previousFreeCash) {
                const kept = freeCash.find((f) => f.userFreeCashId.toString() === previous.userFreeCashId.toString());
                const newAmount = kept ? kept.amountApplied : 0;
                if (newAmount !== previous.amountApplied) {
                    freeCashChanges.push({ userFreeCashId: previous.userFreeCashId, name: previous.freeCashName, previousAmount: previous.amountApplied, newAmount });
                }
            }
        }

        return {
            discounts,
            totalDiscountAmount,
            discountChanges,
            freeCash,
            totalFreeCashAmount: cartService.sumAppliedFreeCash(freeCash),
            freeCashChanges
        };
    } catch (err) {
        throw err;
    }
};

// Works out an edit of the order's own lines without writing anything.
const planOrderItemChanges = async (vendorId, orderId, payload, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const { items: requested, applyBulkPricing } = payload;
        const orderResult = await loadEditableOrder(vendorId, orderId);
        if (!orderResult.isSuccess) {
            return orderResult;
        }
        const { order, existingLines, orderIsUntaxed } = orderResult.meta;
        const { exchangeRate, decimalPlaces } = orderRateFields(order);
        const factor = 10 ** decimalPlaces;
        const roundMoney = (value) => Math.round(value * factor) / factor;

        const currentLines = existingLines.map(toPlainItem);
        const requestedByKey = new Map();
        for (const item of requested) {
            const key = cartService.orderLineKey(item);
            if (requestedByKey.has(key)) {
                return common.returnResult(false, 400, 'The same product, variant and size is listed more than once.');
            }
            requestedByKey.set(key, item);
        }
        const currentKeys = new Set(currentLines.map((line) => cartService.orderLineKey(line)));
        if ([...requestedByKey.keys()].some((key) => !currentKeys.has(key))) {
            return common.returnResult(false, 400, 'One of these products is no longer on the order. Please reopen the order and try again.');
        }

        // Only the lines whose quantity really changes.
        const edits = [];
        for (const line of currentLines) {
            const key = cartService.orderLineKey(line);
            const item = requestedByKey.get(key);
            if (!item || item.quantity === line.quantity) continue;
            const type = item.quantity === 0 ? 'REMOVE' : (item.quantity > line.quantity ? 'INCREASE' : 'DECREASE');
            edits.push({ key, line, type, newQuantity: item.quantity, priced: null });
        }
        if (edits.length === 0) {
            return common.returnResult(false, 400, 'Nothing has been changed on this order.');
        }
        if (edits.filter((edit) => edit.type === 'REMOVE').length >= currentLines.length) {
            return common.returnResult(false, 400, 'An order must keep at least one product. To drop the whole order, reject it instead.');
        }

        const lockedEdit = await findLineUnderReturnOrExchange(vendorId, order._id, edits);
        if (lockedEdit) {
            return common.returnResult(false, 409, `${orderLineLabel(lockedEdit.line)} has a return or exchange request, so it can no longer be changed.`);
        }

        // --- Increases: today's price and tax for the whole line, stock for the extra units ---
        const allowOutOfStock = adminPlaceOrderService.isOutOfStockAllowedForAdmin(companySettingsData);
        const increases = edits.filter((edit) => edit.type === 'INCREASE');
        const warnings = [];
        if (increases.length > 0) {
            const bulkPricingResult = await adminPlaceOrderService.resolveApplyBulkPricing(vendorId, applyBulkPricing, websiteMasterData, companyMasterData);
            if (!bulkPricingResult.isSuccess) {
                return common.returnResult(false, bulkPricingResult.statusCode, bulkPricingResult.message);
            }

            // Stock is checked below against the extra units only, not the whole line.
            const lineResult = await adminPlaceOrderService.resolveOrderLines(
                vendorId,
                increases.map((edit) => ({ productId: edit.line.productId, variantId: edit.line.variantId, sizeId: edit.line.sizeId, quantity: edit.newQuantity })),
                true,
                bulkPricingResult.meta.isBulkPricingOn,
                orderPriceZone(order)
            );
            if (lineResult.error) {
                return common.returnResult(false, 400, lineResult.error);
            }

            for (const [index, edit] of increases.entries()) {
                edit.priced = lineResult.lines[index];
                // Kept before the line is converted into the order's currency (the cart copy stays in the store's).
                edit.storeUnitPrice = edit.priced.unitPrice;
                edit.storeAmount = edit.priced.amount;

                const extra = edit.newQuantity - edit.line.quantity;
                const available = await readSizeStock(edit.line);
                if (extra > available) {
                    if (!allowOutOfStock) {
                        return common.returnResult(false, 400, available > 0
                            ? `${orderLineLabel(edit.line)} has only ${available} more in stock.`
                            : `${orderLineLabel(edit.line)} has no more stock.`);
                    }
                    warnings.push(`${orderLineLabel(edit.line)}: only ${available} of the ${extra} extra ${extra === 1 ? 'unit is' : 'units are'} in stock.`);
                }
            }

            const taxLocation = await resolveTaxLocation(order, companySettingsData);
            await adminPlaceOrderService.priceAdminOrderLines({
                lines: lineResult.lines, taxLocation, isTaxOff: orderIsUntaxed, isTaxManual: false, exchangeRate, decimalPlaces
            });
        }

        // --- The order's lines after the edit ---
        const editByKey = new Map(edits.map((edit) => [edit.key, edit]));
        const newItems = [];
        const stockTakes = [];
        const stockReturns = [];
        const changedLines = [];
        let subtotalDelta = 0;
        let taxDelta = 0;
        let hasReduction = false;

        for (const line of currentLines) {
            const edit = editByKey.get(cartService.orderLineKey(line));
            if (!edit) {
                newItems.push(line);
                continue;
            }
            const held = heldStockOf(line);
            const lineIds = { productId: line.productId, variantId: line.variantId, sizeId: line.sizeId };
            const previousTax = line.lineTaxAmount || 0;

            if (edit.type === 'REMOVE') {
                hasReduction = true;
                stockReturns.push({ ...lineIds, deducted: held });
                subtotalDelta -= line.lineAmount;
                taxDelta -= previousTax;
                changedLines.push({ ...lineIds, previousQuantity: line.quantity, quantity: 0, unitPrice: line.unitPrice, lineAmount: 0, lineTaxAmount: 0, isRemoved: true });
                continue;
            }

            let updated;
            if (edit.type === 'DECREASE') {
                hasReduction = true;
                const taxBreakdown = scaleTaxBreakdown(line.taxBreakdown, edit.newQuantity / line.quantity, roundMoney);
                const heldAfter = Math.min(held, edit.newQuantity);
                updated = {
                    ...line,
                    quantity: edit.newQuantity,
                    lineAmount: roundMoney(line.unitPrice * edit.newQuantity),
                    taxBreakdown,
                    lineTaxAmount: roundMoney(taxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0)),
                    stockDeductedQuantity: heldAfter
                };
                stockReturns.push({ ...lineIds, deducted: held - heldAfter });
            } else {
                const priced = edit.priced;
                // A tax the admin typed in for this line keeps its rate; otherwise today's taxes apply.
                const taxBreakdown = isManualTaxLine(line) && line.lineAmount > 0 && !orderIsUntaxed
                    ? scaleTaxBreakdown(line.taxBreakdown, priced.amount / line.lineAmount, roundMoney)
                    : priced.taxBreakdown;
                updated = {
                    ...line,
                    unitPrice: priced.unitPrice,
                    quantity: edit.newQuantity,
                    lineAmount: priced.amount,
                    taxBreakdown,
                    lineTaxAmount: roundMoney(taxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0)),
                    // The extra units actually taken are added when the edit is saved.
                    stockDeductedQuantity: held
                };
                stockTakes.push({ ...lineIds, itemIndex: newItems.length, quantity: edit.newQuantity - line.quantity, productName: line.productName, variantName: line.variantName, sizeName: line.sizeName });
            }

            subtotalDelta += updated.lineAmount - line.lineAmount;
            taxDelta += updated.lineTaxAmount - previousTax;
            changedLines.push({ ...lineIds, previousQuantity: line.quantity, quantity: updated.quantity, unitPrice: updated.unitPrice, lineAmount: updated.lineAmount, lineTaxAmount: updated.lineTaxAmount, isRemoved: false });
            newItems.push(updated);
        }

        const subtotal = Math.max(0, roundMoney(order.subtotal + subtotalDelta));
        const totalTaxAmount = Math.max(0, roundMoney((order.totalTaxAmount || 0) + taxDelta));

        // --- Discounts and Free Cash the customer used: re-checked when something was reduced ---
        const cart = order.cartId ? await Cart.findById(order.cartId) : null;
        let promotions = null;
        const hasPromotions = !!cart && ((cart.discounts || []).length > 0 || (cart.freeCash || []).length > 0);
        if (hasReduction && hasPromotions && order.userId) {
            const storeLines = newItems.map((item) => {
                const edit = editByKey.get(cartService.orderLineKey(item));
                return {
                    productId: item.productId,
                    productName: item.productName,
                    variantId: item.variantId,
                    sizeId: item.sizeId,
                    quantity: item.quantity,
                    amount: edit && edit.type === 'INCREASE' ? edit.storeAmount : round2(item.lineAmount / exchangeRate)
                };
            });
            promotions = await recheckOrderPromotions(vendorId, order, cart, storeLines);
        }

        const toOrderCurrency = (amount) => currencyService.convertAmount(amount, exchangeRate, decimalPlaces);
        const discountChanged = !!promotions && promotions.discountChanges.length > 0;
        const freeCashChanged = !!promotions && promotions.freeCashChanges.length > 0;
        // Never more than the products are now worth (an admin's own discount on a Place Order sale included).
        const totalDiscountAmount = Math.min(discountChanged ? toOrderCurrency(promotions.totalDiscountAmount) : (order.totalDiscountAmount || 0), subtotal);
        const totalFreeCashAmount = Math.min(freeCashChanged ? toOrderCurrency(promotions.totalFreeCashAmount) : (order.totalFreeCashAmount || 0), roundMoney(subtotal - totalDiscountAmount));

        const previousDeductions = Math.min((order.totalDiscountAmount || 0) + (order.totalFreeCashAmount || 0), order.subtotal);
        const grandTotal = Math.max(0, roundMoney(
            order.grandTotal + (subtotal - order.subtotal) + (totalTaxAmount - (order.totalTaxAmount || 0)) - (totalDiscountAmount + totalFreeCashAmount - previousDeductions)
        ));

        const promotionChanges = promotions
            ? [
                ...promotions.discountChanges.map((change) => ({ type: 'DISCOUNT', ...change })),
                ...promotions.freeCashChanges.map((change) => ({ type: 'FREE_CASH', ...change }))
            ].map((change) => ({
                type: change.type,
                name: change.name,
                previousAmount: toOrderCurrency(change.previousAmount),
                newAmount: toOrderCurrency(change.newAmount),
                isRemoved: change.newAmount <= 0
            }))
            : [];
        if (!promotions && totalDiscountAmount < (order.totalDiscountAmount || 0)) {
            promotionChanges.push({ type: 'DISCOUNT', name: 'Discount', previousAmount: order.totalDiscountAmount, newAmount: totalDiscountAmount, isRemoved: totalDiscountAmount <= 0 });
        }

        return common.returnResult(true, 200, 'All Good', {
            order,
            cart,
            edits,
            newItems,
            stockTakes,
            stockReturns: stockReturns.filter((entry) => entry.deducted > 0),
            allowOutOfStock,
            promotions,
            totals: { subtotal, totalTaxAmount, totalDiscountAmount, totalFreeCashAmount, grandTotal },
            preview: {
                lines: changedLines,
                previous: {
                    subtotal: order.subtotal,
                    totalTaxAmount: order.totalTaxAmount || 0,
                    totalDiscountAmount: order.totalDiscountAmount || 0,
                    totalFreeCashAmount: order.totalFreeCashAmount || 0,
                    grandTotal: order.grandTotal
                },
                updated: { subtotal, totalTaxAmount, totalDiscountAmount, totalFreeCashAmount, grandTotal },
                promotionChanges,
                warnings
            }
        });
    } catch (err) {
        throw err;
    }
};

// Live preview of an edit to the order's own lines: the new line amounts and
// totals, any discount / Free Cash it would take off, and stock warnings.
const previewOrderItemChanges = async (vendorId, orderId, payload, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const planResult = await planOrderItemChanges(vendorId, orderId, payload, companyMasterData, websiteMasterData, companySettingsData);
        if (!planResult.isSuccess) {
            return planResult;
        }
        return common.returnResult(true, 200, 'Order changes calculated successfully', planResult.meta.preview);
    } catch (err) {
        throw err;
    }
};

// Keeps the customer's cart copy of the order in step with the edit: returns
// and exchanges read their items from it, and it is where the order's applied
// discounts / Free Cash are kept. A removed line is no longer checked out.
const syncCartAfterItemChanges = async (cart, edits, promotions, adminUserId) => {
    try {
        let changed = false;
        for (const edit of edits) {
            const sizeEntry = findCartSizeEntry(cart, edit.line);
            if (!sizeEntry) continue;
            changed = true;
            if (edit.type === 'REMOVE') {
                sizeEntry.isCheckedOut = false;
                continue;
            }
            sizeEntry.quantity = edit.newQuantity;
            if (edit.type === 'INCREASE') {
                sizeEntry.unitPrice = edit.storeUnitPrice;
            }
        }
        if (promotions && (promotions.discountChanges.length > 0 || promotions.freeCashChanges.length > 0)) {
            changed = true;
            cart.discounts = promotions.discounts;
            cart.totalDiscountAmount = promotions.totalDiscountAmount;
            cart.freeCash = promotions.freeCash;
            cart.totalFreeCashAmount = promotions.totalFreeCashAmount;
        }
        if (!changed) return;
        cart.updatedBy = adminUserId;
        await cart.save();
    } catch (err) {
        throw err;
    }
};

const updateOrderItems = async (vendorId, adminUserId, orderId, payload, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const planResult = await planOrderItemChanges(vendorId, orderId, payload, companyMasterData, websiteMasterData, companySettingsData);
        if (!planResult.isSuccess) {
            return planResult;
        }
        const { order, cart, edits, newItems, stockTakes, stockReturns, allowOutOfStock, promotions, totals, preview } = planResult.meta;

        // Take the stock for the extra units first; undo everything if any line loses a race.
        const deductions = [];
        const stockChanges = [];
        for (const take of stockTakes) {
            const deducted = await adminPlaceOrderService.deductStockForLine(take, allowOutOfStock, stockChanges);
            if (deducted === null) {
                await adminPlaceOrderService.restoreDeductedStock(deductions);
                return common.returnResult(false, 409, `${orderLineLabel(take)} just went out of stock. Please review and try again.`);
            }
            newItems[take.itemIndex].stockDeductedQuantity += deducted;
            deductions.push({ productId: take.productId, variantId: take.variantId, sizeId: take.sizeId, deducted });
        }

        const update = {
            items: newItems,
            subtotal: totals.subtotal,
            totalTaxAmount: totals.totalTaxAmount,
            totalDiscountAmount: totals.totalDiscountAmount,
            totalFreeCashAmount: totals.totalFreeCashAmount,
            grandTotal: totals.grandTotal,
            updatedBy: adminUserId
        };
        if (order.isPlacedByAdmin) {
            update.adminDiscountAmount = Math.min(order.adminDiscountAmount || 0, totals.totalDiscountAmount);
        }
        // An admin COD order records the amount due; keep it in step.
        if (order.payment && order.payment.amount === order.grandTotal) {
            update['payment.amount'] = totals.grandTotal;
        }

        let updated;
        try {
            updated = await Order.findOneAndUpdate(
                {
                    _id: orderId,
                    vendorId,
                    status: { $ne: 'D' },
                    isFinalized: { $ne: true },
                    currentStepCode: { $nin: CLOSED_STEP_CODES },
                    cancelledAt: null,
                    'payment.status': { $in: EDITABLE_PAYMENT_STATUSES },
                    // Nothing else touched the order between our read and this write.
                    updatedAt: order.updatedAt
                },
                { $set: update },
                { new: true }
            );
        } catch (err) {
            await adminPlaceOrderService.restoreDeductedStock(deductions);
            throw err;
        }

        if (!updated) {
            await adminPlaceOrderService.restoreDeductedStock(deductions);
            return common.returnResult(false, 409, 'This order was changed by someone else or can no longer be edited. Please reopen it and try again.');
        }

        // The order is saved - now give back the stock of what was taken off it.
        await adminPlaceOrderService.restoreDeductedStock(stockReturns);

        if (cart) {
            await syncCartAfterItemChanges(cart, edits, promotions, adminUserId);
        }
        if (promotions) {
            await discountUsageService.applyDiscountChangesForEditedOrder(vendorId, updated, promotions.discountChanges, adminUserId);
            await cartService.refundFreeCashForOrderEdit(
                vendorId,
                updated,
                promotions.freeCashChanges.map((change) => ({ userFreeCashId: change.userFreeCashId, amount: round2(change.previousAmount - change.newAmount) })),
                adminUserId, companyMasterData, websiteMasterData, companySettingsData
            );
        }

        // Emails the vendor about any size the extra units just made low on stock.
        lowStockAlertService.sendLowStockAlertInBackground({
            vendorId, stockChanges, websiteMasterData, companyMasterData, companySettingsData, userId: adminUserId
        });

        await commissionService.syncCommissionForOrder(updated);
        await invoiceService.tryRefreshInvoiceForOrder(updated, { companySettingsData });
        notifyOrderChanged(updated, ORDER_NOTIFICATION_TYPES.ITEMS_UPDATED);

        logger.logInfo(1, 0, 'Order items updated', { vendorId, orderId, changedLines: edits.length, grandTotal: totals.grandTotal });
        return common.returnResult(true, 200, 'Order updated successfully', {
            order: updated,
            promotionChanges: preview.promotionChanges,
            warnings: preview.warnings
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchCategoriesForEdit,
    fetchProductsForEdit,
    fetchProductOptionsForEdit,
    previewAddProductsTax,
    addProductsToOrder,
    previewOrderItemChanges,
    updateOrderItems
};
