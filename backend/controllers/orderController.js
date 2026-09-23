const orderService = require('../services/orderService');
const orderEditService = require('../services/orderEditService');
const invoiceService = require('../services/invoiceService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const encodeIfPresent = (id) => (id ? common.encodeId(id) : id);
const decodeIfPresent = (id) => (id ? common.decodeId(id) : id);

// Converts an Order mongoose doc (or plain object, e.g. after
// attachInvoiceInfo has mutated extra display-only fields onto it) into a
// response-safe object with every ObjectId field encoded via
// common.encodeId, including the nested statusHistory/items subdocuments.
const formatOrderForResponse = (orderDoc) => {
    if (!orderDoc) return orderDoc;
    const order = orderDoc.toObject ? orderDoc.toObject() : orderDoc;

    return {
        ...order,
        _id: encodeIfPresent(order._id),
        cartId: encodeIfPresent(order.cartId),
        vendorId: encodeIfPresent(order.vendorId),
        userId: encodeIfPresent(order.userId),
        orderStepMasterId: encodeIfPresent(order.orderStepMasterId),
        currentStepId: encodeIfPresent(order.currentStepId),
        currencyId: encodeIfPresent(order.currencyId),
        shippingAddressId: encodeIfPresent(order.shippingAddressId),
        billingAddressId: encodeIfPresent(order.billingAddressId),
        placedByAdminId: encodeIfPresent(order.placedByAdminId),
        assignedDeliveryAgentId: encodeIfPresent(order.assignedDeliveryAgentId),
        cancelledBy: encodeIfPresent(order.cancelledBy),
        createdBy: encodeIfPresent(order.createdBy),
        updatedBy: encodeIfPresent(order.updatedBy),
        deletedBy: encodeIfPresent(order.deletedBy),
        activeMarkedBy: encodeIfPresent(order.activeMarkedBy),
        inActiveMarkedBy: encodeIfPresent(order.inActiveMarkedBy),
        statusHistory: Array.isArray(order.statusHistory)
            ? order.statusHistory.map((entry) => ({
                ...entry,
                _id: encodeIfPresent(entry._id),
                stepId: encodeIfPresent(entry.stepId),
                changedBy: encodeIfPresent(entry.changedBy),
            }))
            : order.statusHistory,
        items: Array.isArray(order.items)
            ? order.items.map((item) => ({
                ...item,
                productId: encodeIfPresent(item.productId),
                variantId: encodeIfPresent(item.variantId),
                sizeId: encodeIfPresent(item.sizeId),
                taxBreakdown: Array.isArray(item.taxBreakdown)
                    ? item.taxBreakdown.map((tax) => ({ ...tax, taxId: encodeIfPresent(tax.taxId) }))
                    : item.taxBreakdown,
                // Not part of the base Order schema - added at read time by
                // orderService.enrichOrderItemsForDetail (live product image
                // + matching return/exchange lookup, single-order-detail
                // endpoints only).
                image: item.image
                    ? { ...item.image, imageAssetId: encodeIfPresent(item.image.imageAssetId) }
                    : item.image,
                returnId: item.returnId !== undefined ? encodeIfPresent(item.returnId) : item.returnId,
                exchangeId: item.exchangeId !== undefined ? encodeIfPresent(item.exchangeId) : item.exchangeId,
            }))
            : order.items,
    };
};

// ineligibleItems (cart lines that couldn't be checked out - see
// createOrderFromCart) carry the same productId/variantId/sizeId shape as
// order items.
const formatIneligibleItems = (items) => (Array.isArray(items)
    ? items.map((item) => ({
        ...item,
        productId: encodeIfPresent(item.productId),
        variantId: encodeIfPresent(item.variantId),
        sizeId: encodeIfPresent(item.sizeId),
    }))
    : items);

// fetchOrderStepOptions returns OrderStepMaster.steps[] subdocuments
// (display-only picker for advanceOrderStep, which is actually driven by
// stepCode not id) - encode their own subdocument id for consistency.
const formatOrderStepOptions = (steps) => (Array.isArray(steps)
    ? steps.map((step) => ({ ...step, _id: encodeIfPresent(step._id) }))
    : steps);

// Addresses returned inline on order-related endpoints (not through
// addressController's own formatter) - encode at least the address's own id
// so it round-trips back into updateOrderShippingAddress's addressId field.
const formatAddressForOrderResponse = (addressDoc) => {
    if (!addressDoc) return addressDoc;
    const address = addressDoc.toObject ? addressDoc.toObject() : addressDoc;
    return { ...address, _id: encodeIfPresent(address._id) };
};

// --- Edit-Order product/category picker (adminPlaceOrderService.js's
// loadCategories/loadActiveProducts/loadProductOptions, shared with
// adminPlaceOrderController.js's own Place Order picker) - these ids feed
// straight back into addProductsToOrder's items[].productId/variantId/sizeId
// and getEditOrderProducts' categoryId query filter, so they must be encoded
// here the same way, at the controller boundary, on both callers. ----------
const formatEditOrderCategory = (category) => ({ ...category, _id: encodeIfPresent(category._id), parent_category_id: encodeIfPresent(category.parent_category_id) });

const formatEditOrderProduct = (product) => ({
    ...product,
    _id: encodeIfPresent(product._id),
    mainCategory: encodeIfPresent(product.mainCategory),
    subCategory: encodeIfPresent(product.subCategory),
});

const formatEditOrderProductOptions = (meta) => ({
    ...meta,
    product: meta.product ? { ...meta.product, productId: encodeIfPresent(meta.product.productId) } : meta.product,
    variants: Array.isArray(meta.variants)
        ? meta.variants.map((variant) => ({
            ...variant,
            variantId: encodeIfPresent(variant.variantId),
            sizes: Array.isArray(variant.sizes)
                ? variant.sizes.map((size) => ({ ...size, sizeId: encodeIfPresent(size.sizeId) }))
                : variant.sizes,
        }))
        : meta.variants,
});

// Every handler must answer: a catch that only logs leaves the HTTP request open forever and the
// client's spinner never stops. (headersSent: a streamed response may already have started.)
const sendServerError = (res) => {
    if (res.headersSent) return;
    return common.sendError(res, 500, 'Something went wrong. Please try again.');
};

// Streams a generated invoice PDF as a download. Content-Disposition is exposed so a
// cross-origin frontend can read the filename.
const sendInvoicePdf = (res, { buffer, filename }) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(buffer);
};

