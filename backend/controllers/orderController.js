const orderService = require('../services/orderService');
const orderEditService = require('../services/orderEditService');
const invoiceService = require('../services/invoiceService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

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
    const { id } = req.params;
    try {
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

        const result = await orderService.createOrderFromCart(
            vendorId,
            userId,
            req.user.country || null,
            req.companyMasterData,
            req.websiteMasterData,
            req.companySettingsData,
            req.shippingPriceSettingsData,
            req.body
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: createOrder - Exception while creating order', { vendorId, error });
    }
};

const getMyOrders = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await orderService.fetchMyOrders(vendorId, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: getMyOrders - Exception while fetching orders', { vendorId, error });
    }
};

// Customer-facing single-order view, gated behind the order-tracking
// feature (both WebsiteMaster and CompanyMaster must have it on).
const getMyOrderById = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
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
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: getMyOrderById - Exception while fetching order', { vendorId, id, error });
    }
};

const cancelOrder = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderService.cancelOrder(
            vendorId, req.user._id, id, req.body.cancellationReason, req.companySettingsData, req.companyMasterData, req.websiteMasterData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: cancelOrder - Exception while cancelling order', { vendorId, id, error });
    }
};

const getAllOrdersAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await orderService.fetchAllOrdersAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: getAllOrdersAdmin - Exception while fetching orders', { vendorId, error });
    }
};

const getOrderByIdAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
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
        return common.sendSuccess(res, result.statusCode, result.message, { ...result.meta, canEditShippingPrice, canEditShippingAddress, canEditOrder });
    } catch (error) {
        logger.logException('orderController: getOrderByIdAdmin - Exception while fetching order', { vendorId, id, error });
    }
};

const getOrderStepOptions = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderService.fetchOrderStepOptions(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: getOrderStepOptions - Exception while fetching order steps', { vendorId, id, error });
    }
};

const advanceOrderStep = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const { targetStepCode, remarks } = req.body;
        const result = await orderService.advanceOrderStep(
            vendorId, req.user._id, id, targetStepCode, remarks, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: advanceOrderStep - Exception while advancing order step', { vendorId, id, error });
    }
};

const setOrderShippingPrice = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderService.setOrderShippingPrice(vendorId, req.user._id, id, req.body.shippingAmount);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: setOrderShippingPrice - Exception while adding order shipping price', { vendorId, id, error });
    }
};

const updateOrderShippingPrice = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const validityResult = await common.checkFeatureOnOrOff(vendorId, req.websiteMasterData, req.companyMasterData, 'isEditingShippingPriceFeatureOn', 'isEditingShippingPriceFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await orderService.updateOrderShippingPrice(vendorId, req.user._id, id, req.body.shippingAmount);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: updateOrderShippingPrice - Exception while updating order shipping price', { vendorId, id, error });
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
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.categories);
    } catch (error) {
        logger.logException('orderController: getEditOrderCategories - Exception while fetching categories for order editing', { vendorId, error });
    }
};

const getEditOrderProducts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const validityResult = await checkOrderEditingOn(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }
        const result = await orderEditService.fetchProductsForEdit(vendorId, req.query);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.products);
    } catch (error) {
        logger.logException('orderController: getEditOrderProducts - Exception while fetching products for order editing', { vendorId, error });
    }
};

const getEditOrderProductOptions = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const validityResult = await checkOrderEditingOn(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }
        const result = await orderEditService.fetchProductOptionsForEdit(vendorId, req.companySettingsData, req.params.productId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: getEditOrderProductOptions - Exception while fetching product options for order editing', { vendorId, error });
    }
};

const addProductsToOrder = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const validityResult = await checkOrderEditingOn(req);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }
        const result = await orderEditService.addProductsToOrder(
            vendorId, req.user._id, id, req.body.items, req.companyMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: addProductsToOrder - Exception while adding products to order', { vendorId, id, error });
    }
};

const ADDRESS_EDIT_FLAG = 'isEditingShippingAddressAfterOrderIsPlacedFeatureOn';

const getOrderUserAddresses = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const validityResult = await common.checkFeatureOnOrOff(vendorId, req.websiteMasterData, req.companyMasterData, ADDRESS_EDIT_FLAG, ADDRESS_EDIT_FLAG);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await orderService.fetchUserAddressesForOrder(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: getOrderUserAddresses - Exception while fetching the order customer addresses', { vendorId, id, error });
    }
};

const updateOrderShippingAddress = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const validityResult = await common.checkFeatureOnOrOff(vendorId, req.websiteMasterData, req.companyMasterData, ADDRESS_EDIT_FLAG, ADDRESS_EDIT_FLAG);
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await orderService.updateOrderShippingAddress(vendorId, req.user._id, id, req.body);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: updateOrderShippingAddress - Exception while updating order shipping address', { vendorId, id, error });
    }
};

const assignDeliveryAgent = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderService.assignDeliveryAgent(
            vendorId, req.user._id, id, req.body.deliveryAgentUserId, req.companyMasterData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: assignDeliveryAgent - Exception while assigning delivery agent', { vendorId, id, error });
    }
};

const deliveryAgentMarkDelivered = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderService.deliveryAgentMarkDelivered(
            vendorId, req.user._id, id, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: deliveryAgentMarkDelivered - Exception while marking order delivered', { vendorId, id, error });
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
