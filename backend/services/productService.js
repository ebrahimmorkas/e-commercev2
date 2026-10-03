const mongoose = require('mongoose');
const Product = require('../models/Product');
const ImageAsset = require('../models/ImageAsset');
const Category = require('../models/Category');
const categoryService = require('./categoryService');
const TaxMaster = require('../models/TaxMaster');
const SizeMaster = require('../models/SizeMaster');
const UnitMaster = require('../models/UnitMaster');
const WeightMaster = require('../models/WeightMaster');
const BrandMaster = require('../models/BrandMaster');
const brandMasterService = require('./brandMasterService');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const imageUploadService = require('./imageUploadService');
const counterService = require('./counterService');
const { extractZipEntries, createZipBuffer } = require('../utils/zipExtractor');
const { safeParseExcelSheet } = require('../utils/excelParser');
const { processExcelRows } = require('../utils/excelRowProcessor');
const { buildExcelTemplate } = require('../utils/excelTemplateBuilder');
const { createProductSchema, updateProductSchema } = require('../middlewares/validations/productValidations');
const slugify = require('../utils/slugify');
const crypto = require('crypto');
const path = require('path');
const common = require('../utils/common');
const logger = require('../utils/logger');

// Normalizes a size's `image` for reuse in a freshly-built plain object
// (e.g. carrying it forward across an update, see updateProduct below).
// A live Mongoose document's `.image` getter, when the stored value is
// absent (e.g. after a prior removal), returns an internal single-nested-
// subdocument wrapper whose plain value is null - passing that wrapper (or
// a literal null) into `new DocumentArray(...)` while reconstructing the
// parent `sizes` array throws "Cast to Object failed for value null",
// because subdocument construction (unlike a plain assignment on an
// already-built document) doesn't accept null. Returning `undefined`
// instead leaves the path genuinely unset, which construction handles fine.
const toPlainImage = (image) => (image && image.url ? { url: image.url, imageAssetId: image.imageAssetId } : undefined);

const isZipFile = (file) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    return ext === 'zip' || file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed';
};

// Multer's upload.any() returns one flat array of files, each carrying its
// original field name. Groups them back into
//   { [variantIndex]: { [sizeIndex]: { image, additionalImages } } }
// using the sizeImage_<v>_<s> / sizeAdditionalImages_<v>_<s> naming
// convention (v/s = that size's position inside body.variants[v].sizes[s]).
const groupSizeFiles = (files = []) => {
    const grouped = {};
    for (const file of files) {
        const mainMatch = file.fieldname.match(/^sizeImage_(\d+)_(\d+)$/);
        const addMatch = file.fieldname.match(/^sizeAdditionalImages_(\d+)_(\d+)$/);

        if (mainMatch) {
            const [, v, s] = mainMatch;
            grouped[v] = grouped[v] || {};
            grouped[v][s] = grouped[v][s] || {};
            grouped[v][s].image = file;
        } else if (addMatch) {
            const [, v, s] = addMatch;
            grouped[v] = grouped[v] || {};
            grouped[v][s] = grouped[v][s] || {};
            grouped[v][s].additionalImages = grouped[v][s].additionalImages || [];
            grouped[v][s].additionalImages.push(file);
        }
    }
    return grouped;
};

// The sizeAdditionalImages_<v>_<s> field accepts exactly ONE upload per
// size: either a single image (handled just like a normal image upload) or
// a single .zip containing many images (extracted into every entry it
// holds). Multiple individually-attached files under this field are not
// supported - send a zip instead when there's more than one image.
const resolveAdditionalImageFiles = (files = []) => {
    const file = files[0];

    if (isZipFile(file)) {
        const entries = extractZipEntries(file.buffer);
        const expanded = [];
        for (const [entryName, buffer] of entries.entries()) {
            expanded.push({
                buffer,
                originalname: entryName.split('/').pop(), // drop any folder path inside the zip
                mimetype: 'application/octet-stream', // real type is verified from bytes inside imageUploadService
                size: buffer.length
            });
        }
        return { files: expanded, isFromZip: true };
    }

    return { files: [file], isFromZip: false };
};

// Uploads a size's main image + additional images, from whatever files were
// submitted for that variant+size index.
//
// numberOfAdditionalImagesAllowedInVariant is enforced manually here (not via
// imageUploadService's built-in maxCountField) because that count check is
// scoped to vendorId+module globally, not per size. A vendor sending too many
// files DIRECTLY is rejected outright; a zip's contents are silently trimmed
// to the limit instead, and any unreadable/invalid entry inside a zip is
// skipped silently rather than failing the whole request - per the agreed
// behavior for zip uploads.
// Best-effort removal of images that were uploaded earlier in a request which
// then failed before the product they belong to was saved. Images are uploaded
// (to the storage provider AND an ImageAsset row) BEFORE the product is
// written, so without this every failed add would leave paid-for, unreferenced
// files behind. Never throws - cleanup must not mask the original failure.
const discardUploadedImages = async (imageAssetIds, userId) => {
    for (const imageId of imageAssetIds) {
        try {
            await imageUploadService.deleteImage({ imageId, userId });
        } catch (err) {
            logger.logWarning('productService - discardUploadedImages: could not remove an orphaned image', { imageId, error: err });
        }
    }
};

const applySizeImages = async ({
    vendorId, userId, sizeFiles, existingImage, existingAdditionalImages, companyMasterData, websiteMasterData,
    excludeProductId = null
}) => {
    const result = {};
    // ImageAssets created by THIS call (a replaced main image reuses its
    // existing asset, so it isn't listed). If anything below fails they are
    // removed again, and on success they're returned as `createdImageIds` so a
    // caller that fails later can do the same.
    const createdImageIds = [];

    try {
        return await applySizeImagesInner({
            vendorId, userId, sizeFiles, existingImage, existingAdditionalImages, companyMasterData, websiteMasterData,
            excludeProductId, result, createdImageIds
        });
    } catch (err) {
        await discardUploadedImages(createdImageIds, userId);
        throw err;
    }
};

const applySizeImagesInner = async ({
    vendorId, userId, sizeFiles, existingImage, existingAdditionalImages, companyMasterData, websiteMasterData,
    excludeProductId, result, createdImageIds
}) => {
    const fail = async (statusCode, message) => {
        await discardUploadedImages(createdImageIds, userId);
        return common.returnResult(false, statusCode, message);
    };

    // --- main image ----------------------------------------------------
    if (sizeFiles?.image) {
        const uploadResult = existingImage?.imageAssetId
            ? await imageUploadService.updateImage({
                imageId: existingImage.imageAssetId,
                file: sizeFiles.image,
                userId,
                maxSizeField: 'allowedProductImageMB',
                allowedFormatsField: 'allowedProductImagesFormat',
                companyMasterData,
                websiteMasterData
            })
            : await imageUploadService.uploadImage({
                vendorId,
                module: 'productSize',
                file: sizeFiles.image,
                userId,
                maxSizeField: 'allowedProductImageMB',
                allowedFormatsField: 'allowedProductImagesFormat',
                companyMasterData,
                websiteMasterData
            });

        if (!uploadResult.isSuccess) {
            return common.returnResult(false, uploadResult.statusCode, uploadResult.message);
        }
        result.image = { url: uploadResult.meta.image.url, imageAssetId: uploadResult.meta.image._id };
        if (!existingImage?.imageAssetId) createdImageIds.push(uploadResult.meta.image._id);
    }

    // --- additional images (one image OR one zip) -----------------------
    if (sizeFiles?.additionalImages?.length) {
        if (sizeFiles.additionalImages.length > 1) {
            return fail(400, 'Only one file is allowed for additional images per size - send a single image, or a single .zip containing multiple images.');
        }

        const { files: expandedFiles, isFromZip } = resolveAdditionalImageFiles(sizeFiles.additionalImages);
        const limit = companyMasterData.numberOfAdditionalImagesAllowedInVariant;

        if (!isFromZip && limit !== undefined && limit !== null && expandedFiles.length > limit) {
            return fail(403, `Only ${limit} additional image(s) allowed per size.`);
        }

        // Full replace, same semantics as the rest of this system.
        for (const old of (existingAdditionalImages || [])) {
            if (old.imageAssetId) {
                await deleteImageIfUnreferenced({ imageAssetId: old.imageAssetId, userId, excludeProductId });
            }
        }

        const uploaded = [];
        for (const file of expandedFiles) {
            if (limit !== undefined && limit !== null && uploaded.length >= limit) break; // zip case: stop at the cap, silently

            const uploadResult = await imageUploadService.uploadImage({
                vendorId,
                module: 'productSize',
                file,
                userId,
                maxSizeField: 'allowedProductImageMB',
                allowedFormatsField: 'allowedProductImagesFormat',
                companyMasterData,
                websiteMasterData
            });

            if (!uploadResult.isSuccess) {
                if (isFromZip) {
                    logger.logInfo(0, 1, 'Skipped invalid file inside zip', {
                        vendorId, fileName: file.originalname, reason: uploadResult.message
                    });
                    continue;
                }
                return fail(uploadResult.statusCode, uploadResult.message);
            }

            uploaded.push({ url: uploadResult.meta.image.url, imageAssetId: uploadResult.meta.image._id });
            createdImageIds.push(uploadResult.meta.image._id);
        }
        result.additionalImages = uploaded;
    }

    result.createdImageIds = createdImageIds;
    return common.returnResult(true, 200, 'All Good', result);
};

// ---------------------------------------------------------------------------
// Pass 2 helpers - product basic details (category, tax, recommendedProducts,
// bulkPricing gate, productCode, slug). Each returns common.returnResult()
// so createProduct can bail out early with a clean isSuccess/statusCode/message.
// ---------------------------------------------------------------------------

const validateCategories = async ({ vendorId, mainCategory, subCategory, companyMasterData }) => {
    try {
        if (!companyMasterData.isCategoryFeatureOn) {
            if (mainCategory || subCategory) {
                return common.returnResult(false, 403, 'Category feature is not enabled for your account.');
            }
            return common.returnResult(true, 200, 'All Good', { mainCategory: null, subCategory: null });
        }

        // A sub category only makes sense under a main one. (Joi's `.with()`
        // can't catch this - it treats an explicit `mainCategory: null` as
        // "present" - and silently dropping the sub category here would save a
        // product the admin didn't ask for.)
        if (!mainCategory && subCategory) {
            return common.returnResult(false, 400, 'Select a main category before choosing a sub category.');
        }

        if (!mainCategory) {
            return common.returnResult(true, 200, 'All Good', { mainCategory: null, subCategory: null });
        }

        const mainCategoryDoc = await Category.findOne({
            _id: mainCategory,
            vendorId,
            status: 'A'
        });
        if (!mainCategoryDoc) {
            return common.returnResult(false, 400, 'Main category not found for your account.');
        }
        if (mainCategoryDoc.parent_category_id !== null) {
            return common.returnResult(false, 400, 'Main category must be a top-level category.');
        }

        if (!subCategory) {
            return common.returnResult(true, 200, 'All Good', { mainCategory: mainCategoryDoc._id, subCategory: null });
        }

        if (!companyMasterData.isCategoryNestingAllowed) {
            return common.returnResult(false, 403, 'Sub category selection is not allowed for your account.');
        }

        if (subCategory === mainCategory) {
            return common.returnResult(false, 400, 'Sub category cannot be the same as main category.');
        }

        const subCategoryDoc = await Category.findOne({
            _id: subCategory,
            vendorId,
            status: 'A'
        });
        if (!subCategoryDoc) {
            return common.returnResult(false, 400, 'Sub category not found for your account.');
        }
        if (subCategoryDoc.parent_category_id === null) {
            return common.returnResult(false, 400, 'Sub category cannot itself be a top-level category.');
        }

        // Walk up the ancestor chain until the root (parent_category_id === null)
        // and confirm it matches the selected main category.
        let current = subCategoryDoc;
        const visited = new Set([current._id.toString()]);
        while (current.parent_category_id !== null) {
            const parent = await Category.findOne({ _id: current.parent_category_id, vendorId, status: 'A' });
            if (!parent) {
                return common.returnResult(false, 400, 'Sub category hierarchy is broken or contains an inactive category.');
            }
            if (visited.has(parent._id.toString())) {
                return common.returnResult(false, 400, 'Sub category hierarchy contains a cycle.');
            }
            visited.add(parent._id.toString());
            current = parent;
        }

        if (current._id.toString() !== mainCategoryDoc._id.toString()) {
            return common.returnResult(false, 400, 'Sub category does not belong under the selected main category.');
        }

        return common.returnResult(true, 200, 'All Good', { mainCategory: mainCategoryDoc._id, subCategory: subCategoryDoc._id });
    } catch (err) {
        throw err;
    }
};

const validateTaxIds = async ({ taxIds, companyMasterData }) => {
    try {
        if (!taxIds || taxIds.length === 0) {
            return common.returnResult(true, 200, 'All Good');
        }

        const now = new Date();
        const allowedCountryIds = new Set((companyMasterData.allowedCountries || []).map(id => id.toString()));

        const taxDocs = await TaxMaster.find({ _id: { $in: taxIds }, status: 'A' });
        const foundIds = new Set(taxDocs.map(doc => doc._id.toString()));

        const missing = taxIds.filter(id => !foundIds.has(id.toString()));
        if (missing.length > 0) {
            return common.returnResult(false, 400, `One or more taxes not found or inactive: ${missing.join(', ')}`);
        }

        for (const tax of taxDocs) {
            if (!allowedCountryIds.has(tax.countryId.toString())) {
                return common.returnResult(false, 403, `Tax "${tax.name}" is not applicable for your allowed countries.`);
            }
            if (tax.applicableFrom > now || (tax.applicableTo && tax.applicableTo < now)) {
                return common.returnResult(false, 400, `Tax "${tax.name}" is not currently valid.`);
            }
        }

        return common.returnResult(true, 200, 'All Good');
    } catch (err) {
        throw err;
    }
};

const validateRecommendedProducts = async ({ recommendedProducts, vendorId }) => {
    try {
        if (!recommendedProducts || recommendedProducts.length === 0) {
            return common.returnResult(true, 200, 'All Good');
        }

        // Fetched regardless of status so an Inactive/Deleted product gets a clear
        // message instead of being reported as "not found".
        const existing = await Product.find(
            { _id: { $in: recommendedProducts }, vendorId },
            { _id: 1, status: 1 }
        ).lean();
        const statusById = new Map(existing.map(doc => [doc._id.toString(), doc.status]));

        const missing = recommendedProducts.filter(id => !statusById.has(id.toString()));
        if (missing.length > 0) {
            return common.returnResult(false, 400, `One or more recommended products not found: ${missing.join(', ')}`);
        }

        const notActive = recommendedProducts.filter(id => statusById.get(id.toString()) !== 'A');
        if (notActive.length > 0) {
            return common.returnResult(false, 400, "Products with status I and D can't be added in recommended products list");
        }

        return common.returnResult(true, 200, 'All Good');
    } catch (err) {
        throw err;
    }
};

// A store with no CompanySettings document yet is a legitimate state (the
// settings endpoint itself returns a clean 404 for it), so the code-generation
// switches fall back to the same defaults the CompanySettings schema uses
// (auto-generate) instead of throwing on `null`.
const isCodeAutoGenerated = (companySettingsData, field) => companySettingsData?.[field] ?? true;

const resolveProductCode = async ({ vendorId, productCode, companySettingsData }) => {
    try {
        if (isCodeAutoGenerated(companySettingsData, 'isProductCodeAutoGenerated')) {
            if (productCode) {
                return common.returnResult(false, 400, 'Product code is auto-generated for your account and should not be provided.');
            }
            const nextValue = await counterService.getNextSequenceValue(vendorId, 'productCode');
            const generatedCode = `PRD-${String(nextValue).padStart(6, '0')}`;
            return common.returnResult(true, 200, 'All Good', { productCode: generatedCode });
        }

        if (!productCode) {
            return common.returnResult(false, 400, 'Product code is required.');
        }

        const normalizedCode = productCode.trim().toUpperCase();
        const existing = await Product.findOne({ vendorId, productCode: normalizedCode, status: { $ne: 'D' } });
        if (existing) {
            return common.returnResult(false, 409, 'Product code already exists.');
        }

        return common.returnResult(true, 200, 'All Good', { productCode: normalizedCode });
    } catch (err) {
        throw err;
    }
};

// name: unique per vendor, case-insensitive (DB has a matching collation
// index - this pre-check just gives a clean 409 instead of a raw duplicate-
// key error). excludeProductId (update only) keeps a product's own
// unchanged name from colliding with itself.
const resolveProductName = async ({ vendorId, name, excludeProductId = null }) => {
    try {
        const query = {
            vendorId,
            status: { $ne: 'D' },
            name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' }
        };
        if (excludeProductId) query._id = { $ne: excludeProductId };

        const existing = await Product.findOne(query);
        if (existing) {
            return common.returnResult(false, 409, `A product named "${name}" already exists.`);
        }

        return common.returnResult(true, 200, 'All Good');
    } catch (err) {
        throw err;
    }
};

