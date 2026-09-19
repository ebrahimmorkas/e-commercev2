const productService = require('../services/productService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// Every catch block below ends here. It used to only log, which left the HTTP
// request open forever (the client just spun). Always answer, and turn a
// MongoDB duplicate-key error that slipped past a service pre-check (two
// admins saving the same name/SKU at once) into a clean 409.
const handleError = (res, message, error, context = {}) => {
    logger.logException(message, { ...context, error });
    if (res.headersSent) return;
    if (error && error.code === 11000) {
        return common.sendError(res, 409, 'Another product already uses one of these values (name, SKU, barcode or code). Please change it and try again.');
    }
    return common.sendError(res, 500, 'Something went wrong. Please try again.');
};

const createProduct = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user._id;

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
        return handleError(res, 'Error creating product', error, { vendorId });
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
        return handleError(res, 'Error fetching products for admin', error, { vendorId });
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
        return handleError(res, 'Error fetching product by id for admin', error, { vendorId, id });
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
        return handleError(res, 'Error fetching products for client', error, { vendorId });
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
        return handleError(res, 'Error fetching product by id for client', error, { vendorId, id });
    }
};

const getProductsByBrand = async (req, res) => {
    const vendorId = req.vendorId;
    const { brandId } = req.params;
    try {
        const locationCookies = readLocationCookies(req);
        const result = await productService.fetchProductsByBrandForClient(vendorId, brandId, req.companySettingsData, locationCookies);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error fetching products by brand', error, { vendorId, brandId });
    }
};

const getProductsByCategory = async (req, res) => {
    const vendorId = req.vendorId;
    const { categoryId } = req.params;
    try {
        const locationCookies = readLocationCookies(req);
        const result = await productService.fetchProductsByCategoryForClient(vendorId, categoryId, req.companySettingsData, locationCookies);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error fetching products by category', error, { vendorId, categoryId });
    }
};

const getProductsByCategoryAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    const { categoryId } = req.params;
    try {
        const result = await productService.fetchProductsByCategoryForAdmin(vendorId, categoryId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error fetching products by category for admin', error, { vendorId, categoryId });
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

        const userId = req.user._id;

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
        return handleError(res, 'Error in bulk product upload', error, { vendorId });
    }
};

const bulkUpdateProducts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const companySettingsData = req.companySettingsData;

        const bulkFeatureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isBulkUpdatingProductsAllowed', 'isBulkUpdatingProductsAllowed');
        if (!bulkFeatureCheck.isSuccess) {
            return common.sendError(res, bulkFeatureCheck.statusCode, `Bulk update is not enabled for your plan. Therefore you can't update products through Excel file.`);
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

        const userId = req.user._id;

        const result = await productService.bulkUpdateProducts(
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
        return handleError(res, 'Error in bulk product update', error, { vendorId });
    }
};

const updateProduct = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user._id;

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
        return handleError(res, 'Error updating product', error, { vendorId });
    }
};

const toggleProductStatus = async (req, res) => {
    const vendorId = req.vendorId;
    const { productId, status } = req.body;
    try {
        const userId = req.user._id;

        const result = await productService.toggleProductStatus(vendorId, userId, productId, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error toggling product status', error, { vendorId, productId });
    }
};

const deleteProduct = async (req, res) => {
    const vendorId = req.vendorId;
    const { productId } = req.body;
    try {
        const userId = req.user._id;

        const result = await productService.deleteProduct(vendorId, userId, productId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error deleting product', error, { vendorId, productId });
    }
};

const cloneProduct = async (req, res) => {
    const vendorId = req.vendorId;
    const { productId } = req.body;
    try {
        const userId = req.user._id;

        const result = await productService.cloneProduct(
            vendorId, userId, req.companyMasterData, req.websiteMasterData, req.companySettingsData, productId
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error cloning product', error, { vendorId, productId });
    }
};

const bulkCloneProducts = async (req, res) => {
    const vendorId = req.vendorId;
    const { productIds } = req.body;
    try {
        const userId = req.user._id;

        const result = await productService.bulkCloneProducts(
            vendorId, userId, req.companyMasterData, req.websiteMasterData, req.companySettingsData, productIds
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error bulk cloning products', error, { vendorId });
    }
};

const bulkSetProductStatus = async (req, res) => {
    const vendorId = req.vendorId;
    const { productIds, status } = req.body;
    try {
        const userId = req.user._id;

        const result = await productService.bulkToggleProductStatus(vendorId, userId, productIds, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error bulk toggling product status', error, { vendorId });
    }
};

const bulkDeleteProducts = async (req, res) => {
    const vendorId = req.vendorId;
    const { productIds } = req.body;
    try {
        const userId = req.user._id;

        const result = await productService.bulkDeleteProducts(vendorId, userId, productIds);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        return handleError(res, 'Error bulk deleting products', error, { vendorId });
    }
};

module.exports = {
    createProduct,
    updateProduct,
    toggleProductStatus,
    deleteProduct,
    bulkSetProductStatus,
    bulkDeleteProducts,
    cloneProduct,
    bulkCloneProducts,
    getAllProductsAdmin,
    getProductByIdAdmin,
    getAllProductsClient,
    getProductByIdClient,
    getProductsByBrand,
    getProductsByCategory,
    getProductsByCategoryAdmin,
    bulkUploadProducts,
    bulkUpdateProducts
};