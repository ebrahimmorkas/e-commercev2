const categoryService = require('../services/categoryService');
const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');
const common = require('../utils/common');

const addCategory = async (req, res) => {
    const vendorId = req.vendorId;
    try {
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

        return common.sendSuccess(res, 201, 'Category added successfully', category);
    } catch (error) {
        logger.logException('categoryController: addCategory - Exception while adding category', { vendorId, error });
        return common.sendError(res, error.statusCode || 500, error.statusCode ? error.message : 'Failed to add category');
    }
};

const updateCategory = async (req, res) => {
    const vendorId = req.vendorId;
    const { category_id } = req.body;
    try {
        const userId = req.user?._id;
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;

        const updated = await categoryService.updateCategory(
            vendorId,
            userId,
            category_id,
            req.body,
            req.file,
            websiteMasterData,
            companyMasterData
        );

        if (!updated) {
            return common.sendError(res, 404, 'Category not found');
        }

        return common.sendSuccess(res, 200, 'Category updated successfully', updated);
    } catch (error) {
        logger.logException('categoryController: updateCategory - Exception while updating category', { vendorId, error });
        return common.sendError(res, error.statusCode || 500, error.statusCode ? error.message : 'Failed to update category');
    }
};

const deleteCategory = async (req, res) => {
    const vendorId = req.vendorId;
    const { category_id } = req.body;
    try {
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