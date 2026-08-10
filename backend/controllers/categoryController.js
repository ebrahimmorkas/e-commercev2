const categoryService = require('../services/categoryService');
const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');
const common = require('../utils/common');

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
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isCategoryFeatureOn", "isCategoryFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const userId = req.user?._id;

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
    }
};

const deleteCategory = async (req, res) => {
    const vendorId = req.vendorId;
    const { category_id } = req.body;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isCategoryFeatureOn", "isCategoryFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const userId = req.user?._id;
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

        return common.sendSuccess(res, 200, 'Categories fetched successfully', categories);
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

        return common.sendSuccess(res, 200, 'Categories fetched successfully', categories);
    } catch (error) {
        logger.logException('categoryController: getAdminCategories - Exception while fetching admin categories', { vendorId, error });
    }
};

module.exports = {
    addCategory,
    updateCategory,
    deleteCategory,
    getCategories,
    getAdminCategories
};