const path = require('path');
const { parseExcelBuffer } = require('../utils/excelParser');
const { extractZipEntries } = require('../utils/zipExtractor');
const { processExcelRows } = require('../utils/excelRowProcessor');
const Category = require('../models/Category');
const logger = require('../utils/logger');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const imageUploadService = require('./imageUploadService');
const common = require('../utils/common');
const { bulkCategoryRowSchema } = require('../middlewares/validations/categoryValidations');

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const invalidateCategoryCache = async (vendorId) => {
    try {
        await redisService.del(redisKeys.category(vendorId));
        await redisService.del(redisKeys.categoryAdmin(vendorId));
        logger.logInfo(1, 0, 'Category cache invalidated', { vendorId });
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

const validateParentForAttachment = async (vendorId, parentCategoryId, session = null) => {
    try {
        const parent = await Category.findOne({ _id: parentCategoryId, vendorId }).session(session);
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

const checkMainCategoryLimit = async (vendorId, companyMasterData, session = null) => {
    try {
        const limit = companyMasterData?.numberOfMainCategoriesAllowed;
        if (limit === null || limit === undefined) return { allowed: true };

        const count = await Category.countDocuments({ vendorId, parent_category_id: null, status: { $ne: 'D' } }).session(session);
        if (count >= limit) {
            return { allowed: false, reason: 'Main category limit reached for your plan' };
        }
        return { allowed: true };
    } catch (err) {
        throw err;
    }
};

const checkSubCategoryLimit = async (vendorId, parentCategoryId, companyMasterData, session = null) => {
    try {
        const limit = companyMasterData?.numberOfSubcategoriesAllowed;
        if (limit === null || limit === undefined) return { allowed: true };

        const count = await Category.countDocuments({ vendorId, parent_category_id: parentCategoryId, status: { $ne: 'D' } }).session(session);
        if (count >= limit) {
            return { allowed: false, reason: 'Sub-category limit reached for this parent category' };
        }
        return { allowed: true };
    } catch (err) {
        throw err;
    }
};

const validateAttachment = async (vendorId, parentCategoryId, websiteMasterData, companyMasterData, session = null) => {
    try {
        if (parentCategoryId) {
            const parentCheck = await validateParentForAttachment(vendorId, parentCategoryId, session);
            if (!parentCheck.valid) {
                return common.returnResult(false, 400, parentCheck.reason);
            }

            const nesting = checkNestingAllowed(websiteMasterData, companyMasterData);
            if (!nesting.allowed) {
                return common.returnResult(false, 403, nesting.reason);
            }

            const subLimit = await checkSubCategoryLimit(vendorId, parentCategoryId, companyMasterData, session);
            if (!subLimit.allowed) {
                return common.returnResult(false, 403, subLimit.reason);
            }
            return common.returnResult(true, 200, `Everything working good`);
        } else {
            const mainLimit = await checkMainCategoryLimit(vendorId, companyMasterData, session);
            if (!mainLimit.allowed) {
                return common.returnResult(false, 403, mainLimit.reason);
            }
            return common.returnResult(true, 200, `Can add category`);
        }
    } catch (err) {
        throw err;
    }
};

const addCategory = async (vendorId, userId, data, file, websiteMasterData, companyMasterData) => {
    try {
        const { categoryName, parent_category_id = null, status = 'A' } = data;

        const taken = await isNameTaken(vendorId, categoryName, parent_category_id);
        if (taken) {
            return common.returnResult(false, 409, `A category with this name already exists under the same parent`);
        }


        const validateResults = await validateAttachment(vendorId, parent_category_id, websiteMasterData, companyMasterData);
        if(!validateResults.isSuccess) {
            return common.returnResult(false, validateResults.statusCode, validateResults.message);
        }

        let image = { url: null, imageAssetId: null };
        if (file) {
            const uploadResult = await imageUploadService.uploadImage({
                vendorId,
                module: 'category',
                file,
                userId,
                maxSizeField: 'allowedCategoryImageMB',
                allowedFormatsField: 'allowedCategoryImagesFormat',
                companyMasterData,
                websiteMasterData
            });
            if (!uploadResult.isSuccess) {
                return common.returnResult(false, uploadResult.statusCode, uploadResult.message);
            }
            image = { url: uploadResult.meta.image.url, imageAssetId: uploadResult.meta.image._id };
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
            categoryData.activeMarkedBy = userId;
            categoryData.activeMarkedDate = now;
        } else if (status === 'I') {
            categoryData.inActiveMarkeddBy = userId;
            categoryData.inactiveMarkedDate = now;
        }

        const category = new Category(categoryData);
        const saved = await category.save();

        logger.logInfo(1, 0, 'Category added successfully', { vendorId, categoryId: saved._id });

        await invalidateCategoryCache(vendorId);
        return common.returnResult(true, 200, `Category added successfully`);
    } catch (err) {
        throw err;
    }
};

const updateCategory = async (vendorId, userId, categoryId, data, file, websiteMasterData, companyMasterData) => {
    try {
        const category = await Category.findOne({ _id: categoryId, vendorId, status: { $ne: 'D' } });
        if (!category) {
            return common.returnResult(false, 404, `Category not found`);
        }

        const { categoryName, parent_category_id, status } = data;

        const isReparenting = parent_category_id !== undefined &&
            String(parent_category_id) !== String(category.parent_category_id ?? null);

        const targetParentId = isReparenting ? parent_category_id : category.parent_category_id;
        const targetName = categoryName !== undefined ? categoryName : category.categoryName;

        // Re-check name uniqueness whenever the name or the parent (i.e. the sibling scope) changes
        if (categoryName !== undefined || isReparenting) {
            const taken = await isNameTaken(vendorId, targetName, targetParentId, categoryId);
            if (taken) {
                return common.returnResult(false, 409, `A category with this name already exists under the same parent`);
            }
        }

        if (isReparenting) {
            if (parent_category_id) {
                if (String(parent_category_id) === String(categoryId)) {
                    return common.returnResult(false, 400, `A category cannot be its own parent`);
                }

                const descendantIds = await getDescendantIds(vendorId, categoryId);
                if (descendantIds.some((id) => String(id) === String(parent_category_id))) {
                    return common.returnResult(false, 400, `Cannot move a category under one of its own descendants`);
                }
            }

            const attachmentCheck = await validateAttachment(vendorId, parent_category_id, websiteMasterData, companyMasterData);
            if(!attachmentCheck.isSuccess) {
                return common.returnResult(false, attachmentCheck.statusCode, attachmentCheck.message);
            }
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
                if (targetParentId) {
                    const parentCategory = await Category.findOne({ _id: targetParentId, vendorId }, 'status');
                    if (!parentCategory || parentCategory.status !== 'A') {
                        return common.returnResult(false, 400, `Parent is inactive Hence can't mark child as active`);
                    }
                }

                category.status = 'A';
                category.activeMarkedBy = userId;
                category.activeMarkedDate = now;

                if (descendantIds.length > 0) {
                    await Category.updateMany(
                        { _id: { $in: descendantIds } },
                        { $set: { status: 'A', activeMarkedBy: userId, activeMarkedDate: now } }
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
            if (category.image?.imageAssetId) {
                const imageUpdateResult = await imageUploadService.updateImage({
                    imageId: category.image.imageAssetId,
                    file,
                    userId,
                    maxSizeField: 'allowedCategoryImageMB',
                    allowedFormatsField: 'allowedCategoryImagesFormat',
                    companyMasterData,
                    websiteMasterData
                });
                if (!imageUpdateResult.isSuccess) {
                    return common.returnResult(false, imageUpdateResult.statusCode, imageUpdateResult.message);
                }
                category.image = { url: imageUpdateResult.meta.image.url, imageAssetId: imageUpdateResult.meta.image._id };
            } else {
                const uploadResult = await imageUploadService.uploadImage({
                    vendorId, module: 'category', file, userId,
                    maxSizeField: 'allowedCategoryImageMB',
                    allowedFormatsField: 'allowedCategoryImagesFormat',
                    companyMasterData, websiteMasterData
                });
                if (!uploadResult.isSuccess) {
                    return common.returnResult(false, uploadResult.statusCode, uploadResult.message);
                }
                category.image = { url: uploadResult.meta.image.url, imageAssetId: uploadResult.meta.image._id };
            }
        }

        category.updatedBy = userId;

        const updated = await category.save();
        logger.logInfo(1, 0, 'Category updated successfully', { vendorId, categoryId });

        await invalidateCategoryCache(vendorId);
        return common.returnResult(true, 200, `Category Updated Successfully`);
    } catch (err) {
        throw err;
    }
};

const softDeleteCategory = async (vendorId, userId, categoryId) => {
    try {
        const category = await Category.findOne({ _id: categoryId, vendorId, status: { $ne: 'D' } });
        if (!category) return common.returnResult(false, 404, `Category not found`);

        const descendantIds = await getDescendantIds(vendorId, categoryId);
        const allIds = [categoryId, ...descendantIds];

        const categoriesWithImages = await Category.find(
            { _id: { $in: allIds }, 'image.imageAssetId': { $ne: null } },
            '_id image.imageAssetId'
        );
        for (const cat of categoriesWithImages) {
            const imageDeleteResult = await imageUploadService.deleteImage({ imageId: cat.image.imageAssetId, userId });
            if (!imageDeleteResult.isSuccess) {
                logger.logInfo(0, 1, 'Failed to delete category image during soft delete', { vendorId, categoryId: cat._id });
            }
        }

        await Category.updateMany(
            { _id: { $in: allIds } },
            { $set: { status: 'D', deletedBy: userId } }
        );

        logger.logInfo(1, 0, 'Category and its descendants soft deleted', { vendorId, categoryId, affectedCount: allIds.length });

        await invalidateCategoryCache(vendorId);
        return common.returnResult(true, 200, `${allIds.length} categories deleted successfully`)
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
        logger.logInfo(1, 0, 'Active categories fetched from DB', { vendorId });
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
        logger.logInfo(1, 0, 'Admin categories fetched from DB', { vendorId });
        return categories;
    } catch (err) {
        throw err;
    }
};

const BULK_CATEGORY_COLUMNS = [
    { key: 'categoryPath', header: 'categoryPath', required: true },
    { key: 'imagePath', header: 'imagePath', required: false },
    { key: 'status', header: 'status', required: false }
];

const EXTENSION_MIME_MAP = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif'
};

const normalizePath = (segments) => segments.map((s) => s.trim().toLowerCase()).join('>');

const bulkUploadCategories = async (vendorId, userId, excelBuffer, zipBuffer, websiteMasterData, companyMasterData) => {
    try {
        const { rows } = await parseExcelBuffer(excelBuffer, BULK_CATEGORY_COLUMNS);

        if (rows.length === 0) {
            return common.returnResult(false, 400, 'Excel file contains no data rows');
        }

        let zipEntries;
        try {
            zipEntries = extractZipEntries(zipBuffer);
        } catch (err) {
            return common.returnResult(false, 400, `Could not read zip file: ${err.message}`);
        }

        // normalizedPath -> { resolvable: boolean, categoryId?, reason? }  (this batch, in file order)
        const batchMap = new Map();
        // normalizedPath -> categoryId, resolved from DB (pre-existing categories, cached per run)
        const dbPathCache = new Map();

        // Resolves the parent chain for a row. Checks this batch first (so later rows can
        // attach under categories created earlier in the SAME file), then falls back to DB
        // for chains that already existed before this upload. Fails if neither has it.
        const resolveParent = async (parentSegments) => {
            if (parentSegments.length === 0) {
                return { found: true, parentId: null };
            }

            let currentParentId = null;
            let walkedKey = '';

            for (const segment of parentSegments) {
                const trimmedSeg = segment.trim();
                walkedKey = walkedKey ? `${walkedKey}>${trimmedSeg.toLowerCase()}` : trimmedSeg.toLowerCase();

                if (dbPathCache.has(walkedKey)) {
                    currentParentId = dbPathCache.get(walkedKey);
                    continue;
                }

                if (batchMap.has(walkedKey)) {
                    const entry = batchMap.get(walkedKey);
                    if (!entry.resolvable) {
                        return { found: false, reason: `Parent category failed: ${entry.reason}` };
                    }
                    currentParentId = entry.categoryId;
                    dbPathCache.set(walkedKey, currentParentId);
                    continue;
                }

                const found = await Category.findOne({
                    vendorId,
                    parent_category_id: currentParentId,
                    status: { $ne: 'D' },
                    categoryName: { $regex: `^${escapeRegex(trimmedSeg)}$`, $options: 'i' }
                });

                if (!found) {
                    return { found: false, reason: `Parent '${trimmedSeg}' not found — add it in an earlier row` };
                }

                currentParentId = found._id;
                dbPathCache.set(walkedKey, currentParentId);
            }

            return { found: true, parentId: currentParentId };
        };

        const result = await processExcelRows(
            rows,
            async (row) => {
                const { error, value } = bulkCategoryRowSchema.validate(row, { abortEarly: false });
                if (error) {
                    return { success: false, errors: error.details.map((d) => d.message.replace(/"/g, '')) };
                }

                const segments = value.categoryPath.split('>').map((s) => s.trim()).filter(Boolean);
                const leafName = segments[segments.length - 1];
                const parentSegments = segments.slice(0, -1);
                const fullKey = normalizePath(segments);

                const parentResolution = await resolveParent(parentSegments);
                if (!parentResolution.found) {
                    batchMap.set(fullKey, { resolvable: false, reason: parentResolution.reason });
                    return { success: false, errors: [parentResolution.reason] };
                }
                const parentId = parentResolution.parentId;

                // Duplicate check — batch first (cheap), DB fallback for pre-existing categories
                let existingId = null;
                if (batchMap.has(fullKey)) {
                    const entry = batchMap.get(fullKey);
                    if (entry.resolvable) existingId = entry.categoryId;
                } else {
                    const dupExisting = await Category.findOne({
                        vendorId,
                        parent_category_id: parentId,
                        status: { $ne: 'D' },
                        categoryName: { $regex: `^${escapeRegex(leafName)}$`, $options: 'i' }
                    });
                    if (dupExisting) existingId = dupExisting._id;
                }
                if (existingId) {
                    const reason = `Category '${value.categoryPath}' already exists`;
                    // resolvable:true — children CAN still attach to this existing category,
                    // even though this row itself is reported as failed below.
                    batchMap.set(fullKey, { resolvable: true, categoryId: existingId, reason });
                    return { success: false, errors: [reason] };
                }

                const attachmentCheck = await validateAttachment(vendorId, parentId, websiteMasterData, companyMasterData);
                if (!attachmentCheck.isSuccess) {
                    batchMap.set(fullKey, { resolvable: false, reason: attachmentCheck.message });
                    return { success: false, errors: [attachmentCheck.message] };
                }

                let image = { url: null, imageAssetId: null };
                if (value.imagePath) {
                    const zipData = zipEntries.get(value.imagePath.trim().toLowerCase());
                    if (!zipData) {
                        const reason = `Image '${value.imagePath}' not found in zip file`;
                        batchMap.set(fullKey, { resolvable: false, reason });
                        return { success: false, errors: [reason] };
                    }

                    const pseudoFile = {
                        buffer: zipData,
                        originalname: path.basename(value.imagePath),
                        mimetype: 'application/octet-stream', // real type is verified inside imageUploadService
                        size: zipData.length
                    };

                    const uploadResult = await imageUploadService.uploadImage({
                        vendorId,
                        module: 'category',
                        file: pseudoFile,
                        userId,
                        maxSizeField: 'allowedCategoryImageMB',
                        allowedFormatsField: 'allowedCategoryImagesFormat',
                        companyMasterData,
                        websiteMasterData
                    });

                    if (!uploadResult.isSuccess) {
                        batchMap.set(fullKey, { resolvable: false, reason: uploadResult.message });
                        return { success: false, errors: [uploadResult.message] };
                    }

                    image = { url: uploadResult.meta.image.url, imageAssetId: uploadResult.meta.image._id };
                }

                const now = new Date();
                const categoryData = {
                    vendorId,
                    categoryName: leafName,
                    parent_category_id: parentId,
                    image,
                    status: value.status,
                    createdBy: userId,
                    updatedBy: userId
                };
                if (value.status === 'A') {
                    categoryData.activeMarkedBy = userId;
                    categoryData.activeMarkedDate = now;
                } else {
                    categoryData.inActiveMarkeddBy = userId;
                    categoryData.inactiveMarkedDate = now;
                }

                const saved = await Category.create(categoryData);

                batchMap.set(fullKey, { resolvable: true, categoryId: saved._id });
                return { success: true };
            },
            { allowPartialSuccess: true, useTransaction: false }
        );

        if (result.successCount > 0) {
            await invalidateCategoryCache(vendorId);
        }

        logger.logInfo(1, 0, 'Bulk category upload processed', {
            vendorId, total: result.totalRows, success: result.successCount, failed: result.failedCount
        });

        return common.returnResult(true, 200, 'Bulk category upload processed', result);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    addCategory,
    updateCategory,
    softDeleteCategory,
    fetchActiveCategories,
    fetchAdminCategories,
    bulkUploadCategories
};