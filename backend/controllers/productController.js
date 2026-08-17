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

module.exports = {
    createProduct
    // TODO: updateProduct, deleteProduct, getAllProductsAdmin,
    // getAllProductsClient, getProductById - add incrementally.
};