// A customer may only download the invoice of one of their own orders; an admin, any order
// of the vendor. Both go through the same isPDFDownloadableFeatureOn gate (in the service).
const downloadInvoice = (isAdmin) => async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        // ?type=credit-note downloads the credit note of a cancelled order instead of the invoice.
        const type = req.query.type;
        if (type !== undefined && type !== 'credit-note') {
            return common.sendError(res, 400, "type must be 'credit-note' when given.");
        }

        const result = await invoiceService.getInvoicePdfForOrder(vendorId, id, isAdmin ? null : req.user._id, {
            companySettingsData: req.companySettingsData,
            companyMasterData: req.companyMasterData,
            websiteMasterData: req.websiteMasterData
        }, { document: type === 'credit-note' ? 'credit-note' : 'invoice' });
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return sendInvoicePdf(res, result.meta);
    } catch (error) {
        logger.logException('orderController: downloadInvoice - Exception while generating invoice', { vendorId, id, error });
        return common.sendError(res, 500, 'Could not generate the invoice. Please try again.');
    }
};

// What the order screens need to decide which invoice buttons to show. The feature flag is checked
// here (both master levels) so a screen never offers a download that would just be refused.
const attachInvoiceInfo = async (req, order) => {
    const featureCheck = await common.checkFeatureOnOrOff(
        req.vendorId, req.websiteMasterData, req.companyMasterData,
        'isPDFDownloadableFeatureOn', 'isPDFDownloadableFeatureOn'
    );
    const summary = await invoiceService.getInvoiceSummaryForOrder(req.vendorId, order._id);
    order.invoiceNumber = summary ? summary.invoiceNumber : null;
    order.invoiceStatus = summary ? summary.status : null;
    // An invoice can be downloaded when the feature is on and the order has one, or is invoiceable
    // (has stored line items and was not cancelled before an invoice was ever issued).
    order.invoiceDownloadable = featureCheck.isSuccess && (!!summary || (order.invoiceAvailable && !order.cancelledAt));
    order.creditNoteDownloadable = featureCheck.isSuccess && !!summary && !!summary.creditNoteNumber;
    return order;
};