const resolveVariantCode = async ({ vendorId, variantCode, companySettingsData, usedManualCodesInPayload }) => {
    try {
        if (isCodeAutoGenerated(companySettingsData, 'isVariantCodeAutoGenerated')) {
            if (variantCode) {
                return common.returnResult(false, 400, 'Variant code is auto-generated for your account and should not be provided.');
            }
            const nextValue = await counterService.getNextSequenceValue(vendorId, 'variantCode');
            const generatedCode = `VAR-${String(nextValue).padStart(6, '0')}`;
            return common.returnResult(true, 200, 'All Good', { variantCode: generatedCode });
        }

        if (!variantCode) {
            return common.returnResult(false, 400, 'Variant code is required.');
        }

        const normalizedCode = variantCode.trim().toUpperCase();

        if (usedManualCodesInPayload.has(normalizedCode)) {
            return common.returnResult(false, 400, `Variant code "${normalizedCode}" is used more than once in this request.`);
        }
        usedManualCodesInPayload.add(normalizedCode);

        // Global per-vendor uniqueness - across ALL of this vendor's products,
        // not scoped to just this one product.
        const existing = await Product.findOne({
            vendorId,
            status: { $ne: 'D' },
            'variants.variantCode': normalizedCode
        });
        if (existing) {
            return common.returnResult(false, 409, `Variant code "${normalizedCode}" already exists.`);
        }

        return common.returnResult(true, 200, 'All Good', { variantCode: normalizedCode });
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------------
// Pass 4 helpers - sizes (SizeMaster cross-reference, measurement/label
// value resolution, weight unit, geography exclusions, sku/barcode/sizeCode).
// ---------------------------------------------------------------------------

const resolveSizeCode = async ({ vendorId, sizeCode, companySettingsData, usedManualCodesInPayload }) => {
    try {
        if (isCodeAutoGenerated(companySettingsData, 'isSizeCodeAutoGenerated')) {
            if (sizeCode) {
                return common.returnResult(false, 400, 'Size code is auto-generated for your account and should not be provided.');
            }
            const nextValue = await counterService.getNextSequenceValue(vendorId, 'sizeCode');
            const generatedCode = `SIZ-${String(nextValue).padStart(6, '0')}`;
            return common.returnResult(true, 200, 'All Good', { sizeCode: generatedCode });
        }

        if (!sizeCode) {
            return common.returnResult(false, 400, 'Size code is required.');
        }

        const normalizedCode = sizeCode.trim().toUpperCase();

        if (usedManualCodesInPayload.has(normalizedCode)) {
            return common.returnResult(false, 400, `Size code "${normalizedCode}" is used more than once in this request.`);
        }
        usedManualCodesInPayload.add(normalizedCode);

        // Global per-vendor uniqueness - same scope as variantCode.
        const existing = await Product.findOne({
            vendorId,
            status: { $ne: 'D' },
            'variants.sizes.sizeCode': normalizedCode
        });
        if (existing) {
            return common.returnResult(false, 409, `Size code "${normalizedCode}" already exists.`);
        }

        return common.returnResult(true, 200, 'All Good', { sizeCode: normalizedCode });
    } catch (err) {
        throw err;
    }
};

const resolveSizeSku = async ({ vendorId, sku, usedManualSkusInPayload, excludeProductId = null }) => {
    try {
        const normalizedSku = sku.trim().toUpperCase();

        if (usedManualSkusInPayload.has(normalizedSku)) {
            return common.returnResult(false, 400, `SKU "${normalizedSku}" is used more than once in this request.`);
        }
        usedManualSkusInPayload.add(normalizedSku);

        // Vendor-wide uniqueness - across ALL of this vendor's products.
        // excludeProductId (update only) keeps a size's own unchanged sku
        // from colliding with itself.
        const query = {
            vendorId,
            status: { $ne: 'D' },
            'variants.sizes.sku': normalizedSku
        };
        if (excludeProductId) query._id = { $ne: excludeProductId };

        const existing = await Product.findOne(query);
        if (existing) {
            return common.returnResult(false, 409, `SKU "${normalizedSku}" already exists.`);
        }

        return common.returnResult(true, 200, 'All Good', { sku: normalizedSku });
    } catch (err) {
        throw err;
    }
};

const resolveSizeBarcode = async ({ barcode, usedManualBarcodesInPayload, excludeProductId = null }) => {
    try {
        if (!barcode) {
            return common.returnResult(true, 200, 'All Good', { barcode: undefined });
        }

        const normalizedBarcode = barcode.trim();

        if (usedManualBarcodesInPayload.has(normalizedBarcode)) {
            return common.returnResult(false, 400, `Barcode "${normalizedBarcode}" is used more than once in this request.`);
        }
        usedManualBarcodesInPayload.add(normalizedBarcode);

        // Globally unique across ALL vendors - deliberately not vendorId-scoped.
        // excludeProductId (update only) keeps a size's own unchanged
        // barcode from colliding with itself.
        const query = {
            status: { $ne: 'D' },
            'variants.sizes.barcode': normalizedBarcode
        };
        if (excludeProductId) query._id = { $ne: excludeProductId };

        const existing = await Product.findOne(query);
        if (existing) {
            return common.returnResult(false, 409, `Barcode "${normalizedBarcode}" already exists.`);
        }

        return common.returnResult(true, 200, 'All Good', { barcode: normalizedBarcode });
    } catch (err) {
        throw err;
    }
};

// Resolves + validates everything on a single size entry: SizeMaster
// cross-reference + plan gating, measurement/label value resolution against
// that SizeMaster doc, weight unit, geography exclusions, and sku/barcode/
// sizeCode. sizeMasterCache avoids refetching the same SizeMaster doc when
// the same sizeId repeats across sibling sizes/variants in one request.
const resolveSize = async ({
    vendorId, size, companyMasterData, websiteMasterData, companySettingsData,
    sizeMasterCache, usedManualSkusInPayload, usedManualBarcodesInPayload, usedManualSizeCodesInPayload,
    existingSize = null, excludeProductId = null
}) => {
    try {
        // --- SizeMaster cross-reference + plan gate ---------------------------
        let sizeMasterDoc = sizeMasterCache.get(size.sizeId);
        if (sizeMasterDoc === undefined) {
            sizeMasterDoc = await SizeMaster.findOne({ _id: size.sizeId, status: 'A' });
            sizeMasterCache.set(size.sizeId, sizeMasterDoc || null);
        }
        if (!sizeMasterDoc) {
            return common.returnResult(false, 400, 'Size not found or inactive.');
        }
        if (sizeMasterDoc.type !== size.sizeType) {
            return common.returnResult(false, 400, `Size type mismatch - "${sizeMasterDoc.name}" is a ${sizeMasterDoc.type} size.`);
        }

        const allowedSizeIds = new Set((companyMasterData.allowedSizes || []).map(id => id.toString()));
        if (!allowedSizeIds.has(size.sizeId.toString())) {
            return common.returnResult(false, 403, `Size "${sizeMasterDoc.name}" is not available on your plan.`);
        }

        // --- return / exchange feature gate -------------------------------------
        // A vendor can only turn return/exchange on for a size when both the
        // global (WebsiteMaster) and their own plan (CompanyMaster) switches
        // are on - same gate cartService/orderService check before honoring
        // a return/exchange request against an order.
        if (size.return?.isAvailable) {
            const returnFeatureCheck = await common.checkFeatureOnOrOff(
                vendorId, websiteMasterData, companyMasterData, 'isReturnFeatureOn', 'isReturnFeatureOn'
            );
            if (!returnFeatureCheck.isSuccess) {
                return common.returnResult(false, 403, `Return is not enabled for your account, so it can't be turned on for size "${sizeMasterDoc.name}".`);
            }
        }
        if (size.exchange?.isAvailable) {
            const exchangeFeatureCheck = await common.checkFeatureOnOrOff(
                vendorId, websiteMasterData, companyMasterData, 'isExchangeFeatureOn', 'isExchangeFeatureOn'
            );
            if (!exchangeFeatureCheck.isSuccess) {
                return common.returnResult(false, 403, `Exchange is not enabled for your account, so it can't be turned on for size "${sizeMasterDoc.name}".`);
            }
        }

        // --- MEASURABLE: validate each submitted measurement + unit -----------
        if (size.sizeType === 'MEASURABLE') {
            const measurementMap = new Map(
                sizeMasterDoc.measurements.map(m => [m._id.toString(), m])
            );

            const unitIdsToCheck = [...new Set(size.values.map(v => v.unit.toString()))];
            const activeUnits = await UnitMaster.find({ _id: { $in: unitIdsToCheck }, status: 'A' });
            const activeUnitIds = new Set(activeUnits.map(u => u._id.toString()));

            for (const entry of size.values) {
                const measurementDef = measurementMap.get(entry.measurementId.toString());
                if (!measurementDef) {
                    return common.returnResult(false, 400, `Invalid measurement for size "${sizeMasterDoc.name}".`);
                }
                if (!activeUnitIds.has(entry.unit.toString())) {
                    return common.returnResult(false, 400, `Unit provided for "${measurementDef.label}" not found or inactive.`);
                }
                const allowedUnitIds = new Set(measurementDef.allowedUnits.map(id => id.toString()));
                if (!allowedUnitIds.has(entry.unit.toString())) {
                    return common.returnResult(false, 400, `Unit provided for "${measurementDef.label}" is not allowed for that measurement.`);
                }
            }
        }

        // --- LABEL: validate the selected value against SizeMaster.values -----
        if (size.sizeType === 'LABEL') {
            const matchedValue = sizeMasterDoc.values.find(
                v => v.trim().toLowerCase() === size.labelValue.trim().toLowerCase()
            );
            if (!matchedValue) {
                return common.returnResult(false, 400, `"${size.labelValue}" is not a valid value for size "${sizeMasterDoc.name}".`);
            }
            // Normalize to the exact casing stored on the master.
            size.labelValue = matchedValue;
        }

        // --- weight unit -------------------------------------------------------
        if (size.weight) {
            const weightDoc = await WeightMaster.findOne({ _id: size.weight.unit, status: 'A' });
            if (!weightDoc) {
                return common.returnResult(false, 400, 'Weight unit not found or inactive.');
            }
            const allowedWeightIds = new Set((companyMasterData.allowedWeights || []).map(id => id.toString()));
            if (!allowedWeightIds.has(size.weight.unit.toString())) {
                return common.returnResult(false, 403, `Weight unit "${weightDoc.weightName}" is not available on your plan.`);
            }
        }

        // --- geography exclusions ----------------------------------------------
        const geoResult = await common.validateGeographyExclusions({
            excludeCountries: size.excludeCountries,
            excludeStates: size.excludeStates,
            excludeCities: size.excludeCities,
            allowedCountries: companyMasterData.allowedCountries
        });
        if (!geoResult.isSuccess) {
            return common.returnResult(false, geoResult.statusCode, geoResult.message);
        }

        // --- sku / barcode ----------------------------------------------------------
        // Editable even on an existing size, so uniqueness always runs -
        // excludeProductId (update only) prevents a size's own unchanged
        // value from colliding with itself.
        const skuResult = await resolveSizeSku({ vendorId, sku: size.sku, usedManualSkusInPayload, excludeProductId });
        if (!skuResult.isSuccess) {
            return common.returnResult(false, skuResult.statusCode, skuResult.message);
        }

        const barcodeResult = await resolveSizeBarcode({ barcode: size.barcode, usedManualBarcodesInPayload, excludeProductId });
        if (!barcodeResult.isSuccess) {
            return common.returnResult(false, barcodeResult.statusCode, barcodeResult.message);
        }

        // --- sizeCode -----------------------------------------------------------------
        // Immutable once set. For an existing size, always keep whatever is
        // already stored - silently ignore anything resubmitted in the
        // payload. Only genuinely NEW sizes (no existingSize match) go
        // through auto/manual code resolution.
        let resolvedSizeCode;
        if (existingSize) {
            resolvedSizeCode = existingSize.sizeCode;
        } else {
            const sizeCodeResult = await resolveSizeCode({
                vendorId, sizeCode: size.sizeCode, companySettingsData, usedManualCodesInPayload: usedManualSizeCodesInPayload
            });
            if (!sizeCodeResult.isSuccess) {
                return common.returnResult(false, sizeCodeResult.statusCode, sizeCodeResult.message);
            }
            resolvedSizeCode = sizeCodeResult.meta.sizeCode;
        }

        // --- brand ---------------------------------------------------------------
        // Optional - only gated/validated when the vendor actually picked one.
        // brandId must belong to THIS vendor's own BrandMaster list (each
        // vendor manages their own brands - there's no shared/allowed-list
        // gate the way SizeMaster has).
        if (size.brandId) {
            const brandFeatureCheck = await common.checkFeatureOnOrOff(
                vendorId, websiteMasterData, companyMasterData, 'isBrandFeatureOn', 'isBrandFeatureOn'
            );
            if (!brandFeatureCheck.isSuccess) {
                return common.returnResult(false, 403, `Brand selection is not enabled for your account.`);
            }

            const brandDoc = await BrandMaster.findOne({ _id: size.brandId, vendorId, status: 'A' });
            if (!brandDoc) {
                return common.returnResult(false, 400, `Selected brand not found or inactive.`);
            }
        }

        return common.returnResult(true, 200, 'All Good', {
            sku: skuResult.meta.sku,
            barcode: barcodeResult.meta.barcode,
            sizeCode: resolvedSizeCode,
            labelValue: size.labelValue
        });
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------------
// Bulk pricing chain validation (point 6). "Bounds" = the highest quantity
// covered and the cheapest price offered by a bulk pricing array, used as
// the base the next level down must continue from and undercut.
// ---------------------------------------------------------------------------

const getBulkPricingBounds = (bulkPricingArray) => {
    if (!bulkPricingArray || bulkPricingArray.length === 0) return null;
    return {
        maxQuantity: Math.max(...bulkPricingArray.map(b => b.maximumQuantity)),
        minPrice: Math.min(...bulkPricingArray.map(b => b.price))
    };
};

const validateAdditionalBulkPricingChain = (additionalArray, parentBounds, levelLabel) => {
    if (!additionalArray || additionalArray.length === 0) {
        return common.returnResult(true, 200, 'All Good');
    }
    if (!parentBounds) {
        return common.returnResult(true, 200, 'All Good');
    }

    const sorted = [...additionalArray].sort((a, b) => a.minimumQuantity - b.minimumQuantity);
    let expectedNextMin = parentBounds.maxQuantity + 1;

    for (const tier of sorted) {
        if (tier.minimumQuantity !== expectedNextMin) {
            return common.returnResult(false, 400, `${levelLabel} bulk pricing quantities must continue immediately after the previous tier - expected minimum quantity ${expectedNextMin}.`);
        }
        if (tier.price >= parentBounds.minPrice) {
            return common.returnResult(false, 400, `${levelLabel} bulk pricing price (${tier.price}) must be less than ${parentBounds.minPrice}.`);
        }
        expectedNextMin = tier.maximumQuantity + 1;
    }

    return common.returnResult(true, 200, 'All Good');
};

const generateUniqueSlug = async (vendorId, name, excludeProductId = null) => {
    try {
        const base = slugify(name);
        let candidate = base;
        let attempts = 0;

        const query = { vendorId, slug: candidate, status: { $ne: 'D' } };
        if (excludeProductId) query._id = { $ne: excludeProductId };

        while (await Product.findOne(query)) {
            candidate = `${base}-${crypto.randomBytes(3).toString('hex')}`;
            query.slug = candidate;
            attempts++;
            if (attempts > 5) {
                throw new Error('Unable to generate a unique slug after multiple attempts.');
            }
        }

        return candidate;
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------------
// Image reference-safety. Before cloning, every ImageAsset was always
// dedicated 1:1 to exactly one size (every upload path creates a brand-new
// ImageAsset - see applySizeImages). Cloning (below) is the first place an
// ImageAsset's url/imageAssetId is ever copied onto a SECOND size, so it can
// now be referenced by more than one product at once. These helpers make
// every existing image-deletion/deactivation call site in this file check
// that first, instead of unconditionally destroying/deactivating an asset
// another still-live product/size depends on.
// ---------------------------------------------------------------------------

// Whether any OTHER (non-deleted) product's size still references this
// ImageAsset. excludeProductId lets the product currently being
// deleted/updated exclude its own (soon to be gone) references from the
// check.
const isImageAssetStillReferenced = async ({ imageAssetId, excludeProductId = null }) => {
    try {
        const query = {
            status: { $ne: 'D' },
            $or: [
                { 'variants.sizes.image.imageAssetId': imageAssetId },
                { 'variants.sizes.additionalImages.imageAssetId': imageAssetId }
            ]
        };
        if (excludeProductId) query._id = { $ne: excludeProductId };

        const existing = await Product.findOne(query).select('_id');
        return !!existing;
    } catch (err) {
        throw err;
    }
};

// Only physically deletes + marks the ImageAsset 'D' when no other
// non-deleted product/size still points at it - otherwise leaves it
// completely untouched (still 'A', still live in storage).
const deleteImageIfUnreferenced = async ({ imageAssetId, userId, excludeProductId = null }) => {
    try {
        const stillReferenced = await isImageAssetStillReferenced({ imageAssetId, excludeProductId });
        if (stillReferenced) return;
        await imageUploadService.deleteImage({ imageId: imageAssetId, userId });
    } catch (err) {
        throw err;
    }
};

// Same guard as deleteImageIfUnreferenced, but deactivates ('I') instead of
// hard-deleting - used by toggleProductStatus's cascade below.
const deactivateImageIfUnreferenced = async ({ imageAssetId, userId, excludeProductId = null }) => {
    try {
        const stillReferenced = await isImageAssetStillReferenced({ imageAssetId, excludeProductId });
        if (stillReferenced) return;
        await common.setActiveStatusToFalse(ImageAsset, imageAssetId, userId);
    } catch (err) {
        throw err;
    }
};

// Reactivating a product's own images never needs the reference guard -
// setting an ImageAsset back to 'A' can never hurt any other referencer.
const reactivateImage = async ({ imageAssetId, userId }) => {
    try {
        await common.setActiveStatusToTrue(ImageAsset, imageAssetId, userId);
    } catch (err) {
        throw err;
    }
};

// Every distinct imageAssetId referenced across a product's variants/sizes
// (main image + additional images) - feeds the delete/toggle-status image
// cascades below.
const collectProductImageAssetIds = (product) => {
    const ids = [];
    for (const variant of (product.variants || [])) {
        for (const size of (variant.sizes || [])) {
            if (size.image?.imageAssetId) ids.push(size.image.imageAssetId);
            for (const additional of (size.additionalImages || [])) {
                if (additional.imageAssetId) ids.push(additional.imageAssetId);
            }
        }
    }
    return ids;
};

// Deletes every uploaded image (main + additional) belonging to one size
// doc - used when a size/variant is removed entirely during an update, so
// its Cloudinary assets don't become orphaned (unless another product,
// e.g. a clone, still references one of them).
const deleteAllImagesForSize = async (sizeDoc, userId, excludeProductId = null) => {
    if (sizeDoc.image?.imageAssetId) {
        await deleteImageIfUnreferenced({ imageAssetId: sizeDoc.image.imageAssetId, userId, excludeProductId });
    }
    for (const additional of (sizeDoc.additionalImages || [])) {
        if (additional.imageAssetId) {
            await deleteImageIfUnreferenced({ imageAssetId: additional.imageAssetId, userId, excludeProductId });
        }
    }
};

// ---------------------------------------------------------------------------
// Exported service functions
// ---------------------------------------------------------------------------

// The pre-checks above (name/sku/barcode/code/slug) are read-then-write, so two
// simultaneous requests can both pass them and only the unique index stops the
// second one. Turn that into what the pre-check would have said, instead of
// letting a raw E11000 escape as a 500. A slug collision is the one case that
// isn't the admin's fault (two different names can slugify the same), so it's
// retried with a fresh suffix rather than reported.
const saveNewProduct = async (product, name) => {
    const MAX_SLUG_RETRIES = 3;

    for (let attempt = 0; ; attempt++) {
        try {
            await product.save();
            return common.returnResult(true, 201, 'Product created successfully');
        } catch (err) {
            if (!err || err.code !== 11000) throw err;

            const conflictField = Object.keys(err.keyPattern || {}).find((key) => key !== 'vendorId') || '';
            const conflictValue = err.keyValue ? err.keyValue[conflictField] : undefined;

            if (conflictField === 'slug' && attempt < MAX_SLUG_RETRIES) {
                product.slug = `${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`;
                continue;
            }
            if (conflictField === 'name') {
                return common.returnResult(false, 409, `A product named "${name}" already exists.`);
            }
            if (conflictField === 'variants.sizes.sku') {
                return common.returnResult(false, 409, `SKU "${conflictValue}" already exists.`);
            }
            if (conflictField === 'variants.sizes.barcode') {
                return common.returnResult(false, 409, `Barcode "${conflictValue}" already exists.`);
            }
            return common.returnResult(false, 409, 'A product or variant code was just taken by another request. Please try again.');
        }
    }
};

const createProduct = async (vendorId, userId, companyMasterData, websiteMasterData, companySettingsData, body, files) => {
    try {
        // --- plan limit: total products allowed -------------------------------
        if (companyMasterData.numberOfProductsAllowed !== undefined && companyMasterData.numberOfProductsAllowed !== null) {
            const currentCount = await Product.countDocuments({ vendorId, status: { $ne: 'D' } });
            if (currentCount >= companyMasterData.numberOfProductsAllowed) {
                return common.returnResult(false, 403, `You have reached the maximum number of products (${companyMasterData.numberOfProductsAllowed}) allowed for your account.`);
            }
        }

        // --- category hierarchy -------------------------------------------------
        const categoryResult = await validateCategories({
            vendorId, mainCategory: body.mainCategory, subCategory: body.subCategory, companyMasterData
        });
        if (!categoryResult.isSuccess) {
            return common.returnResult(false, categoryResult.statusCode, categoryResult.message);
        }

        // --- name (unique per vendor) --------------------------------------------
        const nameResult = await resolveProductName({ vendorId, name: body.name });
        if (!nameResult.isSuccess) {
            return common.returnResult(false, nameResult.statusCode, nameResult.message);
        }

        // --- tax ids vs allowed countries + validity window ---------------------
        const taxResult = await validateTaxIds({ taxIds: body.taxIds, companyMasterData });
        if (!taxResult.isSuccess) {
            return common.returnResult(false, taxResult.statusCode, taxResult.message);
        }

        // --- recommended products -------------------------------------------------
        const recommendedResult = await validateRecommendedProducts({ recommendedProducts: body.recommendedProducts, vendorId });
        if (!recommendedResult.isSuccess) {
            return common.returnResult(false, recommendedResult.statusCode, recommendedResult.message);
        }

        // --- bulk pricing feature gate (product-level, variant-level, AND size-level) -
        const hasBulkPricing = (body.bulkPricing && body.bulkPricing.length > 0) ||
            (body.variants || []).some(v =>
                (v.variantAdditionalBulkPricing && v.variantAdditionalBulkPricing.length > 0) ||
                (v.sizes || []).some(s => s.sizeAdditionalBulkPricing && s.sizeAdditionalBulkPricing.length > 0)
            );

        if (hasBulkPricing) {
            const featureCheck = await common.checkFeatureOnOrOff(
                vendorId, websiteMasterData, companyMasterData,
                'isBulkPricingFeatureOn', 'isBulkPricingFeatureOn'
            );
            if (!featureCheck.isSuccess) {
                return common.returnResult(false, featureCheck.statusCode, `Bulk Pricing is not enabled for your plan. Therefore you can't add the product with bulk pricing.`);
            }
        }

        // --- plan limit: variants per product ---------------------------------------
        if (companyMasterData.numberOfProductsVaiantsAllowed !== undefined && companyMasterData.numberOfProductsVaiantsAllowed !== null) {
            if ((body.variants || []).length > companyMasterData.numberOfProductsVaiantsAllowed) {
                return common.returnResult(false, 403, `You can add a maximum of ${companyMasterData.numberOfProductsVaiantsAllowed} variant(s) per product.`);
            }
        }

        // --- product code (auto-generated or vendor-entered) -----------------------
        const productCodeResult = await resolveProductCode({ vendorId, productCode: body.productCode, companySettingsData });
        if (!productCodeResult.isSuccess) {
            return common.returnResult(false, productCodeResult.statusCode, productCodeResult.message);
        }

        // --- slug --------------------------------------------------------------------
        const slug = await generateUniqueSlug(vendorId, body.name);

        // TODO (next pass, ported from the old productService.js):
        //   - allowedSizes plan check per size.sizeId
        //   - numberOfProductsVaiantsAllowed
        //   - geography exclusion validation (excludeCountries/States/Cities)
        // All of it plugs in here, above where `variants` gets built below -
        // same order/shape as before, just re-applied to the new field names.

        const variants = [];
        const usedManualVariantCodesInPayload = new Set();
        const usedManualSizeCodesInPayload = new Set();
        const usedManualSkusInPayload = new Set();
        const usedManualBarcodesInPayload = new Set();
        const sizeMasterCache = new Map();

        // --- bulk pricing chain setup (point 6) --------------------------------
        const productBulkBounds = getBulkPricingBounds(body.bulkPricing);
        const productMaxBulkPrice = (body.bulkPricing && body.bulkPricing.length > 0)
            ? Math.max(...body.bulkPricing.map(b => b.price))
            : null;

        for (const variant of (body.variants || [])) {
            const variantCodeResult = await resolveVariantCode({
                vendorId,
                variantCode: variant.variantCode,
                companySettingsData,
                usedManualCodesInPayload: usedManualVariantCodesInPayload
            });
            if (!variantCodeResult.isSuccess) {
                return common.returnResult(false, variantCodeResult.statusCode, variantCodeResult.message);
            }

            // --- variant-level bulk pricing chain --------------------------------
            // Only chains off the product's tiers when this variant says its
            // bulk pricing is "same as product" - otherwise the chain is
            // broken here and nothing downstream (including sizes) is
            // constrained by product/variant bulk pricing at all.
            let variantBulkBounds = null;
            if (variant.isBulkPricingSameFromProductBasicDetails) {
                const variantChainResult = validateAdditionalBulkPricingChain(
                    variant.variantAdditionalBulkPricing, productBulkBounds, 'Variant additional'
                );
                if (!variantChainResult.isSuccess) {
                    return common.returnResult(false, variantChainResult.statusCode, variantChainResult.message);
                }
                const effectiveVariantArray = [
                    ...(body.bulkPricing || []),
                    ...(variant.variantAdditionalBulkPricing || [])
                ];
                variantBulkBounds = getBulkPricingBounds(effectiveVariantArray);
            }

            const resolvedSizes = [];
            for (const size of (variant.sizes || [])) {
                const sizeResult = await resolveSize({
                    vendorId, size, companyMasterData, websiteMasterData, companySettingsData,
                    sizeMasterCache, usedManualSkusInPayload, usedManualBarcodesInPayload, usedManualSizeCodesInPayload
                });
                if (!sizeResult.isSuccess) {
                    return common.returnResult(false, sizeResult.statusCode, sizeResult.message);
                }

                // --- size-level bulk pricing chain ---------------------------------
                // Only runs when BOTH levels above agreed to chain (variant
                // said "same as product" AND this size says "same as
                // variant"). If either link broke, size bulk pricing is free.
                if (variant.isBulkPricingSameFromProductBasicDetails && size.isBulkPricingSameFromVariantsDetails) {
                    const sizeChainResult = validateAdditionalBulkPricingChain(
                        size.sizeAdditionalBulkPricing, variantBulkBounds, 'Size additional'
                    );
                    if (!sizeChainResult.isSuccess) {
                        return common.returnResult(false, sizeChainResult.statusCode, sizeChainResult.message);
                    }
                }

                // --- size's own selling price vs product's bulk pricing ceiling ----
                // A single unit should never cost less than (or equal to) the
                // cheapest bulk tier already offered at the product level.
                if (variant.isBulkPricingSameFromProductBasicDetails && productMaxBulkPrice !== null) {
                    if (size.price <= productMaxBulkPrice) {
                        return common.returnResult(false, 400, `Size price (${size.price}) must be greater than the product's bulk pricing price (${productMaxBulkPrice}).`);
                    }
                }

                resolvedSizes.push({
                    ...size,
                    sku: sizeResult.meta.sku,
                    barcode: sizeResult.meta.barcode,
                    sizeCode: sizeResult.meta.sizeCode,
                    labelValue: sizeResult.meta.labelValue,
                    createdBy: userId,
                    status: 'A',
                    remarks: 'MANUAL'
                });
            }

            variants.push({
                ...variant,
                variantCode: variantCodeResult.meta.variantCode,
                createdBy: userId,
                status: 'A',
                remarks: 'MANUAL',
                sizes: resolvedSizes
            });
        }

        // Everything from here on uploads images BEFORE the product exists, so
        // every ImageAsset created by this request is tracked and removed again
        // unless the product actually gets saved (any failure path, including a
        // thrown error or a duplicate-key race, goes through the `finally`).
        const uploadedImageIds = [];
        let isSaved = false;

        try {
            // --- attach images, matched by variant+size array position --------
            const groupedFiles = groupSizeFiles(files);
            for (let v = 0; v < variants.length; v++) {
                for (let s = 0; s < variants[v].sizes.length; s++) {
                    const sizeFiles = groupedFiles[v]?.[s];
                    if (!sizeFiles) continue;

                    const imagesResult = await applySizeImages({
                        vendorId, userId, sizeFiles,
                        existingImage: null,
                        existingAdditionalImages: [],
                        companyMasterData, websiteMasterData
                    });
                    if (!imagesResult.isSuccess) {
                        return common.returnResult(false, imagesResult.statusCode, imagesResult.message);
                    }
                    uploadedImageIds.push(...(imagesResult.meta.createdImageIds || []));
                    if (imagesResult.meta.image) variants[v].sizes[s].image = imagesResult.meta.image;
                    if (imagesResult.meta.additionalImages) variants[v].sizes[s].additionalImages = imagesResult.meta.additionalImages;
                }
            }

            const product = new Product({
                ...body,
                mainCategory: categoryResult.meta.mainCategory,
                subCategory: categoryResult.meta.subCategory,
                productCode: productCodeResult.meta.productCode,
                slug,
                variants,
                vendorId,
                createdBy: userId,
                status: 'A',
                remarks: 'MANUAL'
            });

            const saveResult = await saveNewProduct(product, body.name);
            if (!saveResult.isSuccess) {
                return saveResult;
            }
            isSaved = true;

            logger.logInfo(1, 0, 'Product created successfully', { vendorId, productId: product._id });

            return common.returnResult(true, 201, 'Product created successfully', { product });
        } finally {
            if (!isSaved) {
                await discardUploadedImages(uploadedImageIds, userId);
            }
        }
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------------
// GET - response shaping (combine "sameFrom" data, resolve size-level
// location exclusions). Only exclusion/hiding logic differs between admin
// and client; the combine logic runs identically for both.
// ---------------------------------------------------------------------------

const GENERIC_EXCLUDE_TEXT = 'This size is not available in certain countries, states, cities, and zip codes.';

const combineArrays = (parentArray, additionalArray, sameFlag) => {
    if (sameFlag) {
        return [...(parentArray || []), ...(additionalArray || [])];
    }
    return [...(additionalArray || [])];
};

// disclaimer is a single string at every level, but the response always
// returns it as an array (even a single item) so the frontend can render it
// "points-wise" consistently regardless of how many levels contributed.
const combineDisclaimerArray = (parentArray, additionalDisclaimer, sameFlag) => {
    const additional = additionalDisclaimer ? [additionalDisclaimer] : [];
    if (sameFlag) {
        return [...(parentArray || []), ...additional];
    }
    return additional;
};

const buildLocationContext = async (locationCookies) => {
    const { countryId, stateId, cityId, zipCode } = locationCookies;
    if (!countryId && !stateId && !cityId && !zipCode) {
        return null;
    }
    const names = await common.resolveLocationNames({ countryId, stateId, cityId });
    return {
        countryId: countryId || null,
        countryName: names.countryName,
        stateId: stateId || null,
        stateName: names.stateName,
        cityId: cityId || null,
        cityName: names.cityName,
        zipCode: zipCode || null
    };
};

const findExclusionMatch = (size, locationContext) => {
    if (locationContext.countryId && (size.excludeCountries || []).some(id => id.toString() === locationContext.countryId)) {
        return { label: locationContext.countryName || 'your country' };
    }
    if (locationContext.stateId && (size.excludeStates || []).some(id => id.toString() === locationContext.stateId)) {
        return { label: locationContext.stateName || 'your state' };
    }
    if (locationContext.cityId && (size.excludeCities || []).some(id => id.toString() === locationContext.cityId)) {
        return { label: locationContext.cityName || 'your city' };
    }
    if (locationContext.zipCode && (size.excludeZipCodes || []).some(z => z === locationContext.zipCode)) {
        return { label: locationContext.zipCode };
    }
    return null;
};

// Returns { hide, excludeText } for one size. hide=true means omit the size
// from the response entirely; excludeText (when set) is displayed as-is by
// the frontend, no further computation needed there.
const resolveSizeVisibility = (size, locationContext, shouldHide) => {
    const hasExclusions =
        (size.excludeCountries?.length || 0) +
        (size.excludeStates?.length || 0) +
        (size.excludeCities?.length || 0) +
        (size.excludeZipCodes?.length || 0) > 0;

    if (!hasExclusions) {
        return { hide: false, excludeText: null };
    }

    // Anonymous visitor, or logged in with empty cookies - location unknown.
    if (!locationContext) {
        return { hide: false, excludeText: GENERIC_EXCLUDE_TEXT };
    }

    const match = findExclusionMatch(size, locationContext);
    if (!match) {
        return { hide: false, excludeText: null };
    }

    if (shouldHide) {
        return { hide: true, excludeText: null };
    }

    return { hide: false, excludeText: `This size is not present in ${match.label}.` };
};

const shapeSizeForResponse = (size, variantCombined, isAdmin, locationContext, shouldHide, brandMap, useShortNameForBrand) => {
    const description = combineArrays(variantCombined.description, size.sizeAdditionalDescription, size.isDescriptionSameFromVariantsDetails);
    const disclaimer = combineDisclaimerArray(variantCombined.disclaimer, size.sizeAdditionalDisclaimer, size.isDisclaimerSameFromVariantsDetails);
    const bulkPricing = combineArrays(variantCombined.bulkPricing, size.sizeAdditionalBulkPricing, size.isBulkPricingSameFromVariantsDetails);

    let visibility = { hide: false, excludeText: null };
    if (!isAdmin) {
        visibility = resolveSizeVisibility(size, locationContext, shouldHide);
        if (visibility.hide) return null;
    }

    return {
        _id: size._id,
        isDefaultSize: size.isDefaultSize,
        sizeType: size.sizeType,
        sizeName: size.sizeName,
        image: size.image,
        additionalImages: size.additionalImages,
        description,
        disclaimer,
        bulkPricing,
        warranty: size.warranty,
        return: size.return,
        exchange: size.exchange,
        shipping: size.shipping,
        precedence: size.precedence,
        // Admin gets the raw reference back (needed to pre-select the brand
        // dropdown when editing); a customer gets the already-resolved
        // display string (short name if the vendor opted into that and the
        // brand actually has one, else the full brand name - never null
        // when a brand is set).
        ...(isAdmin
            ? { brandId: size.brandId || null }
            : { brand: size.brandId ? brandMasterService.resolveBrandDisplayName(brandMap.get(size.brandId.toString()), useShortNameForBrand) : null }
        ),
        sizeId: size.sizeId,
        values: size.values,
        labelValue: size.labelValue,
        price: size.price,
        cancelledPrice: size.cancelledPrice,
        stock: size.stock,
        weight: size.weight,
        sku: size.sku,
        barcode: size.barcode,
        sizeCode: size.sizeCode,
        status: size.status,
        // Raw exclusion config is only useful to admin (for editing) - a
        // customer only needs the resolved excludeText, not the config that
        // produced it.
        ...(isAdmin ? {
            excludeCountries: size.excludeCountries,
            excludeStates: size.excludeStates,
            excludeCities: size.excludeCities,
            excludeZipCodes: size.excludeZipCodes
        } : {}),
        ...(visibility.excludeText ? { excludeText: visibility.excludeText } : {})
    };
};

const shapeVariantForResponse = (variant, productCombined, isAdmin, locationContext, shouldHide, brandMap, useShortNameForBrand) => {
    const description = combineArrays(productCombined.description, variant.variantAdditionalDescription, variant.isDescriptionSameFromProductBasicDetails);
    const disclaimer = combineDisclaimerArray(productCombined.disclaimer, variant.variantAdditionalDisclaimer, variant.isDisclaimerSameFromProductBasicDetails);
    const bulkPricing = combineArrays(productCombined.bulkPricing, variant.variantAdditionalBulkPricing, variant.isBulkPricingSameFromProductBasicDetails);

    const variantCombined = { description, disclaimer, bulkPricing };

    const shapedSizes = (variant.sizes || [])
        .map(size => shapeSizeForResponse(size, variantCombined, isAdmin, locationContext, shouldHide, brandMap, useShortNameForBrand))
        .filter(Boolean);

    // A variant with zero visible sizes has nothing purchasable left under
    // it - drop it from the client response. Admin always sees every
    // variant regardless.
    if (!isAdmin && shapedSizes.length === 0) {
        return null;
    }

    return {
        _id: variant._id,
        isDefaultVariant: variant.isDefaultVariant,
        color: variant.color,
        displayName: variant.displayName,
        variantCode: variant.variantCode,
        description,
        disclaimer,
        bulkPricing,
        sizes: shapedSizes,
        status: variant.status
    };
};

const shapeProductForResponse = (product, isAdmin, locationContext, shouldHide, brandMap = null, useShortNameForBrand = false) => {
    const productCombined = {
        description: product.description || [],
        disclaimer: product.disclaimer ? [product.disclaimer] : [],
        bulkPricing: product.bulkPricing || []
    };

    const shapedVariants = (product.variants || [])
        .map(variant => shapeVariantForResponse(variant, productCombined, isAdmin, locationContext, shouldHide, brandMap, useShortNameForBrand))
        .filter(Boolean);

    // Whole product has nothing purchasable left after exclusions - hide it
    // entirely from the client (point 4: hide the whole product only when
    // ALL of its sizes, across every variant, ended up excluded).
    if (!isAdmin && shapedVariants.length === 0) {
        return null;
    }

    return {
        _id: product._id,
        vendorId: product.vendorId,
        name: product.name,
        description: productCombined.description,
        colors: product.colors,
        mainCategory: product.mainCategory,
        subCategory: product.subCategory,
        disclaimer: productCombined.disclaimer,
        searchKeywords: product.searchKeywords,
        recommendedProducts: product.recommendedProducts,
        taxIds: product.taxIds,
        precedence: product.precedence,
        slug: product.slug,
        productCode: product.productCode,
        bulkPricing: productCombined.bulkPricing,
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        variants: shapedVariants
    };
};

// ---------------------------------------------------------------------------
// Exported GET functions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Paginated product lists
// ---------------------------------------------------------------------------
// The storefront and admin lists used to load and return EVERY product in one
// response, which stops working once a vendor has thousands of products (tens
// of MB per request, and the page renders thousands of cards). Every list now
// returns one page plus a `pagination` block. A page is resolved in two steps
// - first the ordered _ids of just that page, then those documents - so a
// computed sort (lowest price, precedence with blanks last) never has to sort
// whole product documents in memory.

const PRODUCT_LIST_LIMITS = {
    client: { defaultLimit: 24, maxLimit: 100, defaultSort: 'featured' },
    admin: { defaultLimit: 20, maxLimit: 100, defaultSort: 'newest' }
};
const PRODUCT_LIST_SORTS = ['featured', 'newest', 'price_asc', 'price_desc', 'name_asc'];
// Recommended-product lookups by id are small by nature; this caps a hand-crafted request.
const MAX_PRODUCT_IDS_PER_LOOKUP = 50;
const MAX_PRODUCT_OPTIONS = 50;

// Aggregation $match does no schema casting, so every id in a filter has to be a real ObjectId.
const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));

const normalizeListQuery = (query = {}, audience) => {
    const { defaultLimit, maxLimit, defaultSort } = PRODUCT_LIST_LIMITS[audience];
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    const sort = PRODUCT_LIST_SORTS.includes(query.sort) ? query.sort : defaultSort;
    const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
    return { page, limit, sort, q };
};

// Case-insensitive "contains" match. A customer searches what they can see
// (name, keywords, product code); the admin can also hit variant/size codes,
// SKUs and barcodes - the same fields the old client-side admin search covered.
// The admin can also find a product by a variant/size code, SKU or barcode.
// Those live in nested arrays, where a regex inside the main $or made every
// search scan every size of every product (over a second at 10k products).
// Instead they're matched as a case-sensitive PREFIX (as typed and
// upper-cased) in a separate, index-backed lookup, and the matching product
// ids join the $or.
const CODE_SEARCH_FIELDS = ['variants.variantCode', 'variants.sizes.sku', 'variants.sizes.barcode', 'variants.sizes.sizeCode'];
const MAX_CODE_SEARCH_MATCHES = 500;

const findProductIdsByCode = async (vendorId, status, q) => {
    const prefixes = [...new Set([q, q.toUpperCase()])].map((value) => new RegExp(`^${escapeRegex(value)}`));
    const matches = await Promise.all(CODE_SEARCH_FIELDS.map((field) =>
        Product.find({ vendorId, status, [field]: { $in: prefixes } }, { _id: 1 }).limit(MAX_CODE_SEARCH_MATCHES).lean()
    ));
    return [...new Map(matches.flat().map((doc) => [doc._id.toString(), doc._id])).values()];
};

const buildProductSearchFilter = async (q, audience, vendorId, status) => {
    if (!q) return null;
    const pattern = new RegExp(escapeRegex(q), 'i');
    const clauses = ['name', 'searchKeywords', 'productCode'].map((field) => ({ [field]: pattern }));

    // A shopper also types a brand ("Preciosa") or a category ("sequins"),
    // which products only reference by id - resolve the matching ids first.
    const [brands, categories] = await Promise.all([
        BrandMaster.find({ vendorId, status: 'A', $or: [{ brandName: pattern }, { brandShortName: pattern }] }, { _id: 1 }).lean(),
        Category.find({ vendorId, status: 'A', categoryName: pattern }, { _id: 1 }).lean()
    ]);
    if (brands.length > 0) clauses.push({ 'variants.sizes.brandId': { $in: brands.map((b) => b._id) } });
    if (categories.length > 0) {
        const categoryIds = categories.map((c) => c._id);
        clauses.push({ mainCategory: { $in: categoryIds } }, { subCategory: { $in: categoryIds } });
    }

    if (audience === 'admin') {
        const codeMatchIds = await findProductIdsByCode(vendorId, status, q);
        if (codeMatchIds.length > 0) clauses.push({ _id: { $in: codeMatchIds } });
    }
    return { $or: clauses };
};

// Sort keys computed per product (lowest / highest size price), for the
// sorts no plain index can serve.
const COMPUTED_SORT_KEYS = {
    price_asc: { $min: { $map: { input: '$variants', as: 'v', in: { $min: '$$v.sizes.price' } } } },
    price_desc: { $max: { $map: { input: '$variants', as: 'v', in: { $max: '$$v.sizes.price' } } } }
};

// "featured" = admin-set precedence first (1, 2, 3...), then products with
// no precedence, newest first. Two index-backed range reads (see the
// { vendorId, status, precedence, _id } index) rather than computing a sort
// key over every product, so the storefront's default sort - the landing
// page - costs the same at 10 or 50,000 products.
const findFeaturedPageIds = async (filter, skip, limit) => {
    const withPrecedence = { $and: [filter, { precedence: { $ne: null } }] };
    const withoutPrecedence = { $and: [filter, { precedence: null }] };
    const rankedCount = await Product.countDocuments(withPrecedence);

    const ids = [];
    if (skip < rankedCount) {
        const docs = await Product.find(withPrecedence, { _id: 1 }).sort({ precedence: 1, _id: -1 }).skip(skip).limit(limit).lean();
        ids.push(...docs.map((doc) => doc._id));
    }
    if (ids.length < limit) {
        const docs = await Product.find(withoutPrecedence, { _id: 1 })
            .sort({ _id: -1 })
            .skip(Math.max(0, skip - rankedCount))
            .limit(limit - ids.length)
            .lean();
        ids.push(...docs.map((doc) => doc._id));
    }
    return ids;
};

const findProductPageIds = async (filter, sort, skip, limit) => {
    if (sort === 'featured') {
        return findFeaturedPageIds(filter, skip, limit);
    }
    if (sort === 'newest') {
        const docs = await Product.find(filter, { _id: 1 }).sort({ _id: -1 }).skip(skip).limit(limit).lean();
        return docs.map((doc) => doc._id);
    }
    if (sort === 'name_asc') {
        const docs = await Product.find(filter, { _id: 1 })
            .collation({ locale: 'en', strength: 2 })
            .sort({ name: 1, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean();
        return docs.map((doc) => doc._id);
    }
    const rows = await Product.aggregate([
        { $match: filter },
        { $project: { sortKey: COMPUTED_SORT_KEYS[sort] } },
        { $sort: { sortKey: sort === 'price_desc' ? -1 : 1, _id: -1 } },
        { $skip: skip },
        { $limit: limit }
    ]);
    return rows.map((row) => row._id);
};

// Loads full documents for `ids` and returns them as plain objects in the same order.
const loadProductsInOrder = async (ids, extraFilter = {}) => {
    if (ids.length === 0) return [];
    const docs = await Product.find({ _id: { $in: ids }, ...extraFilter });
    const byId = new Map(docs.map((doc) => [doc._id.toString(), doc.toObject()]));
    return ids.map((id) => byId.get(id.toString())).filter(Boolean);
};

const shapeProductsForClient = async (rawProducts, companySettingsData, locationCookies) => {
    const shouldHide = companySettingsData?.shouldProductsBeHiddenWhenLocationsAreExcluded;
    const locationContext = await buildLocationContext(locationCookies);
    const brandMap = await buildBrandMapForProducts(rawProducts);
    const useShortNameForBrand = !!companySettingsData?.useShortNameForBrand;
    return rawProducts
        .map((p) => shapeProductForResponse(p, false, locationContext, shouldHide, brandMap, useShortNameForBrand))
        .filter(Boolean);
};

// One page of products. `extraFilter` narrows the list (a category, a brand).
// A storefront page can come back with fewer than `limit` products when the
// shopper's location excludes some of them - `total` counts before that
// per-location hiding, which only applies to products with exclusions set.
const fetchProductPage = async ({ vendorId, audience, query, extraFilter = null, companySettingsData = null, locationCookies = {} }) => {
    const { page, limit, sort, q } = normalizeListQuery(query, audience);

    let status = 'A';
    if (audience === 'admin') {
        status = ['A', 'I'].includes(query.status) ? query.status : { $in: ['A', 'I'] };
    }

    const clauses = [{ vendorId: toObjectId(vendorId), status }];
    if (extraFilter) clauses.push(extraFilter);
    const searchFilter = await buildProductSearchFilter(q, audience, toObjectId(vendorId), status);
    if (searchFilter) clauses.push(searchFilter);
    const filter = clauses.length === 1 ? clauses[0] : { $and: clauses };

    const [total, ids] = await Promise.all([
        Product.countDocuments(filter),
        findProductPageIds(filter, sort, (page - 1) * limit, limit)
    ]);
    const rawProducts = await loadProductsInOrder(ids);

    const products = audience === 'admin'
        ? rawProducts.map((p) => shapeProductForResponse(p, true, null, false))
        : await shapeProductsForClient(rawProducts, companySettingsData, locationCookies);

    return {
        products,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            hasMore: page * limit < total
        },
        sort,
        q
    };
};

// query: { page, limit, sort, q, status ('A' | 'I' | omitted = both) }
const fetchAllProductsForAdmin = async (vendorId, query = {}) => {
    try {
        const result = await fetchProductPage({ vendorId, audience: 'admin', query });
        return common.returnResult(true, 200, 'Products fetched successfully', result);
    } catch (err) {
        throw err;
    }
};

// Lightweight { _id, name, productCode, status } rows for admin pickers
// (recommended products, product groups) - searched server-side instead of
// shipping the whole catalogue to a dropdown. `ids` resolves the labels of
// already-selected products that a search wouldn't return.
// query: { q, ids: [ObjectId], status ('A' | 'I' | omitted = both), limit }
const fetchProductOptionsForAdmin = async (vendorId, query = {}) => {
    try {
        const status = ['A', 'I'].includes(query.status) ? query.status : { $in: ['A', 'I'] };
        const projection = { name: 1, productCode: 1, status: 1 };
        const ids = Array.isArray(query.ids) ? query.ids.slice(0, MAX_PRODUCT_IDS_PER_LOOKUP) : [];

        if (ids.length > 0) {
            const docs = await Product.find({ _id: { $in: ids }, vendorId, status: { $in: ['A', 'I'] } }, projection).lean();
            return common.returnResult(true, 200, 'Product options fetched successfully', { products: docs });
        }

        const limit = Math.min(MAX_PRODUCT_OPTIONS, Math.max(1, parseInt(query.limit, 10) || 20));
        const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
        const filter = { vendorId, status };
        if (q) {
            const pattern = new RegExp(escapeRegex(q), 'i');
            filter.$or = [{ name: pattern }, { productCode: pattern }];
        }
        const docs = await Product.find(filter, projection)
            .collation({ locale: 'en', strength: 2 })
            .sort({ name: 1 })
            .limit(limit)
            .lean();
        return common.returnResult(true, 200, 'Product options fetched successfully', { products: docs });
    } catch (err) {
        throw err;
    }
};

// Collects every distinct brandId referenced across a product's sizes and
// resolves them in ONE query, so shapeSizeForResponse can stay synchronous
// and just look the doc up from this map instead of hitting the DB per size.
const buildBrandMapForProducts = async (products) => {
    const brandIds = new Set();
    for (const product of products) {
        for (const variant of (product.variants || [])) {
            for (const size of (variant.sizes || [])) {
                if (size.brandId) brandIds.add(size.brandId.toString());
            }
        }
    }

    if (brandIds.size === 0) return new Map();

    const brandDocs = await BrandMaster.find({ _id: { $in: [...brandIds] } });
    return new Map(brandDocs.map(doc => [doc._id.toString(), doc]));
};

// query: { page, limit, sort, q } - or { ids } to resolve specific products
// (a product's recommendations), returned in the order given, unpaginated.
const fetchAllProductsForClient = async (vendorId, companySettingsData, locationCookies, query = {}) => {
    try {
        if (Array.isArray(query.ids) && query.ids.length > 0) {
            const ids = query.ids.slice(0, MAX_PRODUCT_IDS_PER_LOOKUP);
            const rawProducts = await loadProductsInOrder(ids, { vendorId, status: 'A' });
            const products = await shapeProductsForClient(rawProducts, companySettingsData, locationCookies);
            return common.returnResult(true, 200, 'Products fetched successfully', { products });
        }

        const result = await fetchProductPage({ vendorId, audience: 'client', query, companySettingsData, locationCookies });
        return common.returnResult(true, 200, 'Products fetched successfully', result);
    } catch (err) {
        throw err;
    }
};

// All ACTIVE products for this vendor that have at least one size tagged
// with the given brand. Matched products are returned in full (every
// variant/size, not just the ones carrying that brand) - same "whole
// product" behavior as browsing by category.
const fetchProductsByBrandForClient = async (vendorId, brandId, companySettingsData, locationCookies, query = {}) => {
    try {
        const brandDoc = await BrandMaster.findOne({ _id: brandId, vendorId, status: 'A' });
        if (!brandDoc) {
            return common.returnResult(false, 404, 'Brand not found.');
        }

        const result = await fetchProductPage({
            vendorId,
            audience: 'client',
            query,
            extraFilter: { 'variants.sizes.brandId': brandDoc._id },
            companySettingsData,
            locationCookies
        });
        return common.returnResult(true, 200, 'Products fetched successfully', { ...result, brandName: brandDoc.brandName });
    } catch (err) {
        throw err;
    }
};

// All ACTIVE products for this vendor that belong to the given category, or to any of
// its n-level nested subcategories (traversal only descends through ACTIVE
// subcategories - see categoryService.getActiveDescendantIds). A product's mainCategory
// is always a top-level (root) category and its subCategory (if any) can sit at any
// depth under that root, so matching on EITHER field against [category, ...descendants]
// correctly covers both root-level categories (caught via mainCategory) and nested
// subcategories (caught via subCategory) without needing to special-case either.
const fetchProductsByCategoryForClient = async (vendorId, categoryId, companySettingsData, locationCookies, query = {}) => {
    try {
        const categoryDoc = await Category.findOne({ _id: categoryId, vendorId, status: 'A' });
        if (!categoryDoc) {
            return common.returnResult(false, 404, 'Category not found.');
        }

        const descendantIds = await categoryService.getActiveDescendantIds(vendorId, categoryDoc._id);
        const categoryIds = [categoryDoc._id, ...descendantIds].map(toObjectId);

        const result = await fetchProductPage({
            vendorId,
            audience: 'client',
            query,
            extraFilter: {
                $or: [
                    { mainCategory: { $in: categoryIds } },
                    { subCategory: { $in: categoryIds } }
                ]
            },
            companySettingsData,
            locationCookies
        });
        return common.returnResult(true, 200, 'Products fetched successfully', { ...result, categoryName: categoryDoc.categoryName });
    } catch (err) {
        throw err;
    }
};

// Admin equivalent of fetchProductsByCategoryForClient - sees Active + Inactive
// categories/products (never Deleted), no location-based hiding/shaping.
const fetchProductsByCategoryForAdmin = async (vendorId, categoryId) => {
    try {
        const categoryDoc = await Category.findOne({ _id: categoryId, vendorId, status: { $ne: 'D' } });
        if (!categoryDoc) {
            return common.returnResult(false, 404, 'Category not found.');
        }

        const descendantIds = await categoryService.getDescendantIdsForAdmin(vendorId, categoryDoc._id);
        const categoryIds = [categoryDoc._id, ...descendantIds];

        const products = await common.getAll(Product, {
            status: { $in: ['I', 'A'] },
            $or: [
                { mainCategory: { $in: categoryIds } },
                { subCategory: { $in: categoryIds } }
            ]
        }, vendorId);

        const shaped = products.map(p => shapeProductForResponse(p.toObject(), true, null, false));
        return common.returnResult(true, 200, 'Products fetched successfully', { products: shaped });
    } catch (err) {
        throw err;
    }
};

const fetchProductByIdForAdmin = async (vendorId, productId) => {
    try {
        const result = await common.getByID(Product, productId);
        if (!result.success) {
            return common.returnResult(false, 404, result.message);
        }

        const product = result.document;
        if (product.vendorId.toString() !== vendorId.toString() || !['I', 'A'].includes(product.status)) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        const shaped = shapeProductForResponse(product.toObject(), true, null, false);

        // The edit form only offers Active products, and saving rejects I/D ones,
        // so a recommended product that has since gone Inactive/Deleted is
        // dropped here - otherwise the admin could never save this product.
        const recommendedIds = shaped.recommendedProducts || [];
        if (recommendedIds.length > 0) {
            const active = await Product.find(
                { _id: { $in: recommendedIds }, vendorId, status: 'A' },
                { _id: 1 }
            ).lean();
            const activeIds = new Set(active.map(doc => doc._id.toString()));
            shaped.recommendedProducts = recommendedIds.filter(recId => activeIds.has(recId.toString()));
        }

        return common.returnResult(true, 200, 'Product fetched successfully', { product: shaped });
    } catch (err) {
        throw err;
    }
};

const fetchProductByIdForClient = async (vendorId, productId, companySettingsData, locationCookies) => {
    try {
        const result = await common.getByID(Product, productId);
        if (!result.success) {
            return common.returnResult(false, 404, result.message);
        }

        const product = result.document;
        if (product.vendorId.toString() !== vendorId.toString() || product.status !== 'A') {
            return common.returnResult(false, 404, 'Product not found.');
        }

        const shouldHide = companySettingsData?.shouldProductsBeHiddenWhenLocationsAreExcluded;
        const locationContext = await buildLocationContext(locationCookies);

        const rawProduct = product.toObject();
        const brandMap = await buildBrandMapForProducts([rawProduct]);
        const useShortNameForBrand = !!companySettingsData.useShortNameForBrand;

        const shaped = shapeProductForResponse(rawProduct, false, locationContext, shouldHide, brandMap, useShortNameForBrand);
        if (!shaped) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        return common.returnResult(true, 200, 'Product fetched successfully', { product: shaped });
    } catch (err) {
        throw err;
    }
};

// =============================================================================
// BULK UPLOAD / BULK UPDATE (excel) - both read the same six-sheet workbook,
// assemble exactly the JSON body the Add/Edit Product form submits, validate
// it with the form's own Joi schema, and hand it to createProduct() /
// updateProduct(). So every rule the form enforces applies to a row as well,
// and a failure anywhere inside one product (any variant/size) fails that
// WHOLE product - createProduct()/updateProduct() save the nested tree
// atomically. Categories, brands, taxes and recommended products must
// pre-exist in the DB.
//
// Column config: `required` = the heading must be present on the sheet;
// `note`/`updateNote` feed the Instructions sheet of the downloadable sample;
// `updateOnly` = the column only means something to bulk update;
// `keptWhenBlank` = on bulk update a blank cell keeps the product's value.
// =============================================================================

// Typed into a product-level cell on bulk update to empty that field (a blank
// cell keeps the existing value instead).
const CLEAR_KEYWORD = 'CLEAR';

const KEEP_OR_CLEAR_NOTE = `Leave blank to keep the current value, or type ${CLEAR_KEYWORD} to empty it.`;
const TRUE_FALSE_NOTE = 'TRUE or FALSE.';

const PRODUCT_SHEET_COLUMNS = [
    { key: 'productTempCode', header: 'ProductTempCode*', required: true, note: 'Any code of your own (e.g. P1), unique in this file. Only used to link rows on the other sheets to this product - it is never saved.' },
    { key: 'name', header: 'Name*', required: true, note: 'Product name. Must not already exist.', updateNote: 'Must match the name of an existing product (upper/lower case is ignored) - this is how the product to update is found. The name itself is not changed.' },
    { key: 'colors', header: 'Colors*', required: true, keptWhenBlank: true, note: 'Comma-separated list, e.g. Red, Blue. At least one color.', updateNote: 'Leave blank to keep the current colors.' },
    { key: 'categoryPath', header: 'CategoryPath', required: false, keptWhenBlank: true, note: 'Optional. An existing category path separated by ">", e.g. Men > Shirts > Formal. The first part is the main category and the last part the sub category; a single part (e.g. Men) selects a main category only.', updateNote: KEEP_OR_CLEAR_NOTE },
    { key: 'disclaimer', header: 'Disclaimer', required: false, keptWhenBlank: true, note: 'Optional text.', updateNote: KEEP_OR_CLEAR_NOTE },
    { key: 'searchKeywords', header: 'SearchKeywords', required: false, keptWhenBlank: true, note: 'Optional comma-separated list.', updateNote: KEEP_OR_CLEAR_NOTE },
    { key: 'recommendedProductCodes', header: 'RecommendedProductCodes', required: false, keptWhenBlank: true, note: 'Optional comma-separated product codes of existing active products.', updateNote: KEEP_OR_CLEAR_NOTE },
    { key: 'taxCodes', header: 'TaxCodes', required: false, keptWhenBlank: true, note: 'Optional comma-separated tax codes.', updateNote: KEEP_OR_CLEAR_NOTE },
    { key: 'precedence', header: 'Precedence', required: false, keptWhenBlank: true, note: 'Optional whole number, 1 or more.', updateNote: 'Leave blank to keep the current value.' },
    { key: 'productCode', header: 'ProductCode', required: false, note: 'Only when product codes are entered manually in your company settings; leave blank when they are auto-generated.', updateNote: 'Ignored - a product code never changes.' }
];

const VARIANT_SHEET_COLUMNS = [
    { key: 'variantTempCode', header: 'VariantTempCode*', required: true, note: 'Any code of your own (e.g. V1), unique in this file. Links the Sizes sheet rows to this variant - never saved.' },
    { key: 'productTempCode', header: 'ProductTempCode*', required: true, note: 'The ProductTempCode of the product this variant belongs to.' },
    { key: 'isDefaultVariant', header: 'IsDefaultVariant*', required: true, note: `${TRUE_FALSE_NOTE} Only one variant per product can be TRUE.` },
    { key: 'color', header: 'Color', required: false, note: 'Optional. Must be exactly one of the product\'s Colors, and no two variants of a product can share a color.' },
    { key: 'displayName', header: 'DisplayName', required: false, note: 'Optional name shown for this variant.' },
    { key: 'isDescriptionSameFromProductBasicDetails', header: 'IsDescriptionSameFromProductBasicDetails*', required: true, note: `${TRUE_FALSE_NOTE} TRUE = the variant shows the product description plus its own additional rows.` },
    { key: 'isDisclaimerSameFromProductBasicDetails', header: 'IsDisclaimerSameFromProductBasicDetails*', required: true, note: `${TRUE_FALSE_NOTE} TRUE = the variant shows the product disclaimer plus its own additional one.` },
    { key: 'isBulkPricingSameFromProductBasicDetails', header: 'IsBulkPricingSameFromProductBasicDetails*', required: true, note: `${TRUE_FALSE_NOTE} TRUE = the variant continues the product bulk pricing with its own additional tiers.` },
    { key: 'variantAdditionalDisclaimer', header: 'VariantAdditionalDisclaimer', required: false, note: 'Optional text.' },
    { key: 'variantCode', header: 'VariantCode', required: false, note: 'Only when variant codes are entered manually in your company settings; leave blank when they are auto-generated.', updateNote: 'The code of an existing variant of the product updates that variant. Blank (or a code the product does not have) adds a new variant. An existing variant that is not listed is removed.' }
];

const SIZE_SHEET_COLUMNS = [
    { key: 'sizeTempCode', header: 'SizeTempCode*', required: true, note: 'Any code of your own (e.g. S1), unique in this file. Links MeasurementValues / Descriptions / BulkPricing rows to this size - never saved.' },
    { key: 'variantTempCode', header: 'VariantTempCode*', required: true, note: 'The VariantTempCode of the variant this size belongs to.' },
    { key: 'isDefaultSize', header: 'IsDefaultSize*', required: true, note: `${TRUE_FALSE_NOTE} Only one size per variant can be TRUE.` },
    { key: 'sizeType', header: 'SizeType*', required: true, note: 'MEASURABLE or LABEL - must match the type of the size in SizeMasterName.' },
    { key: 'sizeMasterName', header: 'SizeMasterName*', required: true, note: 'Name of a size (from the size list of the product form) that is available on your plan.' },
    { key: 'sizeName', header: 'SizeName*', required: true, note: 'The size name your customers see.' },
    { key: 'labelValue', header: 'LabelValue', required: false, note: 'Required for a LABEL size: one of that size\'s values (e.g. S, M, L). Leave blank for a MEASURABLE size.' },
    { key: 'brand', header: 'Brand', required: false, note: 'Optional. Name of one of your active brands.' },
    { key: 'price', header: 'Price*', required: true, note: 'Selling price, 0 or more. Must be less than CancelledPrice when that is filled.' },
    { key: 'cancelledPrice', header: 'CancelledPrice', required: false, note: 'Optional struck-through price; must be more than Price.' },
    { key: 'stock', header: 'Stock', required: false, note: 'Optional whole number, 0 or more. Blank = 0.' },
    { key: 'weightValue', header: 'WeightValue', required: false, note: 'Optional number, 0 or more.' },
    { key: 'weightUnitName', header: 'WeightUnitName', required: false, note: 'Required when WeightValue is filled: name of a weight unit available on your plan.' },
    { key: 'sku', header: 'SKU*', required: true, note: 'Unique across all of your products.' },
    { key: 'barcode', header: 'Barcode', required: false, note: 'Optional. Must be unique.' },
    { key: 'sizeCode', header: 'SizeCode', required: false, note: 'Only when size codes are entered manually in your company settings; leave blank when they are auto-generated.', updateNote: 'The code of an existing size of that variant updates that size. Blank (or a code the variant does not have) adds a new size. An existing size that is not listed is removed.' },
    { key: 'isDescriptionSameFromVariantsDetails', header: 'IsDescriptionSameFromVariantsDetails*', required: true, note: `${TRUE_FALSE_NOTE} TRUE = the size shows the variant description plus its own additional rows.` },
    { key: 'isDisclaimerSameFromVariantsDetails', header: 'IsDisclaimerSameFromVariantsDetails*', required: true, note: `${TRUE_FALSE_NOTE} TRUE = the size shows the variant disclaimer plus its own additional one.` },
    { key: 'isBulkPricingSameFromVariantsDetails', header: 'IsBulkPricingSameFromVariantsDetails*', required: true, note: `${TRUE_FALSE_NOTE} TRUE = the size continues the variant bulk pricing with its own additional tiers.` },
    { key: 'sizeAdditionalDisclaimer', header: 'SizeAdditionalDisclaimer', required: false, note: 'Optional text.' },
    { key: 'excludeCountries', header: 'ExcludeCountries', required: false, note: 'Optional comma-separated country names where this size is not sold.' },
    { key: 'excludeStates', header: 'ExcludeStates', required: false, note: 'Optional comma-separated state names.' },
    { key: 'excludeCities', header: 'ExcludeCities', required: false, note: 'Optional comma-separated city names.' },
    { key: 'excludeZipCodes', header: 'ExcludeZipCodes', required: false, note: 'Optional comma-separated zip codes.' },
    { key: 'precedence', header: 'Precedence', required: false, note: 'Optional whole number, 1 or more.' },
    { key: 'warrantyAvailable', header: 'WarrantyAvailable*', required: true, note: TRUE_FALSE_NOTE },
    { key: 'warrantyDuration', header: 'WarrantyDuration', required: false, note: 'Required when WarrantyAvailable is TRUE: a number.' },
    { key: 'warrantyDurationType', header: 'WarrantyDurationType', required: false, note: 'Required when WarrantyAvailable is TRUE: DAYS, MONTHS or YEARS.' },
    { key: 'returnAvailable', header: 'ReturnAvailable*', required: true, note: `${TRUE_FALSE_NOTE} TRUE needs the Return feature on your plan.` },
    { key: 'returnDuration', header: 'ReturnDuration', required: false, note: 'Required when ReturnAvailable is TRUE: a number.' },
    { key: 'returnDurationType', header: 'ReturnDurationType', required: false, note: 'Required when ReturnAvailable is TRUE: DAYS, MONTHS or YEARS.' },
    { key: 'exchangeAvailable', header: 'ExchangeAvailable*', required: true, note: `${TRUE_FALSE_NOTE} TRUE needs the Exchange feature on your plan.` },
    { key: 'exchangeDuration', header: 'ExchangeDuration', required: false, note: 'Required when ExchangeAvailable is TRUE: a number.' },
    { key: 'exchangeDurationType', header: 'ExchangeDurationType', required: false, note: 'Required when ExchangeAvailable is TRUE: DAYS, MONTHS or YEARS.' },
    { key: 'shippingType', header: 'ShippingType*', required: true, note: 'COMPANY_SETTINGS (use your store\'s shipping price) or CUSTOM.' },
    { key: 'shippingValue', header: 'ShippingValue', required: false, note: 'Required for CUSTOM: the shipping amount. Leave blank for COMPANY_SETTINGS.' },
    { key: 'mainImageFileName', header: 'MainImageFileName', required: false, note: 'Optional. File name (with its folder, if any) of this size\'s main image inside the main images zip.', updateNote: 'Leave blank to keep the current image.' },
    { key: 'additionalImageFileNames', header: 'AdditionalImageFileNames', required: false, note: 'Optional comma-separated file names inside the additional images zip.', updateNote: 'Leave blank to keep the current images; when filled, they replace the current ones.' },
    { key: 'removeMainImage', header: 'RemoveMainImage', required: false, updateOnly: true, note: `${TRUE_FALSE_NOTE} TRUE removes the size's current main image. Ignored when MainImageFileName is filled.` },
    { key: 'removeAdditionalImages', header: 'RemoveAdditionalImages', required: false, updateOnly: true, note: `${TRUE_FALSE_NOTE} TRUE removes all of the size's current additional images. Ignored when AdditionalImageFileNames is filled.` }
];

const MEASUREMENT_VALUE_SHEET_COLUMNS = [
    { key: 'sizeTempCode', header: 'SizeTempCode*', required: true, note: 'The SizeTempCode of a MEASURABLE size. Add one row per measurement of that size.' },
    { key: 'measurementLabel', header: 'MeasurementLabel*', required: true, note: 'A measurement of that size, e.g. Length.' },
    { key: 'unitName', header: 'UnitName*', required: true, note: 'A unit allowed for that measurement, e.g. cm.' },
    { key: 'value', header: 'Value*', required: true, note: 'A number.' }
];

const DESCRIPTION_SHEET_COLUMNS = [
    { key: 'level', header: 'Level*', required: true, note: 'product, variant or size.' },
    { key: 'refTempCode', header: 'RefTempCode*', required: true, note: 'The ProductTempCode / VariantTempCode / SizeTempCode this row belongs to.', updateNote: 'A product with no "product" rows here keeps its current description; when it has any, they replace the current description.' },
    { key: 'key', header: 'Key*', required: true, note: 'Description heading, e.g. Material. Unique within the same product / variant / size.' },
    { key: 'value', header: 'Value*', required: true, note: 'Description text, e.g. Cotton.' }
];

const BULK_PRICING_SHEET_COLUMNS = [
    { key: 'level', header: 'Level*', required: true, note: 'product, variant or size. Needs the Bulk Pricing feature on your plan.' },
    { key: 'refTempCode', header: 'RefTempCode*', required: true, note: 'The ProductTempCode / VariantTempCode / SizeTempCode this tier belongs to.', updateNote: 'A product with no "product" rows here keeps its current bulk pricing; when it has any, they replace the current tiers.' },
    { key: 'minimumQuantity', header: 'MinimumQuantity*', required: true, note: 'A number, 1 or more.' },
    { key: 'maximumQuantity', header: 'MaximumQuantity*', required: true, note: 'A number greater than MinimumQuantity.' },
    { key: 'price', header: 'Price*', required: true, note: 'Price per unit for this quantity range.' }
];

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Excel hands a cell back as whatever type it was typed as (a SKU of 1001 or
// a temp code of 1 arrives as a Number), so every text cell goes through
// these instead of being used - or .trim()'d - directly.
const cellText = (val) => (val === null || val === undefined ? '' : String(val).trim());
const textOrUndefined = (val) => cellText(val) || undefined;
const numberOrUndefined = (val) => (cellText(val) === '' ? undefined : Number(val));
const isBlankCell = (val) => cellText(val) === '';
const isClearCell = (val) => cellText(val).toUpperCase() === CLEAR_KEYWORD;

const parseBoolean = (val) => {
    if (typeof val === 'boolean') return val;
    const s = cellText(val).toLowerCase();
    if (s === 'true' || s === 'yes') return true;
    if (s === 'false' || s === 'no') return false;
    return undefined;
};

const parseCsv = (val) => cellText(val).split(',').map(s => s.trim()).filter(Boolean);

// The six sheets of a bulk product upload/update workbook. A missing sheet or
// column, or a file that isn't an .xlsx, comes back as { ok: false, message }
// (a 400 for the admin to fix) instead of being thrown into the error page.
const PRODUCT_WORKBOOK_SHEETS = [
    { key: 'productRows', sheetName: 'Products', columns: () => PRODUCT_SHEET_COLUMNS },
    { key: 'variantRows', sheetName: 'Variants', columns: () => VARIANT_SHEET_COLUMNS },
    { key: 'sizeRows', sheetName: 'Sizes', columns: () => SIZE_SHEET_COLUMNS },
    { key: 'measurementValueRows', sheetName: 'MeasurementValues', columns: () => MEASUREMENT_VALUE_SHEET_COLUMNS },
    { key: 'descriptionRows', sheetName: 'Descriptions', columns: () => DESCRIPTION_SHEET_COLUMNS },
    { key: 'bulkPricingRows', sheetName: 'BulkPricing', columns: () => BULK_PRICING_SHEET_COLUMNS }
];

const parseProductWorkbook = async (excelBuffer) => {
    try {
        const sheets = {};
        for (const sheet of PRODUCT_WORKBOOK_SHEETS) {
            const parsed = await safeParseExcelSheet(excelBuffer, sheet.columns(), { sheetName: sheet.sheetName });
            if (!parsed.ok) return { ok: false, message: parsed.message };
            sheets[sheet.key] = parsed.rows;
        }
        return { ok: true, ...sheets };
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| EXCEL SAMPLE FILE
|--------------------------------------------------------------------------
| The six sheets with just their heading rows (so an untouched sample is
| reported as "no rows"), plus an Instructions sheet - which neither upload
| reads - explaining every column for the given mode ('upload' | 'update').
*/

const BULK_SAMPLE_GENERAL_NOTES = {
    upload: [
        'Every row of the Products sheet adds one new product. A product needs at least one row on the Variants sheet, and every variant at least one row on the Sizes sheet.',
        'Rows are linked through the TempCode columns: a Variants row names its product\'s ProductTempCode, a Sizes row names its variant\'s VariantTempCode.',
        'If anything is wrong with a product, one of its variants or one of its sizes, that whole product is skipped and reported; the other products are still added.',
        'Images: put the image files in a zip and write each file name in MainImageFileName / AdditionalImageFileNames on the Sizes sheet.'
    ],
    update: [
        'Every row of the Products sheet updates one EXISTING product, found by its Name. A name that matches no product is skipped and reported.',
        `Products sheet: a blank cell keeps the product's current value. Type ${CLEAR_KEYWORD} to empty a field (not possible for Colors and Precedence).`,
        'Variants and Sizes sheets describe the COMPLETE list for the product: list every variant and size you want to keep, with all of its columns filled. One that is not listed is removed.',
        'A variant / size is matched to the existing one by VariantCode / SizeCode. Leave the code blank to add a new variant / size.',
        'If anything is wrong with a product, one of its variants or one of its sizes, that whole product is left unchanged and reported; the other products are still updated.'
    ]
};

const buildBulkProductSampleFile = async (mode) => {
    try {
        const isUpdate = mode === 'update';

        const sheets = PRODUCT_WORKBOOK_SHEETS.map((sheet) => ({
            name: sheet.sheetName,
            columns: sheet.columns().filter((column) => isUpdate || !column.updateOnly)
        }));

        const instructionRows = BULK_SAMPLE_GENERAL_NOTES[isUpdate ? 'update' : 'upload'].map((note) => ['General', '', '', note]);
        for (const sheet of sheets) {
            for (const column of sheet.columns) {
                const isValueRequired = column.required && !(isUpdate && column.keptWhenBlank);
                const note = isUpdate && column.updateNote ? `${column.note} ${column.updateNote}` : column.note;
                instructionRows.push([sheet.name, column.header, isValueRequired ? 'Yes' : 'No', note]);
            }
        }

        const buffer = await buildExcelTemplate({
            sheets: [
                ...sheets.map((sheet) => ({
                    name: sheet.name,
                    columns: sheet.columns.map((column) => ({ header: column.header, width: Math.max(18, column.header.length + 4) }))
                })),
                {
                    name: 'Instructions',
                    columns: [
                        { header: 'Sheet', width: 20 },
                        { header: 'Column', width: 46 },
                        { header: 'Required', width: 12 },
                        { header: 'What to enter', width: 140 }
                    ],
                    rows: instructionRows
                }
            ]
        });

        return common.returnResult(true, 200, 'Sample file generated', {
            buffer,
            fileName: isUpdate ? 'product-bulk-update-sample.xlsx' : 'product-bulk-upload-sample.xlsx'
        });
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| WORKBOOK -> FORM PAYLOAD (shared by bulk upload and bulk update)
|--------------------------------------------------------------------------
| The helpers below report a problem the admin can fix as { error: '...' }
| (it becomes that product row's failure message); anything else is thrown.
*/

const groupRowsBy = (rows, getKey) => {
    try {
        const grouped = new Map();
        for (const row of rows) {
            const key = getKey(row);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(row);
        }
        return grouped;
    } catch (err) {
        throw err;
    }
};

// Parses the workbook + image zips once per request and indexes the child
// sheets by the temp code that links them to their parent. A problem with the
// files themselves comes back as a 400 result; meta = { productRows, ctx }.
const prepareBulkProductRun = async ({ vendorId, excelBuffer, mainImagesZipBuffer, additionalImagesZipBuffer, companyMasterData }) => {
    try {
        const workbook = await parseProductWorkbook(excelBuffer);
        if (!workbook.ok) {
            return common.returnResult(false, 400, workbook.message);
        }
        if (workbook.productRows.length === 0) {
            return common.returnResult(false, 400, 'Products sheet contains no data rows');
        }

        let mainImageEntries, additionalImageEntries;
        try {
            mainImageEntries = mainImagesZipBuffer ? extractZipEntries(mainImagesZipBuffer) : new Map();
            additionalImageEntries = additionalImagesZipBuffer ? extractZipEntries(additionalImagesZipBuffer) : new Map();
        } catch (err) {
            return common.returnResult(false, 400, `Could not read image zip file(s): ${err.message}`);
        }

        const levelRefKey = (row) => `${cellText(row.level).toLowerCase()}::${cellText(row.refTempCode)}`;

        const ctx = {
            vendorId,
            companyMasterData,
            mainImageEntries,
            additionalImageEntries,
            variantsByProduct: groupRowsBy(workbook.variantRows, (row) => cellText(row.productTempCode)),
            sizesByVariant: groupRowsBy(workbook.sizeRows, (row) => cellText(row.variantTempCode)),
            measurementValuesBySize: groupRowsBy(workbook.measurementValueRows, (row) => cellText(row.sizeTempCode)),
            descriptionsByRef: groupRowsBy(workbook.descriptionRows, levelRefKey),
            bulkPricingByRef: groupRowsBy(workbook.bulkPricingRows, levelRefKey),
            lookupCache: new Map(),
            categoryPathCache: new Map()
        };

        return common.returnResult(true, 200, 'All Good', { productRows: workbook.productRows, ctx });
    } catch (err) {
        throw err;
    }
};

// Master records a workbook names instead of sending an id. Brand is
// vendor-scoped (the same brand name may exist for another vendor without
// matching); the rest are shared masters.
const BULK_NAME_LOOKUPS = {
    sizeMaster: (ctx, name) => SizeMaster.findOne({ status: 'A', name }),
    brand: (ctx, name) => BrandMaster.findOne({ vendorId: ctx.vendorId, status: 'A', brandName: name }),
    unit: (ctx, name) => UnitMaster.findOne({ status: 'A', name }),
    weight: (ctx, name) => WeightMaster.findOne({ status: 'A', weightName: name }),
    country: (ctx, name) => CountryMaster.findOne({ status: 'A', country_name: name }),
    state: (ctx, name) => StateMaster.findOne({ status: 'A', state_name: name }),
    city: (ctx, name) => CityMaster.findOne({ status: 'A', city_name: name })
};

// Case-insensitive exact-name lookup, cached for the whole request so the
// same name repeated down a sheet costs one query.
const lookupByName = async (ctx, type, rawName) => {
    try {
        const name = cellText(rawName);
        const cacheKey = `${type}::${name.toLowerCase()}`;
        if (ctx.lookupCache.has(cacheKey)) return ctx.lookupCache.get(cacheKey);

        const doc = name
            ? await BULK_NAME_LOOKUPS[type](ctx, { $regex: `^${escapeRegex(name)}$`, $options: 'i' })
            : null;
        ctx.lookupCache.set(cacheKey, doc || null);
        return doc || null;
    } catch (err) {
        throw err;
    }
};

const bulkDescriptionsFor = (ctx, level, tempCode) =>
    (ctx.descriptionsByRef.get(`${level}::${tempCode}`) || []).map(d => ({ key: cellText(d.key), value: cellText(d.value) }));

const bulkPricingFor = (ctx, level, tempCode) =>
    (ctx.bulkPricingByRef.get(`${level}::${tempCode}`) || []).map(bp => ({
        minimumQuantity: Number(bp.minimumQuantity), maximumQuantity: Number(bp.maximumQuantity), price: Number(bp.price)
    }));

// prefix: 'warranty' | 'return' | 'exchange' (the three <prefix>Available /
// <prefix>Duration / <prefix>DurationType column triplets on the Sizes sheet).
const assembleBulkPolicy = (sizeRow, prefix) => ({
    isAvailable: parseBoolean(sizeRow[`${prefix}Available`]),
    duration: numberOrUndefined(sizeRow[`${prefix}Duration`]),
    durationType: textOrUndefined(sizeRow[`${prefix}DurationType`])?.toUpperCase()
});

const resolveBulkExcludedLocations = async (ctx, type, cellValue, sizeTempCode) => {
    try {
        const ids = [];
        for (const name of parseCsv(cellValue)) {
            const doc = await lookupByName(ctx, type, name);
            if (!doc) return { error: `Excluded ${type} "${name}" not found (SizeTempCode "${sizeTempCode}")` };
            ids.push(doc._id.toString());
        }
        return { ids };
    } catch (err) {
        throw err;
    }
};

// One Sizes-sheet row -> the form's size object, plus what the row says about
// that size's images (applied afterwards, by variant/size position).
const assembleBulkSize = async (ctx, sizeRow, variantTempCode) => {
    try {
        const sizeTempCode = cellText(sizeRow.sizeTempCode);
        if (!sizeTempCode) {
            return { error: `SizeTempCode missing under VariantTempCode "${variantTempCode}"` };
        }

        if (isBlankCell(sizeRow.sizeMasterName)) {
            return { error: `SizeMasterName missing for SizeTempCode "${sizeTempCode}"` };
        }
        const sizeMasterDoc = await lookupByName(ctx, 'sizeMaster', sizeRow.sizeMasterName);
        if (!sizeMasterDoc) {
            return { error: `Size "${cellText(sizeRow.sizeMasterName)}" not found for SizeTempCode "${sizeTempCode}"` };
        }

        const sizeType = cellText(sizeRow.sizeType).toUpperCase();

        let values;
        if (sizeType === 'MEASURABLE') {
            const mvRows = ctx.measurementValuesBySize.get(sizeTempCode) || [];
            if (mvRows.length === 0) {
                return { error: `No MeasurementValues rows found for SizeTempCode "${sizeTempCode}" (required for MEASURABLE sizes)` };
            }
            values = [];
            for (const mv of mvRows) {
                const measurementLabel = cellText(mv.measurementLabel);
                const measurementDef = (sizeMasterDoc.measurements || []).find(
                    m => m.label.trim().toLowerCase() === measurementLabel.toLowerCase()
                );
                if (!measurementDef) {
                    return { error: `Measurement "${measurementLabel}" not found on size "${sizeMasterDoc.name}" (SizeTempCode "${sizeTempCode}")` };
                }
                const unitDoc = await lookupByName(ctx, 'unit', mv.unitName);
                if (!unitDoc) {
                    return { error: `Unit "${cellText(mv.unitName)}" not found for SizeTempCode "${sizeTempCode}"` };
                }
                values.push({
                    measurementId: measurementDef._id.toString(),
                    unit: unitDoc._id.toString(),
                    value: Number(mv.value)
                });
            }
        }

        let weight;
        if (!isBlankCell(sizeRow.weightValue)) {
            if (isBlankCell(sizeRow.weightUnitName)) {
                return { error: `WeightUnitName is required when WeightValue is provided (SizeTempCode "${sizeTempCode}")` };
            }
            const weightDoc = await lookupByName(ctx, 'weight', sizeRow.weightUnitName);
            if (!weightDoc) {
                return { error: `Weight unit "${cellText(sizeRow.weightUnitName)}" not found for SizeTempCode "${sizeTempCode}"` };
            }
            weight = { value: Number(sizeRow.weightValue), unit: weightDoc._id.toString() };
        }

        const excludedCountries = await resolveBulkExcludedLocations(ctx, 'country', sizeRow.excludeCountries, sizeTempCode);
        if (excludedCountries.error) return { error: excludedCountries.error };
        const excludedStates = await resolveBulkExcludedLocations(ctx, 'state', sizeRow.excludeStates, sizeTempCode);
        if (excludedStates.error) return { error: excludedStates.error };
        const excludedCities = await resolveBulkExcludedLocations(ctx, 'city', sizeRow.excludeCities, sizeTempCode);
        if (excludedCities.error) return { error: excludedCities.error };

        const additionalImagePaths = parseCsv(sizeRow.additionalImageFileNames);
        const additionalLimit = ctx.companyMasterData.numberOfAdditionalImagesAllowedInVariant;
        if (additionalLimit !== undefined && additionalLimit !== null && additionalImagePaths.length > additionalLimit) {
            return { error: `SizeTempCode "${sizeTempCode}" has ${additionalImagePaths.length} additional images, exceeding the allowed limit of ${additionalLimit}` };
        }

        let brandId;
        if (!isBlankCell(sizeRow.brand)) {
            const brandDoc = await lookupByName(ctx, 'brand', sizeRow.brand);
            if (!brandDoc) {
                return { error: `Brand "${cellText(sizeRow.brand)}" not found for SizeTempCode "${sizeTempCode}"` };
            }
            brandId = brandDoc._id.toString();
        }

        const shippingType = cellText(sizeRow.shippingType).toUpperCase();

        const size = {
            isDefaultSize: parseBoolean(sizeRow.isDefaultSize),
            sizeType,
            sizeName: textOrUndefined(sizeRow.sizeName),
            sizeAdditionalDisclaimer: textOrUndefined(sizeRow.sizeAdditionalDisclaimer),
            sizeAdditionalDescription: bulkDescriptionsFor(ctx, 'size', sizeTempCode),
            sizeAdditionalBulkPricing: bulkPricingFor(ctx, 'size', sizeTempCode),
            warranty: assembleBulkPolicy(sizeRow, 'warranty'),
            return: assembleBulkPolicy(sizeRow, 'return'),
            exchange: assembleBulkPolicy(sizeRow, 'exchange'),
            shipping: shippingType ? { type: shippingType, value: numberOrUndefined(sizeRow.shippingValue) } : null,
            isDescriptionSameFromVariantsDetails: parseBoolean(sizeRow.isDescriptionSameFromVariantsDetails),
            isDisclaimerSameFromVariantsDetails: parseBoolean(sizeRow.isDisclaimerSameFromVariantsDetails),
            isBulkPricingSameFromVariantsDetails: parseBoolean(sizeRow.isBulkPricingSameFromVariantsDetails),
            precedence: numberOrUndefined(sizeRow.precedence),
            excludeCountries: excludedCountries.ids,
            excludeStates: excludedStates.ids,
            excludeCities: excludedCities.ids,
            excludeZipCodes: parseCsv(sizeRow.excludeZipCodes),
            brandId,
            sizeId: sizeMasterDoc._id.toString(),
            values,
            labelValue: sizeType === 'LABEL' ? textOrUndefined(sizeRow.labelValue) : undefined,
            price: Number(sizeRow.price),
            cancelledPrice: numberOrUndefined(sizeRow.cancelledPrice),
            stock: numberOrUndefined(sizeRow.stock),
            weight,
            sku: textOrUndefined(sizeRow.sku),
            barcode: textOrUndefined(sizeRow.barcode),
            sizeCode: textOrUndefined(sizeRow.sizeCode)
        };

        const images = {
            sizeTempCode,
            mainImagePath: textOrUndefined(sizeRow.mainImageFileName) || null,
            additionalImagePaths,
            removeImage: parseBoolean(sizeRow.removeMainImage),
            removeAdditionalImages: parseBoolean(sizeRow.removeAdditionalImages)
        };

        return { size, images };
    } catch (err) {
        throw err;
    }
};

// Every Variants-sheet row of one product (with its Sizes-sheet rows) -> the
// form's `variants` array. imagePlan carries each size's image instructions
// keyed by its position (v = variant index, s = size index) in that array -
// the same positions createProduct()/updateProduct() match uploaded files by.
const assembleBulkVariants = async (ctx, productTempCode) => {
    try {
        const variantRows = ctx.variantsByProduct.get(productTempCode) || [];
        if (variantRows.length === 0) {
            return { error: `No variants found on the Variants sheet for ProductTempCode "${productTempCode}"` };
        }

        const variants = [];
        const imagePlan = [];

        for (let v = 0; v < variantRows.length; v++) {
            const variantRow = variantRows[v];
            const variantTempCode = cellText(variantRow.variantTempCode);
            if (!variantTempCode) {
                return { error: `VariantTempCode missing for a variant under ProductTempCode "${productTempCode}"` };
            }

            const sizeRows = ctx.sizesByVariant.get(variantTempCode) || [];
            if (sizeRows.length === 0) {
                return { error: `No sizes found on the Sizes sheet for VariantTempCode "${variantTempCode}"` };
            }

            const sizes = [];
            for (let s = 0; s < sizeRows.length; s++) {
                const assembled = await assembleBulkSize(ctx, sizeRows[s], variantTempCode);
                if (assembled.error) return { error: assembled.error };
                sizes.push(assembled.size);
                imagePlan.push({ v, s, ...assembled.images });
            }

            variants.push({
                isDefaultVariant: parseBoolean(variantRow.isDefaultVariant),
                color: textOrUndefined(variantRow.color),
                displayName: textOrUndefined(variantRow.displayName),
                sizes,
                variantAdditionalDisclaimer: textOrUndefined(variantRow.variantAdditionalDisclaimer),
                variantAdditionalDescription: bulkDescriptionsFor(ctx, 'variant', variantTempCode),
                variantAdditionalBulkPricing: bulkPricingFor(ctx, 'variant', variantTempCode),
                isDescriptionSameFromProductBasicDetails: parseBoolean(variantRow.isDescriptionSameFromProductBasicDetails),
                isDisclaimerSameFromProductBasicDetails: parseBoolean(variantRow.isDisclaimerSameFromProductBasicDetails),
                isBulkPricingSameFromProductBasicDetails: parseBoolean(variantRow.isBulkPricingSameFromProductBasicDetails),
                variantCode: textOrUndefined(variantRow.variantCode)
            });
        }

        return { variants, imagePlan };
    } catch (err) {
        throw err;
    }
};

// Same rule as the form's category pickers: the path must fully pre-exist.
// First segment = main category (top level); last segment = sub category
// (any depth under it); a single segment = main category only.
const resolveBulkCategoryPath = async (ctx, pathCell) => {
    try {
        const segments = cellText(pathCell).split('>').map(s => s.trim()).filter(Boolean);
        if (segments.length === 0) return { error: 'CategoryPath is empty or invalid' };

        const cacheKey = segments.join('>').toLowerCase();
        if (ctx.categoryPathCache.has(cacheKey)) return ctx.categoryPathCache.get(cacheKey);

        let result = null;
        let mainCategoryDoc = null;
        let currentDoc = null;
        for (const segment of segments) {
            currentDoc = await Category.findOne({
                vendorId: ctx.vendorId, parent_category_id: currentDoc ? currentDoc._id : null, status: 'A',
                categoryName: { $regex: `^${escapeRegex(segment)}$`, $options: 'i' }
            });
            if (!currentDoc) {
                result = { error: mainCategoryDoc ? `Category "${segment}" not found under the given CategoryPath` : `Top-level category "${segment}" not found` };
                break;
            }
            if (!mainCategoryDoc) mainCategoryDoc = currentDoc;
        }

        if (!result) {
            result = {
                mainCategory: mainCategoryDoc._id.toString(),
                subCategory: segments.length > 1 ? currentDoc._id.toString() : null
            };
        }
        ctx.categoryPathCache.set(cacheKey, result);
        return result;
    } catch (err) {
        throw err;
    }
};

const resolveBulkRecommendedProducts = async (ctx, codesCell) => {
    try {
        const codes = parseCsv(codesCell).map(c => c.toUpperCase());
        if (codes.length === 0) return { ids: [] };

        const docs = await Product.find({ vendorId: ctx.vendorId, status: 'A', productCode: { $in: codes } }, { _id: 1, productCode: 1 }).lean();
        const foundCodes = new Set(docs.map(d => d.productCode));
        const missing = codes.filter(c => !foundCodes.has(c));
        if (missing.length > 0) {
            return { error: `Recommended product code(s) not found: ${missing.join(', ')}` };
        }
        return { ids: docs.map(d => d._id.toString()) };
    } catch (err) {
        throw err;
    }
};

const resolveBulkTaxCodes = async (codesCell) => {
    try {
        const codes = parseCsv(codesCell).map(c => c.toUpperCase());
        if (codes.length === 0) return { ids: [] };

        const docs = await TaxMaster.find({ status: 'A', code: { $in: codes } }, { _id: 1, code: 1 }).lean();
        const foundCodes = new Set(docs.map(d => d.code));
        const missing = codes.filter(c => !foundCodes.has(c));
        if (missing.length > 0) {
            return { error: `Tax code(s) not found: ${missing.join(', ')}` };
        }
        return { ids: docs.map(d => d._id.toString()) };
    } catch (err) {
        throw err;
    }
};

// Turns the image file names on the Sizes sheet into the same multer-shaped
// file objects the form upload produces (sizeImage_<v>_<s> /
// sizeAdditionalImages_<v>_<s>, see groupSizeFiles), pulling the bytes out of
// the two uploaded zips.
const buildBulkImageFiles = (ctx, imagePlan) => {
    try {
        const files = [];
        for (const plan of imagePlan) {
            if (plan.mainImagePath) {
                const imgBuffer = ctx.mainImageEntries.get(plan.mainImagePath.toLowerCase());
                if (!imgBuffer) {
                    return { error: `Main image "${plan.mainImagePath}" not found in main images zip (SizeTempCode "${plan.sizeTempCode}")` };
                }
                files.push({
                    fieldname: `sizeImage_${plan.v}_${plan.s}`,
                    originalname: path.basename(plan.mainImagePath),
                    mimetype: 'application/octet-stream',
                    buffer: imgBuffer,
                    size: imgBuffer.length
                });
            }

            if (plan.additionalImagePaths.length > 0) {
                const zipEntriesForSize = [];
                for (const imgPath of plan.additionalImagePaths) {
                    const imgBuffer = ctx.additionalImageEntries.get(imgPath.toLowerCase());
                    if (!imgBuffer) {
                        return { error: `Additional image "${imgPath}" not found in additional images zip (SizeTempCode "${plan.sizeTempCode}")` };
                    }
                    zipEntriesForSize.push({ name: path.basename(imgPath), buffer: imgBuffer });
                }
                const miniZipBuffer = createZipBuffer(zipEntriesForSize);
                files.push({
                    fieldname: `sizeAdditionalImages_${plan.v}_${plan.s}`,
                    originalname: `${plan.sizeTempCode}-additional.zip`,
                    mimetype: 'application/zip',
                    buffer: miniZipBuffer,
                    size: miniZipBuffer.length
                });
            }
        }
        return { files };
    } catch (err) {
        throw err;
    }
};

const joiErrorMessages = (error) => error.details.map(d => d.message.replace(/"/g, ''));

// Bulk ADD: each Products-sheet row becomes the Add Product form's payload
// and goes through createProduct() unchanged.
const bulkUploadProducts = async (vendorId, userId, excelBuffer, mainImagesZipBuffer, additionalImagesZipBuffer, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const prepared = await prepareBulkProductRun({ vendorId, excelBuffer, mainImagesZipBuffer, additionalImagesZipBuffer, companyMasterData });
        if (!prepared.isSuccess) {
            return common.returnResult(false, prepared.statusCode, prepared.message);
        }
        const { productRows, ctx } = prepared.meta;

        const result = await processExcelRows(
            productRows,
            async (productRow) => {
                const productTempCode = cellText(productRow.productTempCode);
                if (!productTempCode) {
                    return { success: false, errors: ['ProductTempCode is required'] };
                }

                const assembled = await assembleBulkVariants(ctx, productTempCode);
                if (assembled.error) {
                    return { success: false, errors: [assembled.error] };
                }

                // Optional, exactly as on the form: no category at all, or a
                // main category with no sub category, are both fine.
                let category = { mainCategory: null, subCategory: null };
                if (!isBlankCell(productRow.categoryPath)) {
                    category = await resolveBulkCategoryPath(ctx, productRow.categoryPath);
                    if (category.error) {
                        return { success: false, errors: [category.error] };
                    }
                }

                const recommended = await resolveBulkRecommendedProducts(ctx, productRow.recommendedProductCodes);
                if (recommended.error) {
                    return { success: false, errors: [recommended.error] };
                }

                const taxes = await resolveBulkTaxCodes(productRow.taxCodes);
                if (taxes.error) {
                    return { success: false, errors: [taxes.error] };
                }

                const assembledBody = {
                    name: textOrUndefined(productRow.name),
                    description: bulkDescriptionsFor(ctx, 'product', productTempCode),
                    disclaimer: textOrUndefined(productRow.disclaimer),
                    colors: parseCsv(productRow.colors),
                    mainCategory: category.mainCategory,
                    subCategory: category.subCategory,
                    searchKeywords: parseCsv(productRow.searchKeywords),
                    recommendedProducts: recommended.ids,
                    taxIds: taxes.ids,
                    precedence: numberOrUndefined(productRow.precedence),
                    productCode: textOrUndefined(productRow.productCode),
                    bulkPricing: bulkPricingFor(ctx, 'product', productTempCode),
                    variants: assembled.variants
                };

                const { error, value } = createProductSchema.validate(assembledBody, { abortEarly: false });
                if (error) {
                    return { success: false, errors: joiErrorMessages(error) };
                }

                const images = buildBulkImageFiles(ctx, assembled.imagePlan);
                if (images.error) {
                    return { success: false, errors: [images.error] };
                }

                const createResult = await createProduct(
                    vendorId, userId, companyMasterData, websiteMasterData, companySettingsData, value, images.files
                );
                if (!createResult.isSuccess) {
                    return { success: false, errors: [createResult.message] };
                }

                return { success: true };
            },
            { allowPartialSuccess: true, useTransaction: false }
        );

        logger.logInfo(1, 0, 'Bulk product upload processed', {
            vendorId, total: result.totalRows, success: result.successCount, failed: result.failedCount
        });

        return common.returnResult(true, 200, 'Bulk product upload processed', result);
    } catch (err) {
        throw err;
    }
};

// An excel file has no ids, so a Variants/Sizes row is tied to the existing
// variant/size it updates by VariantCode/SizeCode: a match gets that
// subdocument's _id (which is what updateProduct() matches on); a blank or
// unknown code stays id-less, i.e. a brand-new variant/size. The image
// removal flags only exist on update, so they are attached here too.
const linkBulkVariantsToExisting = (existingProduct, variants, imagePlan) => {
    try {
        const codeKey = (code) => cellText(code).toUpperCase();

        const existingVariantsByCode = new Map();
        for (const existingVariant of existingProduct.variants) {
            if (existingVariant.variantCode) existingVariantsByCode.set(codeKey(existingVariant.variantCode), existingVariant);
        }

        const usedVariantCodes = new Set();
        for (const variant of variants) {
            const existingVariant = variant.variantCode ? existingVariantsByCode.get(codeKey(variant.variantCode)) : null;
            if (!existingVariant) continue;

            if (usedVariantCodes.has(codeKey(variant.variantCode))) {
                return { error: `VariantCode "${variant.variantCode}" is listed more than once for this product.` };
            }
            usedVariantCodes.add(codeKey(variant.variantCode));
            variant._id = existingVariant._id.toString();

            const existingSizesByCode = new Map();
            for (const existingSize of existingVariant.sizes) {
                if (existingSize.sizeCode) existingSizesByCode.set(codeKey(existingSize.sizeCode), existingSize);
            }

            const usedSizeCodes = new Set();
            for (const size of variant.sizes) {
                const existingSize = size.sizeCode ? existingSizesByCode.get(codeKey(size.sizeCode)) : null;
                if (!existingSize) continue;

                if (usedSizeCodes.has(codeKey(size.sizeCode))) {
                    return { error: `SizeCode "${size.sizeCode}" is listed more than once under VariantCode "${variant.variantCode}".` };
                }
                usedSizeCodes.add(codeKey(size.sizeCode));
                size._id = existingSize._id.toString();
            }
        }

        for (const plan of imagePlan) {
            const size = variants[plan.v].sizes[plan.s];
            size.removeImage = plan.removeImage;
            size.removeAdditionalImages = plan.removeAdditionalImages;
        }

        return { variants };
    } catch (err) {
        throw err;
    }
};

// The product-level half of a bulk-update row. A blank cell keeps what the
// product already has, CLEAR empties the field, anything else replaces it.
// Colors and Precedence can't be cleared: a product needs at least one color,
// and the form has no way to unset a precedence either. Product-level
// Descriptions / BulkPricing rows replace the product's own when the file has
// any for it, and are kept as they are when it has none.
const assembleBulkUpdateProductFields = async (ctx, productRow, existingProduct, productTempCode) => {
    try {
        const idStrings = (ids) => (ids || []).map(id => id.toString());

        if (isClearCell(productRow.colors)) {
            return { error: `Colors cannot be cleared - a product needs at least one color.` };
        }
        if (isClearCell(productRow.precedence)) {
            return { error: `Precedence cannot be cleared - leave it blank to keep the current value, or enter a new one.` };
        }

        let category;
        if (isClearCell(productRow.categoryPath)) {
            category = { mainCategory: null, subCategory: null };
        } else if (isBlankCell(productRow.categoryPath)) {
            category = {
                mainCategory: existingProduct.mainCategory ? existingProduct.mainCategory.toString() : null,
                subCategory: existingProduct.subCategory ? existingProduct.subCategory.toString() : null
            };
        } else {
            category = await resolveBulkCategoryPath(ctx, productRow.categoryPath);
            if (category.error) return { error: category.error };
        }

        let disclaimer;
        if (isClearCell(productRow.disclaimer)) disclaimer = null;
        else if (isBlankCell(productRow.disclaimer)) disclaimer = existingProduct.disclaimer || null;
        else disclaimer = cellText(productRow.disclaimer);

        let searchKeywords;
        if (isClearCell(productRow.searchKeywords)) searchKeywords = [];
        else if (isBlankCell(productRow.searchKeywords)) searchKeywords = [...(existingProduct.searchKeywords || [])];
        else searchKeywords = parseCsv(productRow.searchKeywords);

        let recommendedProducts;
        if (isClearCell(productRow.recommendedProductCodes)) recommendedProducts = [];
        else if (isBlankCell(productRow.recommendedProductCodes)) recommendedProducts = idStrings(existingProduct.recommendedProducts);
        else {
            const recommended = await resolveBulkRecommendedProducts(ctx, productRow.recommendedProductCodes);
            if (recommended.error) return { error: recommended.error };
            recommendedProducts = recommended.ids;
        }

        let taxIds;
        if (isClearCell(productRow.taxCodes)) taxIds = [];
        else if (isBlankCell(productRow.taxCodes)) taxIds = idStrings(existingProduct.taxIds);
        else {
            const taxes = await resolveBulkTaxCodes(productRow.taxCodes);
            if (taxes.error) return { error: taxes.error };
            taxIds = taxes.ids;
        }

        const descriptionRows = bulkDescriptionsFor(ctx, 'product', productTempCode);
        const bulkPricingRows = bulkPricingFor(ctx, 'product', productTempCode);

        return {
            fields: {
                description: descriptionRows.length > 0
                    ? descriptionRows
                    : (existingProduct.description || []).map(d => ({ key: d.key, value: d.value })),
                disclaimer,
                colors: isBlankCell(productRow.colors) ? [...(existingProduct.colors || [])] : parseCsv(productRow.colors),
                mainCategory: category.mainCategory,
                subCategory: category.subCategory,
                searchKeywords,
                recommendedProducts,
                taxIds,
                precedence: isBlankCell(productRow.precedence) ? (existingProduct.precedence ?? undefined) : Number(productRow.precedence),
                bulkPricing: bulkPricingRows.length > 0
                    ? bulkPricingRows
                    : (existingProduct.bulkPricing || []).map(bp => ({
                        minimumQuantity: bp.minimumQuantity, maximumQuantity: bp.maximumQuantity, price: bp.price
                    }))
            }
        };
    } catch (err) {
        throw err;
    }
};

// Bulk UPDATE via the same excel structure bulkUploadProducts uses - the
// difference is in what a "Products" sheet row means: instead of creating a
// new product, each row identifies an ALREADY-EXISTING product by its `name`
// (matched case-insensitively, vendor-scoped - name is unique per vendor, see
// resolveProductName/the Product.js index). A row whose name doesn't match
// any existing product is skipped (reported as a per-row failure, same
// partial-success reporting as bulkUploadProducts - nothing is created).
//
// The row is turned into the Edit Product form's payload and goes through
// updateProduct() unchanged, so it follows every rule the form does:
//  - product-level fields: see assembleBulkUpdateProductFields (blank keeps,
//    CLEAR empties). Name is only the lookup key and ProductCode is immutable,
//    so neither is ever changed.
//  - variants/sizes are a full replace: a row whose VariantCode/SizeCode
//    matches one already on the product updates it in place; a row with a
//    blank (or unknown) code is a brand-new variant/size; any existing
//    variant/size NOT referenced by any row for that product is removed,
//    images included - see linkBulkVariantsToExisting / mergeVariantsIntoProduct.
const bulkUpdateProducts = async (vendorId, userId, excelBuffer, mainImagesZipBuffer, additionalImagesZipBuffer, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const prepared = await prepareBulkProductRun({ vendorId, excelBuffer, mainImagesZipBuffer, additionalImagesZipBuffer, companyMasterData });
        if (!prepared.isSuccess) {
            return common.returnResult(false, prepared.statusCode, prepared.message);
        }
        const { productRows, ctx } = prepared.meta;

        const result = await processExcelRows(
            productRows,
            async (productRow) => {
                const productTempCode = cellText(productRow.productTempCode);
                if (!productTempCode) {
                    return { success: false, errors: ['ProductTempCode is required'] };
                }

                const name = cellText(productRow.name);
                if (!name) {
                    return { success: false, errors: ['Name is required'] };
                }

                const existingProduct = await Product.findOne({
                    vendorId, status: { $ne: 'D' },
                    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
                });
                if (!existingProduct) {
                    return { success: false, errors: [`No existing product found with name "${name}" - skipped.`] };
                }

                const assembled = await assembleBulkVariants(ctx, productTempCode);
                if (assembled.error) {
                    return { success: false, errors: [assembled.error] };
                }

                const linked = linkBulkVariantsToExisting(existingProduct, assembled.variants, assembled.imagePlan);
                if (linked.error) {
                    return { success: false, errors: [linked.error] };
                }

                const productFields = await assembleBulkUpdateProductFields(ctx, productRow, existingProduct, productTempCode);
                if (productFields.error) {
                    return { success: false, errors: [productFields.error] };
                }

                const assembledBody = {
                    productId: existingProduct._id.toString(),
                    // The stored name, not the cell's: the cell only has to
                    // match case-insensitively and must never rename the product.
                    name: existingProduct.name,
                    ...productFields.fields,
                    variants: linked.variants
                };

                const { error, value } = updateProductSchema.validate(assembledBody, { abortEarly: false });
                if (error) {
                    return { success: false, errors: joiErrorMessages(error) };
                }

                const images = buildBulkImageFiles(ctx, assembled.imagePlan);
                if (images.error) {
                    return { success: false, errors: [images.error] };
                }

                const updateResult = await updateProduct(
                    vendorId, userId, companyMasterData, websiteMasterData, companySettingsData, value, images.files
                );
                if (!updateResult.isSuccess) {
                    return { success: false, errors: [updateResult.message] };
                }

                return { success: true };
            },
            { allowPartialSuccess: true, useTransaction: false }
        );

        logger.logInfo(1, 0, 'Bulk product update processed', {
            vendorId, total: result.totalRows, success: result.successCount, failed: result.failedCount
        });

        return common.returnResult(true, 200, 'Bulk product update processed', result);
    } catch (err) {
        throw err;
    }
};

// Shared variant/size merge engine - matches the submitted variants array
// against an existing product's OWN variants/sizes via caller-supplied key
// extractors, resolves codes/skus (immutable-once-set, same rules as
// create), applies uploaded images matched by variant+size array position,
// and removes any existing variant/size the submitted array didn't
// reference (cleaning up its images). Used by updateProduct (matches by
// _id - the form always knows the DB's own ids) and bulkUpdateProducts
// (matches by variantCode/sizeCode - an excel file has no ids to work
// with, so a blank/non-matching code means "this is a new variant/size",
// same convention immutable-code carry-forward already uses everywhere
// else in this file).
// (bulkUpdateProducts now goes through updateProduct too - it turns matching
// codes into _ids up front, see linkBulkVariantsToExisting.)
const mergeVariantsIntoProduct = async ({
    vendorId, userId, productId, existingProduct, submittedVariants,
    companyMasterData, websiteMasterData, companySettingsData, files,
    productBulkPricing,
    getExistingVariantKey, getIncomingVariantKey,
    getExistingSizeKey, getIncomingSizeKey
}) => {
    try {
        // --- bulk pricing feature gate (product-level, variant-level, AND size-level) -
        const hasBulkPricing = (productBulkPricing && productBulkPricing.length > 0) ||
            (submittedVariants || []).some(v =>
                (v.variantAdditionalBulkPricing && v.variantAdditionalBulkPricing.length > 0) ||
                (v.sizes || []).some(s => s.sizeAdditionalBulkPricing && s.sizeAdditionalBulkPricing.length > 0)
            );

        if (hasBulkPricing) {
            const featureCheck = await common.checkFeatureOnOrOff(
                vendorId, websiteMasterData, companyMasterData,
                'isBulkPricingFeatureOn', 'isBulkPricingFeatureOn'
            );
            if (!featureCheck.isSuccess) {
                return common.returnResult(false, featureCheck.statusCode, `Bulk Pricing is not enabled for your plan. Therefore you can't add the product with bulk pricing.`);
            }
        }

        // --- plan limit: variants per product ---------------------------------------
        if (companyMasterData.numberOfProductsVaiantsAllowed !== undefined && companyMasterData.numberOfProductsVaiantsAllowed !== null) {
            if ((submittedVariants || []).length > companyMasterData.numberOfProductsVaiantsAllowed) {
                return common.returnResult(false, 403, `You can add a maximum of ${companyMasterData.numberOfProductsVaiantsAllowed} variant(s) per product.`);
            }
        }

        const existingVariantsMap = new Map();
        for (const v of existingProduct.variants) {
            const key = getExistingVariantKey(v);
            if (key) existingVariantsMap.set(key, v);
        }
        const matchedExistingVariantKeys = new Set();

        const productBulkBounds = getBulkPricingBounds(productBulkPricing);
        const productMaxBulkPrice = (productBulkPricing && productBulkPricing.length > 0)
            ? Math.max(...productBulkPricing.map(b => b.price))
            : null;

        const usedManualVariantCodesInPayload = new Set();
        const usedManualSizeCodesInPayload = new Set();
        const usedManualSkusInPayload = new Set();
        const usedManualBarcodesInPayload = new Set();
        const sizeMasterCache = new Map();

        const variants = [];

        for (const variant of (submittedVariants || [])) {
            const incomingVariantKey = getIncomingVariantKey(variant);
            const isExistingVariant = incomingVariantKey !== null && existingVariantsMap.has(incomingVariantKey);
            const existingVariantDoc = isExistingVariant ? existingVariantsMap.get(incomingVariantKey) : null;
            if (isExistingVariant) matchedExistingVariantKeys.add(incomingVariantKey);

            // variantCode is immutable - carry forward for existing
            // variants, resolve (auto/manual) only for brand-new ones.
            let resolvedVariantCode;
            if (isExistingVariant) {
                resolvedVariantCode = existingVariantDoc.variantCode;
            } else {
                const variantCodeResult = await resolveVariantCode({
                    vendorId, variantCode: variant.variantCode, companySettingsData,
                    usedManualCodesInPayload: usedManualVariantCodesInPayload
                });
                if (!variantCodeResult.isSuccess) {
                    return common.returnResult(false, variantCodeResult.statusCode, variantCodeResult.message);
                }
                resolvedVariantCode = variantCodeResult.meta.variantCode;
            }

            // --- variant-level bulk pricing chain (identical rule to create) ---------
            let variantBulkBounds = null;
            if (variant.isBulkPricingSameFromProductBasicDetails) {
                const variantChainResult = validateAdditionalBulkPricingChain(
                    variant.variantAdditionalBulkPricing, productBulkBounds, 'Variant additional'
                );
                if (!variantChainResult.isSuccess) {
                    return common.returnResult(false, variantChainResult.statusCode, variantChainResult.message);
                }
                const effectiveVariantArray = [
                    ...(productBulkPricing || []),
                    ...(variant.variantAdditionalBulkPricing || [])
                ];
                variantBulkBounds = getBulkPricingBounds(effectiveVariantArray);
            }

            const existingSizesMap = new Map();
            if (existingVariantDoc) {
                for (const s of existingVariantDoc.sizes) {
                    const key = getExistingSizeKey(s);
                    if (key) existingSizesMap.set(key, s);
                }
            }
            const matchedExistingSizeKeys = new Set();
            const resolvedSizes = [];

            for (const size of (variant.sizes || [])) {
                const incomingSizeKey = getIncomingSizeKey(size);
                const isExistingSize = incomingSizeKey !== null && existingSizesMap.has(incomingSizeKey);
                const existingSizeDoc = isExistingSize ? existingSizesMap.get(incomingSizeKey) : null;
                if (isExistingSize) matchedExistingSizeKeys.add(incomingSizeKey);

                const sizeResult = await resolveSize({
                    vendorId, size, companyMasterData, websiteMasterData, companySettingsData,
                    sizeMasterCache, usedManualSkusInPayload, usedManualBarcodesInPayload, usedManualSizeCodesInPayload,
                    existingSize: existingSizeDoc, excludeProductId: productId
                });
                if (!sizeResult.isSuccess) {
                    return common.returnResult(false, sizeResult.statusCode, sizeResult.message);
                }

                if (variant.isBulkPricingSameFromProductBasicDetails && size.isBulkPricingSameFromVariantsDetails) {
                    const sizeChainResult = validateAdditionalBulkPricingChain(
                        size.sizeAdditionalBulkPricing, variantBulkBounds, 'Size additional'
                    );
                    if (!sizeChainResult.isSuccess) {
                        return common.returnResult(false, sizeChainResult.statusCode, sizeChainResult.message);
                    }
                }

                if (variant.isBulkPricingSameFromProductBasicDetails && productMaxBulkPrice !== null) {
                    if (size.price <= productMaxBulkPrice) {
                        return common.returnResult(false, 400, `Size price (${size.price}) must be greater than the product's bulk pricing price (${productMaxBulkPrice}).`);
                    }
                }

                resolvedSizes.push({
                    ...size,
                    _id: existingSizeDoc ? existingSizeDoc._id : undefined,
                    sku: sizeResult.meta.sku,
                    barcode: sizeResult.meta.barcode,
                    sizeCode: sizeResult.meta.sizeCode,
                    labelValue: sizeResult.meta.labelValue,
                    // Carried forward here as a placeholder - the image
                    // attachment loop below overwrites these ONLY if new
                    // files were actually uploaded for this position.
                    image: existingSizeDoc ? toPlainImage(existingSizeDoc.image) : undefined,
                    additionalImages: existingSizeDoc ? existingSizeDoc.additionalImages : [],
                    createdBy: existingSizeDoc ? existingSizeDoc.createdBy : userId,
                    updatedBy: userId,
                    status: 'A',
                    remarks: existingSizeDoc ? existingSizeDoc.remarks : 'MANUAL'
                });
            }

            // --- sizes removed from this variant: clean up their images ------------
            for (const [existingSizeKey, existingSizeDoc] of existingSizesMap) {
                if (!matchedExistingSizeKeys.has(existingSizeKey)) {
                    await deleteAllImagesForSize(existingSizeDoc, userId, productId);
                }
            }

            variants.push({
                ...variant,
                _id: existingVariantDoc ? existingVariantDoc._id : undefined,
                variantCode: resolvedVariantCode,
                createdBy: existingVariantDoc ? existingVariantDoc.createdBy : userId,
                updatedBy: userId,
                status: 'A',
                remarks: existingVariantDoc ? existingVariantDoc.remarks : 'MANUAL',
                sizes: resolvedSizes
            });
        }

        // --- variants removed entirely: clean up every size's images ------------------
        for (const [existingVariantKey, existingVariantDoc] of existingVariantsMap) {
            if (!matchedExistingVariantKeys.has(existingVariantKey)) {
                for (const existingSizeDoc of existingVariantDoc.sizes) {
                    await deleteAllImagesForSize(existingSizeDoc, userId, productId);
                }
            }
        }

        // --- attach new images / apply explicit removals, matched by variant+size array position ------------
        // Positions with no new files and no removal flag keep whatever was
        // carried forward above untouched. A removal flag only takes effect
        // when no replacement file was uploaded for that same slot in this
        // request - an uploaded file always wins over a stale removal flag.
        const groupedFiles = groupSizeFiles(files);
        for (let v = 0; v < variants.length; v++) {
            for (let s = 0; s < variants[v].sizes.length; s++) {
                const sizeFiles = groupedFiles[v]?.[s];
                const submittedSize = submittedVariants[v]?.sizes?.[s];

                if (submittedSize?.removeImage && !sizeFiles?.image && variants[v].sizes[s].image?.imageAssetId) {
                    await deleteImageIfUnreferenced({ imageAssetId: variants[v].sizes[s].image.imageAssetId, userId, excludeProductId: productId });
                    variants[v].sizes[s].image = undefined;
                }
                if (submittedSize?.removeAdditionalImages && !sizeFiles?.additionalImages?.length && variants[v].sizes[s].additionalImages?.length) {
                    for (const old of variants[v].sizes[s].additionalImages) {
                        if (old.imageAssetId) {
                            await deleteImageIfUnreferenced({ imageAssetId: old.imageAssetId, userId, excludeProductId: productId });
                        }
                    }
                    variants[v].sizes[s].additionalImages = [];
                }

                if (!sizeFiles) continue;

                const imagesResult = await applySizeImages({
                    vendorId, userId, sizeFiles,
                    existingImage: variants[v].sizes[s].image || null,
                    existingAdditionalImages: variants[v].sizes[s].additionalImages || [],
                    companyMasterData, websiteMasterData,
                    excludeProductId: productId
                });
                if (!imagesResult.isSuccess) {
                    return common.returnResult(false, imagesResult.statusCode, imagesResult.message);
                }
                if (imagesResult.meta.image) variants[v].sizes[s].image = imagesResult.meta.image;
                if (imagesResult.meta.additionalImages) variants[v].sizes[s].additionalImages = imagesResult.meta.additionalImages;
            }
        }

        return common.returnResult(true, 200, 'All Good', { variants });
    } catch (err) {
        throw err;
    }
};

// Full-replace update: the incoming payload is the complete desired state
// of the product (identical shape/validation to createProduct). Variants/
// sizes are matched to existing subdocuments by _id - present + matched =
// update in place, present with no _id = new insert, existing-but-absent-
// from-the-payload = removed (with its images cleaned up).
// productCode/variantCode/sizeCode are immutable and always carried
// forward from the existing document for matched entities, regardless of
// what the payload contains for them.
const updateProduct = async (vendorId, userId, companyMasterData, websiteMasterData, companySettingsData, body, files) => {
    try {
        const {
            productId,
            productCode: _submittedProductCode, // immutable - intentionally discarded
            variants: submittedVariants,
            ...rest
        } = body;

        const existingProduct = await Product.findOne({ _id: productId, vendorId, status: { $ne: 'D' } });
        if (!existingProduct) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        // --- category hierarchy -------------------------------------------------
        const categoryResult = await validateCategories({
            vendorId, mainCategory: body.mainCategory, subCategory: body.subCategory, companyMasterData
        });
        if (!categoryResult.isSuccess) {
            return common.returnResult(false, categoryResult.statusCode, categoryResult.message);
        }

        // --- name (unique per vendor) - only re-checked when actually changing ----
        if (rest.name && rest.name !== existingProduct.name) {
            const nameResult = await resolveProductName({ vendorId, name: rest.name, excludeProductId: productId });
            if (!nameResult.isSuccess) {
                return common.returnResult(false, nameResult.statusCode, nameResult.message);
            }
        }

        // --- tax ids vs allowed countries + validity window ---------------------
        const taxResult = await validateTaxIds({ taxIds: rest.taxIds, companyMasterData });
        if (!taxResult.isSuccess) {
            return common.returnResult(false, taxResult.statusCode, taxResult.message);
        }

        // --- recommended products -------------------------------------------------
        const recommendedResult = await validateRecommendedProducts({ recommendedProducts: rest.recommendedProducts, vendorId });
        if (!recommendedResult.isSuccess) {
            return common.returnResult(false, recommendedResult.statusCode, recommendedResult.message);
        }

        // --- slug: only regenerate if the name actually changed ---------------------
        let slug = existingProduct.slug;
        if (rest.name && rest.name !== existingProduct.name) {
            slug = await generateUniqueSlug(vendorId, rest.name, productId);
        }

        // --- variants/sizes: matched to existing subdocuments by _id --------------
        const mergeResult = await mergeVariantsIntoProduct({
            vendorId, userId, productId, existingProduct, submittedVariants,
            companyMasterData, websiteMasterData, companySettingsData, files,
            productBulkPricing: rest.bulkPricing,
            getExistingVariantKey: v => v._id.toString(),
            getIncomingVariantKey: v => v._id ? v._id.toString() : null,
            getExistingSizeKey: s => s._id.toString(),
            getIncomingSizeKey: s => s._id ? s._id.toString() : null
        });
        if (!mergeResult.isSuccess) {
            return common.returnResult(false, mergeResult.statusCode, mergeResult.message);
        }
        const variants = mergeResult.meta.variants;

        existingProduct.set({
            ...rest,
            mainCategory: categoryResult.meta.mainCategory,
            subCategory: categoryResult.meta.subCategory,
            slug,
            updatedBy: userId
            // vendorId, productCode, createdBy, remarks intentionally untouched
        });
        existingProduct.variants = variants;

        await existingProduct.save();

        logger.logInfo(1, 0, 'Product updated successfully', { vendorId, productId });

        return common.returnResult(true, 200, 'Product updated successfully', { product: existingProduct });
    } catch (err) {
        throw err;
    }
};

// Shared active/inactive toggle - status is 'A' or 'I' only (Joi-enforced);
// soft delete ('D') is a separate dedicated function below.
const toggleProductStatus = async (vendorId, userId, productId, status) => {
    try {
        const result = status === 'A'
            ? await common.setActiveStatusToTrue(Product, productId, userId, vendorId)
            : await common.setActiveStatusToFalse(Product, productId, userId, vendorId);

        if (!result.success) {
            return common.returnResult(false, 404, result.message);
        }

        // --- cascade to the product's own images ---------------------------
        // Going inactive: deactivate every image this product's sizes use,
        // UNLESS another still-live product (e.g. a clone) also references
        // it - that one stays 'A' since it's still needed there.
        // Going active: always safe to reactivate this product's own
        // images unconditionally - no guard needed.
        const imageAssetIds = collectProductImageAssetIds(result.document);
        for (const imageAssetId of imageAssetIds) {
            if (status === 'A') {
                await reactivateImage({ imageAssetId, userId });
            } else {
                await deactivateImageIfUnreferenced({ imageAssetId, userId, excludeProductId: productId });
            }
        }

        logger.logInfo(1, 0, 'Product status updated', { vendorId, productId, status });

        return common.returnResult(true, 200, 'Product status updated successfully', { product: result.document });
    } catch (err) {
        throw err;
    }
};

// Bulk multi-select actions (frontend checkbox selection) - reuse
// toggleProductStatus/deleteProduct as-is so the image cascade (deactivate/
// reactivate/delete the product's own images) applies exactly the same way
// it does for a single product.
const bulkToggleProductStatus = async (vendorId, userId, productIds, status) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            productIds,
            (id) => toggleProductStatus(vendorId, userId, id, status)
        );

        logger.logInfo(successCount, failureCount, 'Bulk product status update completed', { vendorId, status, successCount, failureCount });

        return common.returnResult(
            true, 200,
            `${status === 'A' ? 'Activated' : 'Deactivated'} ${successCount} of ${productIds.length} product(s).`,
            { results, successCount, failureCount }
        );
    } catch (err) {
        throw err;
    }
};

const bulkDeleteProducts = async (vendorId, userId, productIds) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            productIds,
            (id) => deleteProduct(vendorId, userId, id)
        );

        logger.logInfo(successCount, failureCount, 'Bulk product delete completed', { vendorId, successCount, failureCount });

        return common.returnResult(
            true, 200,
            `Deleted ${successCount} of ${productIds.length} product(s).`,
            { results, successCount, failureCount }
        );
    } catch (err) {
        throw err;
    }
};

const deleteProduct = async (vendorId, userId, productId) => {
    try {
        const result = await common.softDelete(Product, productId, userId, vendorId);

        if (!result.success) {
            return common.returnResult(false, 404, result.message);
        }

        // --- cascade to the product's own images ---------------------------
        // Physically delete every image this product's sizes used, UNLESS
        // another still-live product (e.g. a clone) also references it -
        // that one is left completely untouched (still 'A', still live in
        // storage) since it's still needed there.
        const imageAssetIds = collectProductImageAssetIds(result.document);
        for (const imageAssetId of imageAssetIds) {
            await deleteImageIfUnreferenced({ imageAssetId, userId, excludeProductId: productId });
        }

        logger.logInfo(1, 0, 'Product deleted', { vendorId, productId });

        return common.returnResult(true, 200, 'Product deleted successfully');
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------------
// Product cloning
// ---------------------------------------------------------------------------

// Regenerates a code via the SAME per-vendor sequence/format the normal
// auto-generation path uses (PRD-000001 / VAR-000001 / SIZ-000001) - shares
// the counter with resolveProductCode/resolveVariantCode/resolveSizeCode so
// a cloned code can never collide with a normally auto-generated one.
// Cloning always regenerates fresh codes regardless of the vendor's own
// isXCodeAutoGenerated setting, since there's no manual-entry step in a
// one-click clone.
const generateSequentialCode = async (vendorId, sequenceKey, prefix) => {
    try {
        const nextValue = await counterService.getNextSequenceValue(vendorId, sequenceKey);
        return `${prefix}-${String(nextValue).padStart(6, '0')}`;
    } catch (err) {
        throw err;
    }
};

// SKU has no auto-generation convention anywhere else in this system (it's
// always vendor-entered) - a clone still needs a fresh, unique-per-vendor
// value with no manual-entry step, so this derives one from the source SKU
// and retries with a random suffix on collision, same pattern as
// generateUniqueSlug above.
const generateUniqueClonedSku = async (vendorId, originalSku) => {
    try {
        const base = `${originalSku}-COPY`;
        let candidate = base;
        let attempts = 0;

        while (await Product.findOne({ vendorId, status: { $ne: 'D' }, 'variants.sizes.sku': candidate })) {
            candidate = `${base}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            attempts++;
            if (attempts > 5) {
                throw new Error('Unable to generate a unique SKU after multiple attempts.');
            }
        }

        return candidate;
    } catch (err) {
        throw err;
    }
};

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "A" clones to "A - Copy 1", then "A - Copy 2", and so on. Cloning an
// already-cloned product (e.g. "A - Copy 1") is NOT stripped back to its
// base name first - it gets its own independent counter off its current
// full name (so cloning "A - Copy 1" produces "A - Copy 1 - Copy 1"), per
// explicit instruction.
const generateNextCloneName = async (vendorId, sourceName) => {
    try {
        const pattern = new RegExp(`^${escapeRegExp(sourceName)} - Copy (\\d+)$`);
        const candidates = await Product.find(
            { vendorId, status: { $ne: 'D' }, name: pattern },
            { name: 1 }
        ).lean();

        let maxCopyNumber = 0;
        for (const candidate of candidates) {
            const match = candidate.name.match(pattern);
            if (match) {
                const number = parseInt(match[1], 10);
                if (number > maxCopyNumber) maxCopyNumber = number;
            }
        }

        return `${sourceName} - Copy ${maxCopyNumber + 1}`;
    } catch (err) {
        throw err;
    }
};

// Shared cloning logic for both the single-product and bulk endpoints.
// Does NOT itself check isCloningProductAllowed or the product-count plan
// cap - callers check those (bulk clone checks the feature flag once for
// the whole batch, and tracks the count cap as a running local counter
// rather than re-querying per item).
//
// Everything not called out below is copied as-is from the source
// (description, colors, mainCategory/subCategory, disclaimer,
// searchKeywords, recommendedProducts, taxIds, precedence, bulkPricing,
// price/cancelledPrice/weight/policies/geo-exclusions/measurement values,
// image/additionalImages). Fields regenerated because of a uniqueness
// constraint (productCode, variantCode, sizeCode, sku, slug) or explicitly
// decided in conversation (barcode dropped, stock, status, audit fields)
// are listed inline.
const cloneOneProduct = async (vendorId, userId, sourceProduct, companySettingsData) => {
    try {
        const newName = await generateNextCloneName(vendorId, sourceProduct.name);
        const newProductCode = await generateSequentialCode(vendorId, 'productCode', 'PRD');
        const newSlug = await generateUniqueSlug(vendorId, newName);

        const clonedVariants = [];
        for (const variant of sourceProduct.variants) {
            // A variant individually soft-deleted (status 'D') is
            // discontinued debris, independent of the parent product's own
            // status - never carried into a clone.
            if (variant.status === 'D') continue;

            const clonedSizes = [];
            for (const size of variant.sizes) {
                if (size.status === 'D') continue;

                const newSizeCode = await generateSequentialCode(vendorId, 'sizeCode', 'SIZ');
                const newSku = await generateUniqueClonedSku(vendorId, size.sku);

                clonedSizes.push({
                    ...size.toObject(),
                    _id: undefined,
                    sizeCode: newSizeCode,
                    sku: newSku,
                    // Barcode mirrors a real physical barcode and is
                    // globally unique across every vendor - never
                    // duplicated onto a clone. Vendor sets a new one
                    // manually afterward if needed.
                    barcode: undefined,
                    stock: companySettingsData?.isStockCloningAllowed ? size.stock : 0,
                    status: size.status,
                    createdBy: userId,
                    updatedBy: undefined,
                    deletedBy: undefined,
                    inActiveMarkedBy: undefined,
                    activeMarkedBy: undefined,
                    activeMarkedDate: null,
                    inactiveMarkedDate: null,
                    remarks: 'CLONED'
                });
            }

            // Every size under this variant was individually deleted - the
            // variant itself carries nothing forward, so drop it too.
            if (clonedSizes.length === 0) continue;

            const newVariantCode = await generateSequentialCode(vendorId, 'variantCode', 'VAR');
            clonedVariants.push({
                ...variant.toObject(),
                _id: undefined,
                variantCode: newVariantCode,
                status: variant.status,
                createdBy: userId,
                updatedBy: undefined,
                deletedBy: undefined,
                inActiveMarkedBy: undefined,
                activeMarkedBy: undefined,
                activeMarkedDate: null,
                inactiveMarkedDate: null,
                remarks: 'CLONED',
                sizes: clonedSizes
            });
        }

        const clonedProduct = new Product({
            ...sourceProduct.toObject(),
            _id: undefined,
            __v: undefined,
            createdAt: undefined,
            updatedAt: undefined,
            name: newName,
            slug: newSlug,
            productCode: newProductCode,
            variants: clonedVariants,
            vendorId,
            status: sourceProduct.status,
            createdBy: userId,
            updatedBy: undefined,
            deletedBy: undefined,
            inActiveMarkedBy: undefined,
            activeMarkedBy: undefined,
            activeMarkedDate: null,
            inactiveMarkedDate: null,
            remarks: 'CLONED'
        });

        await clonedProduct.save();

        return common.returnResult(true, 201, 'Product cloned successfully', { product: clonedProduct });
    } catch (err) {
        throw err;
    }
};

const cloneProduct = async (vendorId, userId, companyMasterData, websiteMasterData, companySettingsData, productId) => {
    try {
        const featureCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData, 'isCloningProductAllowed', 'isCloningProductAllowed'
        );
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const sourceProduct = await Product.findOne({ _id: productId, vendorId, status: { $in: ['A', 'I'] } });
        if (!sourceProduct) {
            return common.returnResult(false, 404, 'Product not found or cannot be cloned.');
        }

        if (companyMasterData.numberOfProductsAllowed !== undefined && companyMasterData.numberOfProductsAllowed !== null) {
            const currentCount = await Product.countDocuments({ vendorId, status: { $ne: 'D' } });
            if (currentCount >= companyMasterData.numberOfProductsAllowed) {
                return common.returnResult(false, 403, `You have reached the maximum number of products (${companyMasterData.numberOfProductsAllowed}) allowed for your account.`);
            }
        }

        const result = await cloneOneProduct(vendorId, userId, sourceProduct, companySettingsData);

        if (result.isSuccess) {
            logger.logInfo(1, 0, 'Product cloned', { vendorId, sourceProductId: productId, clonedProductId: result.meta.product._id });
        }

        return result;
    } catch (err) {
        throw err;
    }
};

const bulkCloneProducts = async (vendorId, userId, companyMasterData, websiteMasterData, companySettingsData, productIds) => {
    try {
        const featureCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData, 'isCloningProductAllowed', 'isCloningProductAllowed'
        );
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        let remainingSlots = null;
        if (companyMasterData.numberOfProductsAllowed !== undefined && companyMasterData.numberOfProductsAllowed !== null) {
            const currentCount = await Product.countDocuments({ vendorId, status: { $ne: 'D' } });
            remainingSlots = companyMasterData.numberOfProductsAllowed - currentCount;
        }

        const results = [];
        let successCount = 0;
        let failureCount = 0;

        // Best-effort: one product's controlled failure (plan cap reached
        // mid-batch, not found, a returnResult-style validation failure
        // from cloneOneProduct) is recorded and skipped rather than
        // aborting the rest of the batch, per explicit instruction. A
        // genuinely unexpected exception still propagates to the outer
        // catch below, same as every other service function in this file.
        for (const productId of productIds) {
            if (remainingSlots !== null && remainingSlots <= 0) {
                results.push({ productId, isSuccess: false, message: `You have reached the maximum number of products (${companyMasterData.numberOfProductsAllowed}) allowed for your account.` });
                failureCount++;
                continue;
            }

            const sourceProduct = await Product.findOne({ _id: productId, vendorId, status: { $in: ['A', 'I'] } });
            if (!sourceProduct) {
                results.push({ productId, isSuccess: false, message: 'Product not found or cannot be cloned.' });
                failureCount++;
                continue;
            }

            const result = await cloneOneProduct(vendorId, userId, sourceProduct, companySettingsData);

            if (!result.isSuccess) {
                results.push({ productId, isSuccess: false, message: result.message });
                failureCount++;
                continue;
            }

            if (remainingSlots !== null) remainingSlots--;
            successCount++;
            results.push({ productId, isSuccess: true, message: result.message, clonedProductId: result.meta.product._id });
        }

        logger.logInfo(successCount, failureCount, 'Bulk product clone completed', { vendorId, successCount, failureCount });

        return common.returnResult(true, 200, `Cloned ${successCount} of ${productIds.length} product(s).`, { results, successCount, failureCount });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    createProduct,
    updateProduct,
    toggleProductStatus,
    deleteProduct,
    bulkToggleProductStatus,
    bulkDeleteProducts,
    cloneProduct,
    bulkCloneProducts,
    fetchAllProductsForAdmin,
    fetchProductOptionsForAdmin,
    fetchAllProductsForClient,
    fetchProductByIdForAdmin,
    fetchProductByIdForClient,
    fetchProductsByBrandForClient,
    fetchProductsByCategoryForClient,
    fetchProductsByCategoryForAdmin,
    bulkUploadProducts,
    bulkUpdateProducts,
    buildBulkProductSampleFile
};