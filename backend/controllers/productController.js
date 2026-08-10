const productService = require('../services/productService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

// ---------------------------------------------------------------------
// Vendor-admin handlers — productId is read from req.body (not req.params)
// ---------------------------------------------------------------------

const createProduct = async (req, res) => {
    try {
        const vendorId = req.user.vendorId;
        const userId = req.user._id;

        const { name, mainCategory, subCategory, slug, productCode } = req.body;
        if (!name || !mainCategory || !subCategory || !slug || !productCode) {
            return common.sendError(res, 400, 'name, mainCategory, subCategory, slug and productCode are required.');
        }

        const productData = {
            ...req.body,
            vendorId,
            createdBy: userId,
            updatedBy: userId
        };

        const result = await productService.createProduct(productData);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error creating product', { error });
    }
};

const updateProduct = async (req, res) => {
    try {
        const vendorId = req.user.vendorId;
        const userId = req.user._id;
        const { productId, ...updateData } = req.body;

        if (!productId) {
            return common.sendError(res, 400, 'productId is required.');
        }

        const result = await productService.updateProduct(productId, vendorId, updateData, userId);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error updating product', { error });
    }
};

const getProductById = async (req, res) => {
    try {
        const vendorId = req.user.vendorId;
        const { productId } = req.body;

        if (!productId) {
            return common.sendError(res, 400, 'productId is required.');
        }

        const result = await productService.getProductById(productId, vendorId);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error fetching product', { error });
    }
};

const listProducts = async (req, res) => {
    try {
        const vendorId = req.user.vendorId;

        const filters = {
            status: req.query.status,
            mainCategory: req.query.mainCategory,
            subCategory: req.query.subCategory,
            brand: req.query.brand,
            search: req.query.search,
            minPrice: req.query.minPrice,
            maxPrice: req.query.maxPrice
        };

        const pagination = {
            page: req.query.page,
            limit: req.query.limit,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder
        };

        const result = await productService.listProducts(vendorId, filters, pagination);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error listing products', { error });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const vendorId = req.user.vendorId;
        const userId = req.user._id;
        const { productId } = req.body;

        if (!productId) {
            return common.sendError(res, 400, 'productId is required.');
        }

        const result = await productService.deleteProduct(productId, vendorId, userId);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error deleting product', { error });
    }
};

// ---------------------------------------------------------------------
// Storefront (public) handlers — vendorId comes from vendorDetection
// ---------------------------------------------------------------------

const listStorefrontProducts = async (req, res) => {
    try {
        const vendorId = req.vendorId;

        const filters = {
            mainCategory: req.query.mainCategory,
            subCategory: req.query.subCategory,
            brand: req.query.brand,
            search: req.query.search,
            minPrice: req.query.minPrice,
            maxPrice: req.query.maxPrice
        };

        const pagination = {
            page: req.query.page,
            limit: req.query.limit,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder
        };

        const result = await productService.listStorefrontProducts(vendorId, filters, pagination);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error listing storefront products', { error });
    }
};

const getStorefrontProductBySlug = async (req, res) => {
    try {
        const vendorId = req.vendorId;
        const { slug } = req.params;

        const result = await productService.getProductBySlug(vendorId, slug);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error fetching storefront product', { error });
    }
};

module.exports = {
    createProduct,
    updateProduct,
    getProductById,
    listProducts,
    deleteProduct,
    listStorefrontProducts,
    getStorefrontProductBySlug
};