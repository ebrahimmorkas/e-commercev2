const productService = require('../services/productService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const createProduct = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        // NOTE: mirrors the placeholder from the old productController.js -
        // swap this back to req.user._id once authenticate/authorize('admin')
        // are wired onto this route.
        // const userId = req.user._id;
        const userId = "6a6ed077b8ad83c8d068dda3";

        const result = await productService.createProduct(
            vendorId,
            userId,
            req.companyMasterData,
            req.websiteMasterData,
            req.companySettingsData,
            req.body,
            req.files
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error creating product', { vendorId, error });
        return common.sendError(res, 500, 'Failed to create product');
    }
};

const getAllProductsAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await productService.fetchAllProductsForAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error fetching products for admin', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch products');
    }
};

const getProductByIdAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await productService.fetchProductByIdForAdmin(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error fetching product by id for admin', { vendorId, id, error });
        return common.sendError(res, 500, 'Failed to fetch product');
    }
};

// Cookies carry raw ObjectId strings for Country/State/City (set at login),
// and a plain zip_code string. Any/all may be absent - handled downstream
// as "location unknown" (generic excludeText, per spec).
const readLocationCookies = (req) => ({
    countryId: req.cookies?.Country || null,
    stateId: req.cookies?.State || null,
    cityId: req.cookies?.City || null,
    zipCode: req.cookies?.zip_code || null
});

const getAllProductsClient = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const locationCookies = readLocationCookies(req);
        const result = await productService.fetchAllProductsForClient(vendorId, req.companySettingsData, locationCookies);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error fetching products for client', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch products');
    }
};

const getProductByIdClient = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const locationCookies = readLocationCookies(req);
        const result = await productService.fetchProductByIdForClient(vendorId, id, req.companySettingsData, locationCookies);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error fetching product by id for client', { vendorId, id, error });
        return common.sendError(res, 500, 'Failed to fetch product');
    }
};

module.exports = {
    createProduct,
    getAllProductsAdmin,
    getProductByIdAdmin,
    getAllProductsClient,
    getProductByIdClient
    // TODO: updateProduct, deleteProduct - add incrementally.
};