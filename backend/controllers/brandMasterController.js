const brandMasterService = require('../services/brandMasterService');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Converts a BrandMaster mongoose doc (or the slimmer client-facing
// projection from fetchAllBrandsClient) into a response-safe object with
// every ObjectId field encoded via common.encodeId. Fields are guarded
// since the client projection only carries _id + brandName + brandShortName.
const formatBrandForResponse = (brandDoc) => {
    if (!brandDoc) return brandDoc;
    const brand = brandDoc.toObject ? brandDoc.toObject() : brandDoc;

    return {
        ...brand,
        _id: brand._id ? common.encodeId(brand._id) : brand._id,
        vendorId: brand.vendorId ? common.encodeId(brand.vendorId) : brand.vendorId,
        createdBy: brand.createdBy ? common.encodeId(brand.createdBy) : brand.createdBy,
        updatedBy: brand.updatedBy ? common.encodeId(brand.updatedBy) : brand.updatedBy,
        deletedBy: brand.deletedBy ? common.encodeId(brand.deletedBy) : brand.deletedBy,
        activeMarkedBy: brand.activeMarkedBy ? common.encodeId(brand.activeMarkedBy) : brand.activeMarkedBy,
        inActiveMarkedBy: brand.inActiveMarkedBy ? common.encodeId(brand.inActiveMarkedBy) : brand.inActiveMarkedBy,
    };
};

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
        return common.sendSuccess(res, result.statusCode, result.message, formatBrandForResponse(result.meta.brand));
    } catch (error) {
        logger.logException('brandMasterController: addBrand - Exception while adding brand', { vendorId, error });
    }
};

const updateBrand = async (req, res) => {
    const vendorId = req.vendorId;
    let brandId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isBrandFeatureOn', 'isBrandFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        brandId = common.decodeId(req.body.brandId);
        const payload = { ...req.body };
        delete payload.brandId;

        const result = await brandMasterService.updateBrand(vendorId, brandId, payload, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatBrandForResponse(result.meta.brand));
    } catch (error) {
        logger.logException('brandMasterController: updateBrand - Exception while updating brand', { vendorId, brandId, error });
    }
};

const deleteBrand = async (req, res) => {
    const vendorId = req.vendorId;
    let brandId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isBrandFeatureOn', 'isBrandFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        brandId = common.decodeId(req.body.brandId);
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
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.brands.map(formatBrandForResponse));
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
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.brands.map(formatBrandForResponse));
    } catch (error) {
        logger.logException('brandMasterController: getAllBrandsClient - Exception while fetching brands for client', { vendorId, error });
    }
};

const getBrandById = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await brandMasterService.fetchBrandById(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatBrandForResponse(result.meta.brand));
    } catch (error) {
        logger.logException('brandMasterController: getBrandById - Exception while fetching brand by id', { vendorId, id, error });
    }
};

const bulkSetBrandStatus = async (req, res) => {
    const vendorId = req.vendorId;
    const { status } = req.body;
    try {
        const decodedIds = req.body.brandIds.map((id) => common.decodeId(id));
        const result = await brandMasterService.bulkSetBrandStatus(vendorId, req.user._id, decodedIds, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        // Re-encode ids before they leave the server - the caller only ever
        // knows its brands by their encoded id, same as everywhere else on
        // this controller.
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('brandMasterController: bulkSetBrandStatus - Exception while bulk updating brand status', { vendorId, error });
    }
};

const bulkDeleteBrands = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const decodedIds = req.body.brandIds.map((id) => common.decodeId(id));
        const result = await brandMasterService.bulkDeleteBrands(vendorId, req.user._id, decodedIds);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('brandMasterController: bulkDeleteBrands - Exception while bulk deleting brands', { vendorId, error });
    }
};

module.exports = {
    addBrand,
    updateBrand,
    deleteBrand,
    getAllBrandsAdmin,
    getAllBrandsClient,
    getBrandById,
    bulkSetBrandStatus,
    bulkDeleteBrands
};
