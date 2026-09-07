const brandMasterService = require('../services/brandMasterService');
const logger = require('../utils/logger');
const common = require('../utils/common');

const addBrand = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isBrandFeatureOn', 'isBrandFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const { numberOfBrandsAllowed } = companyMasterData;
        const existingCount = await brandMasterService.getBrandCount(vendorId);
        if (existingCount.meta.count >= numberOfBrandsAllowed) {
            return common.sendError(res, 403, 'You have exceeded the number of brands allowed');
        }

        const result = await brandMasterService.addBrand(vendorId, req.body, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.brand);
    } catch (error) {
        logger.logException('brandMasterController: addBrand - Exception while adding brand', { vendorId, error });
    }
};

const updateBrand = async (req, res) => {
    const vendorId = req.vendorId;
    const { brandId } = req.body;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isBrandFeatureOn', 'isBrandFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await brandMasterService.updateBrand(vendorId, brandId, req.body, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.brand);
    } catch (error) {
        logger.logException('brandMasterController: updateBrand - Exception while updating brand', { vendorId, brandId, error });
    }
};

const deleteBrand = async (req, res) => {
    const vendorId = req.vendorId;
    const { brandId } = req.body;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isBrandFeatureOn', 'isBrandFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await brandMasterService.softDeleteBrand(vendorId, brandId, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('brandMasterController: deleteBrand - Exception while deleting brand', { vendorId, brandId, error });
    }
};

const getAllBrandsAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isBrandFeatureOn', 'isBrandFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await brandMasterService.fetchAllBrandsAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.brands);
    } catch (error) {
        logger.logException('brandMasterController: getAllBrandsAdmin - Exception while fetching brands', { vendorId, error });
    }
};

// Role 'user' - only status 'A' brands are returned (see fetchAllBrandsClient).
// Status 'I' stays admin-only, status 'D' is never shown to anyone.
const getAllBrandsClient = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isBrandFeatureOn', 'isBrandFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await brandMasterService.fetchAllBrandsClient(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.brands);
    } catch (error) {
        logger.logException('brandMasterController: getAllBrandsClient - Exception while fetching brands for client', { vendorId, error });
    }
};

const getBrandById = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await brandMasterService.fetchBrandById(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.brand);
    } catch (error) {
        logger.logException('brandMasterController: getBrandById - Exception while fetching brand by id', { vendorId, id, error });
    }
};

module.exports = {
    addBrand,
    updateBrand,
    deleteBrand,
    getAllBrandsAdmin,
    getAllBrandsClient,
    getBrandById
};
