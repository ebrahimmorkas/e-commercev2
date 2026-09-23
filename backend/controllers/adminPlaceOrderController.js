const adminPlaceOrderService = require('../services/adminPlaceOrderService');
const logger = require('../utils/logger');
const common = require('../utils/common');

const encodeIfPresent = (id) => (id ? common.encodeId(id) : id);
const decodeIfPresent = (id) => (id ? common.decodeId(id) : id);

// adminPlaceOrderService.loadCategories/loadActiveProducts/loadProductOptions
// (shared with orderController.js's Edit-Order picker, which uses the exact
// same encoding) - these ids feed straight back into placeOrder's
// items[].productId/variantId/sizeId, so they must be encoded here too.
const formatCategory = (category) => ({ ...category, _id: encodeIfPresent(category._id), parent_category_id: encodeIfPresent(category.parent_category_id) });

const formatProduct = (product) => ({
    ...product,
    _id: encodeIfPresent(product._id),
    mainCategory: encodeIfPresent(product.mainCategory),
    subCategory: encodeIfPresent(product.subCategory),
});

const formatProductOptions = (meta) => ({
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

// fetchUsersBySearchField returns { userId, value, name } rows (no _id), and
// userId is sent straight back as placeOrder's / getUserAddresses' userId.
const formatUser = (user) => ({ ...user, userId: encodeIfPresent(user.userId) });

const formatAddress = (address) => ({ ...address, _id: encodeIfPresent(address._id) });

// Same field set as orderController.js's formatOrderForResponse - placeOrder
// returns a freshly created Order doc and must encode it the same way every
// other order-returning endpoint does.
const formatOrder = (orderDoc) => {
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
            }))
            : order.items,
    };
};

const getUserSearchFields = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.fetchUserSearchFields(vendorId, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.fields);
    } catch (error) {
        logger.logException('adminPlaceOrderController: getUserSearchFields - Exception while fetching search fields', { vendorId, error });
    }
};

const getUsersBySearchField = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.fetchUsersBySearchField(vendorId, req.websiteMasterData, req.companyMasterData, req.query);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, (result.meta.users || []).map(formatUser));
    } catch (error) {
        logger.logException('adminPlaceOrderController: getUsersBySearchField - Exception while fetching users', { vendorId, error });
    }
};

const getUserAddresses = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.fetchUserAddresses(vendorId, req.websiteMasterData, req.companyMasterData, common.decodeId(req.params.userId));
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, (result.meta.addresses || []).map(formatAddress));
    } catch (error) {
        logger.logException('adminPlaceOrderController: getUserAddresses - Exception while fetching addresses', { vendorId, error });
    }
};

const getCategories = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.fetchCategories(vendorId, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, (result.meta.categories || []).map(formatCategory));
    } catch (error) {
        logger.logException('adminPlaceOrderController: getCategories - Exception while fetching categories', { vendorId, error });
    }
};

const getProducts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const query = { ...req.query, categoryId: decodeIfPresent(req.query.categoryId) };
        const result = await adminPlaceOrderService.fetchActiveProducts(vendorId, req.websiteMasterData, req.companyMasterData, query);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, (result.meta.products || []).map(formatProduct));
    } catch (error) {
        logger.logException('adminPlaceOrderController: getProducts - Exception while fetching products', { vendorId, error });
    }
};

const getProductOptions = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.fetchProductOptions(
            vendorId, req.websiteMasterData, req.companyMasterData, req.companySettingsData, common.decodeId(req.params.productId)
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatProductOptions(result.meta));
    } catch (error) {
        logger.logException('adminPlaceOrderController: getProductOptions - Exception while fetching product options', { vendorId, error });
    }
};

const previewTax = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const payload = {
            ...req.body,
            userId: decodeIfPresent(req.body.userId),
            addressId: decodeIfPresent(req.body.addressId),
            items: (req.body.items || []).map((item) => ({
                ...item,
                productId: decodeIfPresent(item.productId),
                variantId: decodeIfPresent(item.variantId),
                sizeId: decodeIfPresent(item.sizeId),
            })),
        };
        const result = await adminPlaceOrderService.previewPlaceOrderTax(
            vendorId, req.websiteMasterData, req.companyMasterData, req.companySettingsData, payload
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = result.meta;
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...meta,
            lines: meta.lines.map((line) => ({
                ...line,
                productId: encodeIfPresent(line.productId),
                variantId: encodeIfPresent(line.variantId),
                sizeId: encodeIfPresent(line.sizeId),
            })),
            taxes: meta.taxes.map((tax) => ({ ...tax, taxId: encodeIfPresent(tax.taxId) })),
        });
    } catch (error) {
        logger.logException('adminPlaceOrderController: previewTax - Exception while previewing tax', { vendorId, error });
    }
};

const placeOrder = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const payload = {
            ...req.body,
            userId: decodeIfPresent(req.body.userId),
            addressId: decodeIfPresent(req.body.addressId),
            items: (req.body.items || []).map((item) => ({
                ...item,
                productId: decodeIfPresent(item.productId),
                variantId: decodeIfPresent(item.variantId),
                sizeId: decodeIfPresent(item.sizeId),
            })),
        };
        const result = await adminPlaceOrderService.placeOrderOnBehalfOfUser(
            vendorId, req.user._id, req.websiteMasterData, req.companyMasterData, req.companySettingsData, payload
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatOrder(result.meta.order));
    } catch (error) {
        logger.logException('adminPlaceOrderController: placeOrder - Exception while placing order', { vendorId, error });
    }
};

module.exports = {
    getUserSearchFields,
    getUsersBySearchField,
    getUserAddresses,
    getCategories,
    getProducts,
    getProductOptions,
    previewTax,
    placeOrder
};
