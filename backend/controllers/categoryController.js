const categoryService = require('../services/categoryService');
const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Converts a Category mongoose doc (or the plain object shape that comes
// back from a Redis cache hit) into a response-safe object with every
// ObjectId field encoded via common.encodeId.
const formatCategoryForResponse = (categoryDoc) => {
    if (!categoryDoc) return categoryDoc;
    const category = categoryDoc.toObject ? categoryDoc.toObject() : categoryDoc;

    return {
        ...category,
        _id: category._id ? common.encodeId(category._id) : category._id,
        vendorId: category.vendorId ? common.encodeId(category.vendorId) : category.vendorId,
        parent_category_id: category.parent_category_id ? common.encodeId(category.parent_category_id) : category.parent_category_id,
        image: category.image ? {
            ...category.image,
            imageAssetId: category.image.imageAssetId ? common.encodeId(category.image.imageAssetId) : category.image.imageAssetId,
        } : category.image,
        createdBy: category.createdBy ? common.encodeId(category.createdBy) : category.createdBy,
        updatedBy: category.updatedBy ? common.encodeId(category.updatedBy) : category.updatedBy,
        deletedBy: category.deletedBy ? common.encodeId(category.deletedBy) : category.deletedBy,
        activeMarkedBy: category.activeMarkedBy ? common.encodeId(category.activeMarkedBy) : category.activeMarkedBy,
        inActiveMarkedBy: category.inActiveMarkedBy ? common.encodeId(category.inActiveMarkedBy) : category.inActiveMarkedBy,
    };
};

const addCategory = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isCategoryFeatureOn", "isCategoryFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const userId = req.user?._id;

        const payload = { ...req.body };
        if (payload.parent_category_id) {
            payload.parent_category_id = common.decodeId(payload.parent_category_id);
        }

        const category = await categoryService.addCategory(
            vendorId,
            userId,
            payload,
            req.file,
            websiteMasterData,
            companyMasterData
        );
        if(!category.isSuccess) {
            return common.sendError(res, category.statusCode, category.message);
        }
        return common.sendSuccess(res, 201, 'Category added successfully', category);
    } catch (error) {
        logger.logException('categoryController: addCategory - Exception while adding category', { vendorId, error });
    }
};

const updateCategory = async (req, res) => {
    const vendorId = req.vendorId;
    let category_id;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isCategoryFeatureOn", "isCategoryFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const userId = req.user?._id;

        category_id = common.decodeId(req.body.category_id);
        const payload = { ...req.body };
        delete payload.category_id;
        if (payload.parent_category_id) {
            payload.parent_category_id = common.decodeId(payload.parent_category_id);
        }

        const categoryUpdate = await categoryService.updateCategory(
            vendorId,
            userId,
            category_id,
            payload,
            req.file,
            websiteMasterData,
            companyMasterData
        );

        if (!categoryUpdate.isSuccess) {
            return common.sendError(res, categoryUpdate.statusCode, categoryUpdate.message);
        }

        return common.sendSuccess(res, 200, 'Category updated successfully');
    } catch (error) {
        logger.logException('categoryController: updateCategory - Exception while updating category', { vendorId, error });
    }
};

const deleteCategory = async (req, res) => {
    const vendorId = req.vendorId;
    let category_id;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isCategoryFeatureOn", "isCategoryFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const userId = req.user?._id;
        category_id = common.decodeId(req.body.category_id);
        const result = await categoryService.softDeleteCategory(vendorId, userId, category_id);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('categoryController: deleteCategory - Exception while deleting category', { vendorId, error });
    }
};

const getCategories = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isCategoryFeatureOn", "isCategoryFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const categories = await redisService.getOrSet(
            redisKeys.category(vendorId),
            async () => await categoryService.fetchActiveCategories(vendorId),
            3600
        );

        return common.sendSuccess(res, 200, 'Categories fetched successfully', categories.map(formatCategoryForResponse));
    } catch (error) {
        logger.logException('categoryController: getCategories - Exception while fetching categories', { vendorId, error });
    }
};

const getAdminCategories = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isCategoryFeatureOn", "isCategoryFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const categories = await redisService.getOrSet(
            redisKeys.categoryAdmin(vendorId),
            async () => await categoryService.fetchAdminCategories(vendorId),
            3600
        );

        return common.sendSuccess(res, 200, 'Categories fetched successfully', categories.map(formatCategoryForResponse));
    } catch (error) {
        logger.logException('categoryController: getAdminCategories - Exception while fetching admin categories', { vendorId, error });
    }
};

const bulkUploadCategories = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;

        const categoryFeatureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isCategoryFeatureOn", "isCategoryFeatureOn");
        if (!categoryFeatureCheck.isSuccess) {
            return common.sendError(res, categoryFeatureCheck.statusCode, categoryFeatureCheck.message);
        }

        const bulkFeatureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isBulkUploadForCategoriesFeatureOn", "isBulkUploadForCategoriesFeatureOn");
        if (!bulkFeatureCheck.isSuccess) {
            return common.sendError(res, bulkFeatureCheck.statusCode, bulkFeatureCheck.message);
        }

        const excelFile = req.files?.excelFile?.[0];
        const zipFile = req.files?.imageZip?.[0];

        if (!excelFile) {
            return common.sendError(res, 400, 'Excel file (excelFile) is required');
        }
        if (!zipFile) {
            return common.sendError(res, 400, 'Image zip file (imageZip) is required');
        }

        const excelMaxSizeMB = websiteMasterData?.bulkUploadExcelMaxSizeMB;
        if (excelMaxSizeMB != null && excelFile.size > excelMaxSizeMB * 1024 * 1024) {
            return common.sendError(res, 400, `Excel file exceeds the allowed limit of ${excelMaxSizeMB}MB`);
        }

        const zipMaxSizeMB = websiteMasterData?.bulkUploadZipMaxSizeMB;
        if (zipMaxSizeMB != null && zipFile.size > zipMaxSizeMB * 1024 * 1024) {
            return common.sendError(res, 400, `Zip file exceeds the allowed limit of ${zipMaxSizeMB}MB`);
        }

        const userId = req.user?._id;

        const result = await categoryService.bulkUploadCategories(
            vendorId, userId, excelFile.buffer, zipFile.buffer, websiteMasterData, companyMasterData
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }

        return common.sendSuccess(res, 200, result.message, result.meta);
    } catch (error) {
        logger.logException('categoryController: bulkUploadCategories - Exception while bulk uploading categories', { vendorId, error });
    }
};

const bulkSetCategoryStatus = async (req, res) => {
    const vendorId = req.vendorId;
    const { status } = req.body;
    try {
        const userId = req.user._id;
        const decodedIds = req.body.categoryIds.map((id) => common.decodeId(id));

        const result = await categoryService.bulkSetCategoryStatus(vendorId, userId, decodedIds, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('categoryController: bulkSetCategoryStatus - Exception while bulk updating category status', { vendorId, error });
    }
};

const bulkDeleteCategories = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user._id;
        const decodedIds = req.body.categoryIds.map((id) => common.decodeId(id));

        const result = await categoryService.bulkDeleteCategories(vendorId, userId, decodedIds);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('categoryController: bulkDeleteCategories - Exception while bulk deleting categories', { vendorId, error });
    }
};

module.exports = {
    addCategory,
    updateCategory,
    deleteCategory,
    getCategories,
    getAdminCategories,
    bulkUploadCategories,
    bulkSetCategoryStatus,
    bulkDeleteCategories
};