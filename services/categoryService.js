const Category = require('../models/Category');
const logger = require('../utils/logger');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const storageService = require('./storageService');

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const invalidateCategoryCache = async (vendorId) => {
    try {
        await redisService.del(redisKeys.category(vendorId));
        await redisService.del(redisKeys.categoryAdmin(vendorId));
        logger.logInfo('Category cache invalidated', { vendorId });
    } catch (err) {
        throw err;
    }
};

/**
 * Case-insensitive name check, scoped to vendor + same parent, excluding soft-deleted (D) siblings.
 */
const isNameTaken = async (vendorId, categoryName, parentCategoryId, excludeId = null) => {
    try {
        const query = {
            vendorId,
            parent_category_id: parentCategoryId,
            status: { $ne: 'D' },
            categoryName: { $regex: `^${escapeRegex(categoryName)}$`, $options: 'i' }
        };
        if (excludeId) query._id = { $ne: excludeId };

        const existing = await Category.findOne(query);
        return !!existing;
    } catch (err) {
        throw err;
    }
};

/**
 * BFS collection of all descendant _ids of a category (not including the category itself).
 */
const getDescendantIds = async (vendorId, rootId) => {
    try {
        const allIds = [];
        let currentLevel = [rootId];

        while (currentLevel.length > 0) {
            const children = await Category.find(
                { vendorId, parent_category_id: { $in: currentLevel } },
                '_id'
            );
            const childIds = children.map((c) => c._id);
            allIds.push(...childIds);
            currentLevel = childIds;
        }

        return allIds;
    } catch (err) {
        throw err;
    }
};

const validateParentForAttachment = async (vendorId, parentCategoryId) => {
    try {
        const parent = await Category.findOne({ _id: parentCategoryId, vendorId });
        if (!parent) return { valid: false, reason: 'Parent category not found' };
        if (parent.status !== 'A') return { valid: false, reason: 'Cannot attach a category under a parent that is not active' };
        return { valid: true, parent };
    } catch (err) {
        throw err;
    }
};

const checkNestingAllowed = (websiteMasterData, companyMasterData) => {
    if (!websiteMasterData?.isTaggingChildrenCategoryAllowed) {
        return { allowed: false, reason: 'Nested categories are currently disabled' };
    }
    if (!companyMasterData?.isTaggingChildrenCategoryAllowed) {
        return { allowed: false, reason: 'Nested categories are not enabled for your plan' };
    }
    return { allowed: true };
};

const checkMainCategoryLimit = async (vendorId, companyMasterData) => {
    try {
        const limit = companyMasterData?.numberOfMainCategoriesAllowed;
        if (limit === null || limit === undefined) return { allowed: true }; // null = infinite

        const count = await Category.countDocuments({ vendorId, parent_category_id: null, status: { $ne: 'D' } });
        if (count >= limit) {
            return { allowed: false, reason: 'Main category limit reached for your plan' };
        }
        return { allowed: true };
    } catch (err) {
        throw err;
    }
};

const checkSubCategoryLimit = async (vendorId, parentCategoryId, companyMasterData) => {
    try {
        const limit = companyMasterData?.numberOfSubcategoriesAllowed;
        if (limit === null || limit === undefined) return { allowed: true }; // null = infinite

        const count = await Category.countDocuments({ vendorId, parent_category_id: parentCategoryId, status: { $ne: 'D' } });
        if (count >= limit) {
            return { allowed: false, reason: 'Sub-category limit reached for this parent category' };
        }
        return { allowed: true };
    } catch (err) {
        throw err;
    }
};

/**
 * Runs every check needed before attaching a category (create or reparent) under the given parent
 * (or as a new main category if parentCategoryId is null).
 */
const validateAttachment = async (vendorId, parentCategoryId, websiteMasterData, companyMasterData) => {
    if (parentCategoryId) {
        const parentCheck = await validateParentForAttachment(vendorId, parentCategoryId);
        if (!parentCheck.valid) {
            const err = new Error(parentCheck.reason);
            err.statusCode = 400;
            throw err;
        }

        const nesting = checkNestingAllowed(websiteMasterData, companyMasterData);
        if (!nesting.allowed) {
            const err = new Error(nesting.reason);
            err.statusCode = 403;
            throw err;
        }

        const subLimit = await checkSubCategoryLimit(vendorId, parentCategoryId, companyMasterData);
        if (!subLimit.allowed) {
            const err = new Error(subLimit.reason);
            err.statusCode = 403;
            throw err;
        }
    } else {
        const mainLimit = await checkMainCategoryLimit(vendorId, companyMasterData);
        if (!mainLimit.allowed) {
            const err = new Error(mainLimit.reason);
            err.statusCode = 403;
            throw err;
        }
    }
};

const addCategory = async (vendorId, userId, data, file, websiteMasterData, companyMasterData) => {
    try {
        const { categoryName, parent_category_id = null, status = 'A' } = data;

        const taken = await isNameTaken(vendorId, categoryName, parent_category_id);
        if (taken) {
            const err = new Error('A category with this name already exists under the same parent');
            err.statusCode = 409;
            throw err;
        }

        await validateAttachment(vendorId, parent_category_id, websiteMasterData, companyMasterData);

        let image = { url: null, publicId: null };
        if (file) {
            const uploaded = await storageService.upload(file.buffer, {
                folder: `${vendorId}/categories`
            });
            image = { url: uploaded.url, publicId: uploaded.publicId };
            file.buffer = null;
        }

        const now = new Date();
        const categoryData = {
            vendorId,
            categoryName,
            parent_category_id,
            image,
            status,
            createdBy: userId,
            updatedBy: userId
        };

        if (status === 'A') {
            categoryData.actveMarkeddBy = userId;
            categoryData.activeMarkedDate = now;
        } else if (status === 'I') {
            categoryData.inActiveMarkeddBy = userId;
            categoryData.inactiveMarkedDate = now;
        }

        const category = new Category(categoryData);
        const saved = await category.save();

        logger.logInfo('Category added successfully', { vendorId, categoryId: saved._id });

        await invalidateCategoryCache(vendorId);
        return saved;
    } catch (err) {
        throw err;
    }
};