const downloadMyInvoice = downloadInvoice(false);
const downloadInvoiceAdmin = downloadInvoice(true);

const createOrder = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user._id;

        const payload = {
            ...req.body,
            shippingAddressId: decodeIfPresent(req.body.shippingAddressId),
            billingAddressId: decodeIfPresent(req.body.billingAddressId),
        };

        const result = await orderService.createOrderFromCart(
            vendorId,
            userId,
            req.user.country || null,
            req.companyMasterData,
            req.websiteMasterData,
            req.companySettingsData,
            req.shippingPriceSettingsData,
            payload
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            order: formatOrderForResponse(result.meta.order),
            ineligibleItems: formatIneligibleItems(result.meta.ineligibleItems),
        });
    } catch (error) {
        logger.logException('orderController: createOrder - Exception while creating order', { vendorId, error });
        return sendServerError(res);
    }
};

const getMyOrders = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await orderService.fetchMyOrders(vendorId, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            orders: (result.meta.orders || []).map(formatOrderForResponse),
        });
    } catch (error) {
        logger.logException('orderController: getMyOrders - Exception while fetching orders', { vendorId, error });
        return sendServerError(res);
    }
};

// Customer-facing single-order view, gated behind the order-tracking
// feature (both WebsiteMaster and CompanyMaster must have it on).
const getMyOrderById = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const trackingFeatureCheck = await common.checkFeatureOnOrOff(
            vendorId, req.websiteMasterData, req.companyMasterData,
            'isOrderTrakingAllowed', 'isOrderTrakingAllowed'
        );
        if (!trackingFeatureCheck.isSuccess) {
            return common.sendError(res, trackingFeatureCheck.statusCode, trackingFeatureCheck.message);
        }

        const result = await orderService.fetchOrderById(vendorId, id, req.user._id, false);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        await attachInvoiceInfo(req, result.meta.order);
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            order: formatOrderForResponse(result.meta.order),
        });
    } catch (error) {
        logger.logException('orderController: getMyOrderById - Exception while fetching order', { vendorId, id, error });
        return sendServerError(res);
    }
};

const cancelOrder = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderService.cancelOrder(
            vendorId, req.user._id, id, req.body.cancellationReason, req.companySettingsData, req.companyMasterData, req.websiteMasterData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            order: formatOrderForResponse(result.meta.order),
        });
    } catch (error) {
        logger.logException('orderController: cancelOrder - Exception while cancelling order', { vendorId, id, error });
        return sendServerError(res);
    }
};

const getAllOrdersAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await orderService.fetchAllOrdersAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            orders: (result.meta.orders || []).map(formatOrderForResponse),
        });
    } catch (error) {
        logger.logException('orderController: getAllOrdersAdmin - Exception while fetching orders', { vendorId, error });
        return sendServerError(res);
    }
};

const getOrderByIdAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderService.fetchOrderById(vendorId, id, null, true);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        await attachInvoiceInfo(req, result.meta.order);
        // Both the platform-wide and the vendor's own gate must be on for the
        // admin UI to offer "Edit Shipping Price".
        const canEditShippingPrice = !!(req.websiteMasterData?.isEditingShippingPriceFeatureOn && req.companyMasterData?.isEditingShippingPriceFeatureOn);
        const canEditShippingAddress = !!(req.websiteMasterData?.[ADDRESS_EDIT_FLAG] && req.companyMasterData?.[ADDRESS_EDIT_FLAG]);
        const canEditOrder = !!(req.websiteMasterData?.[ORDER_EDIT_FLAG] && req.companyMasterData?.[ORDER_EDIT_FLAG]);
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            order: formatOrderForResponse(result.meta.order),
            canEditShippingPrice,
            canEditShippingAddress,
            canEditOrder,
        });
    } catch (error) {
        logger.logException('orderController: getOrderByIdAdmin - Exception while fetching order', { vendorId, id, error });
        return sendServerError(res);
    }
};

const getOrderStepOptions = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderService.fetchOrderStepOptions(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            steps: formatOrderStepOptions(result.meta.steps),
        });
    } catch (error) {
        logger.logException('orderController: getOrderStepOptions - Exception while fetching order steps', { vendorId, id, error });
        return sendServerError(res);
    }
};

const advanceOrderStep = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const { targetStepCode, remarks } = req.body;
        const result = await orderService.advanceOrderStep(
            vendorId, req.user._id, id, targetStepCode, remarks, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            order: formatOrderForResponse(result.meta.order),
        });
    } catch (error) {
        logger.logException('orderController: advanceOrderStep - Exception while advancing order step', { vendorId, id, error });
        return sendServerError(res);
    }
};

const setOrderShippingPrice = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderService.setOrderShippingPrice(vendorId, req.user._id, id, req.body.shippingAmount);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            order: formatOrderForResponse(result.meta.order),
        });
    } catch (error) {
        logger.logException('orderController: setOrderShippingPrice - Exception while adding order shipping price', { vendorId, id, error });
        return sendServerError(res);
    }
};

const updateOrderShippingPrice = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const validityResult = await common.checkFeatureOnOrOff(vendorId, req.websiteMasterData, req.companyMasterData, 'isEditingShippingPriceFeatureOn', 'isEditingShippingPriceFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await orderService.updateOrderShippingPrice(vendorId, req.user._id, id, req.body.shippingAmount);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            order: formatOrderForResponse(result.meta.order),
        });
    } catch (error) {
        logger.logException('orderController: updateOrderShippingPrice - Exception while updating order shipping price', { vendorId, id, error });
        return sendServerError(res);
    }
};

const ORDER_EDIT_FLAG = 'isEditingOrderFeatureOn';

// Shared by every Edit Order endpoint: both the platform-wide and the vendor's own gate must be on.
const checkOrderEditingOn = async (req) => {
    return common.checkFeatureOnOrOff(req.vendorId, req.websiteMasterData, req.companyMasterData, ORDER_EDIT_FLAG, ORDER_EDIT_FLAG);
};

const getEditOrderCategories = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const validityResult = await checkOrderEditingOn(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }
        const result = await orderEditService.fetchCategoriesForEdit(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, (result.meta.categories || []).map(formatEditOrderCategory));
    } catch (error) {
        logger.logException('orderController: getEditOrderCategories - Exception while fetching categories for order editing', { vendorId, error });
        return sendServerError(res);
    }
};

const getEditOrderProducts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const validityResult = await checkOrderEditingOn(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }
        const query = { ...req.query, categoryId: decodeIfPresent(req.query.categoryId) };
        const result = await orderEditService.fetchProductsForEdit(vendorId, query);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, (result.meta.products || []).map(formatEditOrderProduct));
    } catch (error) {
        logger.logException('orderController: getEditOrderProducts - Exception while fetching products for order editing', { vendorId, error });
        return sendServerError(res);
    }
};

