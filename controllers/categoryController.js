const categoryService = require('../services/categoryService');
const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');
const common = require('../utils/common');

const isCategoryFeatureBlocked = (req, res) => {
    const websiteMasterData = req.websiteMasterData;
    const companyMasterData = req.companyMasterData;

    if (!websiteMasterData?.isCategoryFeatureOn) {
        common.sendError(res, 403, websiteMasterData?.temporaryFeatureOffMessage);
        return true;
    }

    if (!companyMasterData?.isCategoryFeatureOn) {
        common.sendError(res, 403, websiteMasterData?.featureDisabledForVendorMessage);
        return true;
    }

    return false;
};

const addCategory = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        if (isCategoryFeatureBlocked(req, res)) return;
        const userId = req.user?._id;
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;

        const category = await categoryService.addCategory(
            vendorId,
            userId,
            req.body,
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
    const { category_id } = req.body;
    try {
        if (isCategoryFeatureBlocked(req, res)) return;
        const userId = req.user?._id;
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;

        const categoryUpdate = await categoryService.updateCategory(
            vendorId,
            userId,
            category_id,
            req.body,
            req.file,
            websiteMasterData,
            companyMasterData
        );

        if (!categoryUpdate.isSuccess) {
            return common.returnResult(false, categoryUpdate.statusCode, categoryUpdate.message);
        }

        return common.sendSuccess(res, 200, 'Category updated successfully');
    } catch (error) {
        logger.logException('categoryController: updateCategory - Exception while updating category', { vendorId, error });
        return common.sendError(res, error.statusCode || 500, error.statusCode ? error.message : 'Failed to update category');
    }
};

const deleteCategory = async (req, res) => {
    const vendorId = req.vendorId;
    const { category_id } = req.body;
    try {
        if (isCategoryFeatureBlocked(req, res)) return;
        const userId = req.user?._id;
        const result = await categoryService.softDeleteCategory(vendorId, userId, category_id);

        if (result.notFound) {
            return common.sendError(res, 404, 'Category not found');
        }

        return common.sendSuccess(res, 200, 'Category deleted successfully');
    } catch (error) {
        logger.logException('categoryController: deleteCategory - Exception while deleting category', { vendorId, error });
        return common.sendError(res, 500, 'Failed to delete category');
    }
};

const getCategories = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        if (isCategoryFeatureBlocked(req, res)) return;
        const categories = await redisService.getOrSet(
            redisKeys.category(vendorId),
            async () => await categoryService.fetchActiveCategories(vendorId),
            3600
        );

        return common.sendSuccess(res, 200, 'Categories fetched successfully', categories);
    } catch (error) {
        logger.logException('categoryController: getCategories - Exception while fetching categories', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch categories');
    }
};

const getAdminCategories = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        if (isCategoryFeatureBlocked(req, res)) return;
        const categories = await redisService.getOrSet(
            redisKeys.categoryAdmin(vendorId),
            async () => await categoryService.fetchAdminCategories(vendorId),
            3600
        );

        return common.sendSuccess(res, 200, 'Categories fetched successfully', categories);
    } catch (error) {
        logger.logException('categoryController: getAdminCategories - Exception while fetching admin categories', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch categories');
    }
};

module.exports = {
    addCategory,
    updateCategory,
    deleteCategory,
    getCategories,
    getAdminCategories
};