const updateCategory = async (vendorId, userId, categoryId, data, file, websiteMasterData, companyMasterData) => {
    try {
        const category = await Category.findOne({ _id: categoryId, vendorId, status: { $ne: 'D' } });
        if (!category) return null;

        const { categoryName, parent_category_id, status } = data;

        const isReparenting = parent_category_id !== undefined &&
            String(parent_category_id) !== String(category.parent_category_id ?? null);

        const targetParentId = isReparenting ? parent_category_id : category.parent_category_id;
        const targetName = categoryName !== undefined ? categoryName : category.categoryName;

        // Re-check name uniqueness whenever the name or the parent (i.e. the sibling scope) changes
        if (categoryName !== undefined || isReparenting) {
            const taken = await isNameTaken(vendorId, targetName, targetParentId, categoryId);
            if (taken) {
                const err = new Error('A category with this name already exists under the same parent');
                err.statusCode = 409;
                throw err;
            }
        }

        if (isReparenting) {
            if (parent_category_id) {
                if (String(parent_category_id) === String(categoryId)) {
                    const err = new Error('A category cannot be its own parent');
                    err.statusCode = 400;
                    throw err;
                }

                const descendantIds = await getDescendantIds(vendorId, categoryId);
                if (descendantIds.some((id) => String(id) === String(parent_category_id))) {
                    const err = new Error('Cannot move a category under one of its own descendants');
                    err.statusCode = 400;
                    throw err;
                }
            }

            await validateAttachment(vendorId, parent_category_id, websiteMasterData, companyMasterData);
            category.parent_category_id = parent_category_id;
        }

        if (categoryName !== undefined) {
            category.categoryName = categoryName;
        }

        // Status toggle (A <-> I only; 'D' is only ever set via delete-category)
        if (status !== undefined && status !== category.status) {
            const now = new Date();
            const descendantIds = await getDescendantIds(vendorId, categoryId);

            if (status === 'A') {
                category.status = 'A';
                category.actveMarkeddBy = userId;
                category.activeMarkedDate = now;

                if (descendantIds.length > 0) {
                    await Category.updateMany(
                        { _id: { $in: descendantIds } },
                        { $set: { status: 'A', actveMarkeddBy: userId, activeMarkedDate: now } }
                    );
                }
            } else if (status === 'I') {
                category.status = 'I';
                category.inActiveMarkeddBy = userId;
                category.inactiveMarkedDate = now;

                if (descendantIds.length > 0) {
                    await Category.updateMany(
                        { _id: { $in: descendantIds } },
                        { $set: { status: 'I', inActiveMarkeddBy: userId, inactiveMarkedDate: now } }
                    );
                }
            }
        }

        if (file) {
            const previousPublicId = category.image?.publicId;
            const uploaded = await storageService.upload(file.buffer, {
                folder: `${vendorId}/categories`
            });
            category.image = { url: uploaded.url, publicId: uploaded.publicId };
            file.buffer = null;

            if (previousPublicId) {
                await storageService.delete(previousPublicId);
            }
        }

        category.updatedBy = userId;

        const updated = await category.save();
        logger.logInfo('Category updated successfully', { vendorId, categoryId });

        await invalidateCategoryCache(vendorId);
        return updated;
    } catch (err) {
        throw err;
    }
};

const softDeleteCategory = async (vendorId, userId, categoryId) => {
    try {
        const category = await Category.findOne({ _id: categoryId, vendorId, status: { $ne: 'D' } });
        if (!category) return { notFound: true };

        const descendantIds = await getDescendantIds(vendorId, categoryId);
        const allIds = [categoryId, ...descendantIds];

        await Category.updateMany(
            { _id: { $in: allIds } },
            { $set: { status: 'D', deletedBy: userId } }
        );

        logger.logInfo('Category and its descendants soft deleted', { vendorId, categoryId, affectedCount: allIds.length });

        await invalidateCategoryCache(vendorId);
        return { deleted: true, affectedCount: allIds.length };
    } catch (err) {
        throw err;
    }
};

const fetchActiveCategories = async (vendorId) => {
    try {
        const categories = await Category.find(
            { vendorId, status: 'A' },
            null,
            { sort: { createdAt: 1 } }
        );
        logger.logInfo('Active categories fetched from DB', { vendorId });
        return categories;
    } catch (err) {
        throw err;
    }
};

const fetchAdminCategories = async (vendorId) => {
    try {
        const categories = await Category.find(
            { vendorId, status: { $ne: 'D' } },
            null,
            { sort: { createdAt: 1 } }
        );
        logger.logInfo('Admin categories fetched from DB', { vendorId });
        return categories;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    addCategory,
    updateCategory,
    softDeleteCategory,
    fetchActiveCategories,
    fetchAdminCategories
};