const getEditOrderProductOptions = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const validityResult = await checkOrderEditingOn(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }
        const result = await orderEditService.fetchProductOptionsForEdit(vendorId, req.companySettingsData, common.decodeId(req.params.productId));
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatEditOrderProductOptions(result.meta));
    } catch (error) {
        logger.logException('orderController: getEditOrderProductOptions - Exception while fetching product options for order editing', { vendorId, error });
        return sendServerError(res);
    }
};

const addProductsToOrder = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const validityResult = await checkOrderEditingOn(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }
        const items = (req.body.items || []).map((item) => ({
            ...item,
            productId: decodeIfPresent(item.productId),
            variantId: decodeIfPresent(item.variantId),
            sizeId: decodeIfPresent(item.sizeId),
        }));
        const result = await orderEditService.addProductsToOrder(
            vendorId, req.user._id, id, items, req.body.applyBulkPricing, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            order: formatOrderForResponse(result.meta.order),
        });
    } catch (error) {
        logger.logException('orderController: addProductsToOrder - Exception while adding products to order', { vendorId, id, error });
        return sendServerError(res);
    }
};

const ADDRESS_EDIT_FLAG = 'isEditingShippingAddressAfterOrderIsPlacedFeatureOn';

const getOrderUserAddresses = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const validityResult = await common.checkFeatureOnOrOff(vendorId, req.websiteMasterData, req.companyMasterData, ADDRESS_EDIT_FLAG, ADDRESS_EDIT_FLAG);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await orderService.fetchUserAddressesForOrder(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            addresses: (result.meta.addresses || []).map(formatAddressForOrderResponse),
        });
    } catch (error) {
        logger.logException('orderController: getOrderUserAddresses - Exception while fetching the order customer addresses', { vendorId, id, error });
        return sendServerError(res);
    }
};

const updateOrderShippingAddress = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const validityResult = await common.checkFeatureOnOrOff(vendorId, req.websiteMasterData, req.companyMasterData, ADDRESS_EDIT_FLAG, ADDRESS_EDIT_FLAG);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const body = { ...req.body, addressId: decodeIfPresent(req.body.addressId) };
        const result = await orderService.updateOrderShippingAddress(vendorId, req.user._id, id, body);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            order: formatOrderForResponse(result.meta.order),
        });
    } catch (error) {
        logger.logException('orderController: updateOrderShippingAddress - Exception while updating order shipping address', { vendorId, id, error });
        return sendServerError(res);
    }
};

const assignDeliveryAgent = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderService.assignDeliveryAgent(
            vendorId, req.user._id, id, common.decodeId(req.body.deliveryAgentUserId), req.companyMasterData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            order: formatOrderForResponse(result.meta.order),
        });
    } catch (error) {
        logger.logException('orderController: assignDeliveryAgent - Exception while assigning delivery agent', { vendorId, id, error });
        return sendServerError(res);
    }
};

const deliveryAgentMarkDelivered = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderService.deliveryAgentMarkDelivered(
            vendorId, req.user._id, id, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            order: formatOrderForResponse(result.meta.order),
        });
    } catch (error) {
        logger.logException('orderController: deliveryAgentMarkDelivered - Exception while marking order delivered', { vendorId, id, error });
        return sendServerError(res);
    }
};

module.exports = {
    getEditOrderCategories,
    getEditOrderProducts,
    getEditOrderProductOptions,
    addProductsToOrder,
    getOrderUserAddresses,
    updateOrderShippingAddress,
    updateOrderShippingPrice,
    setOrderShippingPrice,
    createOrder,
    getMyOrders,
    getMyOrderById,
    cancelOrder,
    getAllOrdersAdmin,
    getOrderByIdAdmin,
    getOrderStepOptions,
    advanceOrderStep,
    assignDeliveryAgent,
    deliveryAgentMarkDelivered,
    downloadMyInvoice,
    downloadInvoiceAdmin
};
