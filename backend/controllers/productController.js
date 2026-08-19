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

const bulkUploadProducts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const companySettingsData = req.companySettingsData;

        const bulkFeatureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isBulkUploadForProductsFeatureOn', 'isBulkUploadForProductsFeatureOn');
        if (!bulkFeatureCheck.isSuccess) {
            return common.sendError(res, bulkFeatureCheck.statusCode, `Bulk upload is not enabled for your plan. Therefore you can't add the product through Excel file.`);
        }

        const excelFile = req.files?.excelFile?.[0];
        const mainImagesZipFile = req.files?.mainImagesZip?.[0];
        const additionalImagesZipFile = req.files?.additionalImagesZip?.[0];

        if (!excelFile) {
            return common.sendError(res, 400, 'Excel file (excelFile) is required');
        }

        const excelMaxSizeMB = websiteMasterData?.bulkUploadExcelMaxSizeMB;
        if (excelMaxSizeMB != null && excelFile.size > excelMaxSizeMB * 1024 * 1024) {
            return common.sendError(res, 400, `Excel file exceeds the allowed limit of ${excelMaxSizeMB}MB`);
        }

        const zipMaxSizeMB = websiteMasterData?.bulkUploadZipMaxSizeMB;
        if (mainImagesZipFile && zipMaxSizeMB != null && mainImagesZipFile.size > zipMaxSizeMB * 1024 * 1024) {
            return common.sendError(res, 400, `Main images zip exceeds the allowed limit of ${zipMaxSizeMB}MB`);
        }
        if (additionalImagesZipFile && zipMaxSizeMB != null && additionalImagesZipFile.size > zipMaxSizeMB * 1024 * 1024) {
            return common.sendError(res, 400, `Additional images zip exceeds the allowed limit of ${zipMaxSizeMB}MB`);
        }

        // NOTE: same placeholder as createProduct above - swap once authenticate/authorize('admin') are wired in.
        const userId = "6a6ed077b8ad83c8d068dda3";

        const result = await productService.bulkUploadProducts(
            vendorId, userId, excelFile.buffer,
            mainImagesZipFile ? mainImagesZipFile.buffer : null,
            additionalImagesZipFile ? additionalImagesZipFile.buffer : null,
            companyMasterData, websiteMasterData, companySettingsData
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error in bulk product upload', { vendorId, error });
        return common.sendError(res, 500, 'Failed to process bulk product upload');
    }
};

const updateProduct = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        // Same placeholder as createProduct - swap once authenticate/
        // authorize('admin') are wired onto this route.
        const userId = "6a6ed077b8ad83c8d068dda3";

        const result = await productService.updateProduct(
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
        logger.logException('Error updating product', { vendorId, error });
        return common.sendError(res, 500, 'Failed to update product');
    }
};

const toggleProductStatus = async (req, res) => {
    const vendorId = req.vendorId;
    const { productId, status } = req.body;
    try {
        const userId = "6a6ed077b8ad83c8d068dda3";

        const result = await productService.toggleProductStatus(vendorId, userId, productId, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error toggling product status', { vendorId, productId, error });
        return common.sendError(res, 500, 'Failed to update product status');
    }
};

const deleteProduct = async (req, res) => {
    const vendorId = req.vendorId;
    const { productId } = req.body;
    try {
        const userId = "6a6ed077b8ad83c8d068dda3";

        const result = await productService.deleteProduct(vendorId, userId, productId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error deleting product', { vendorId, productId, error });
        return common.sendError(res, 500, 'Failed to delete product');
    }
};

module.exports = {
    createProduct,
    updateProduct,
    toggleProductStatus,
    deleteProduct,
    getAllProductsAdmin,
    getProductByIdAdmin,
    getAllProductsClient,
    getProductByIdClient,
    bulkUploadProducts
};