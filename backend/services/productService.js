const Product = require('../models/Product');
const Category = require('../models/Category');
const TaxMaster = require('../models/TaxMaster');
const SizeMaster = require('../models/SizeMaster');
const UnitMaster = require('../models/UnitMaster');
const imageUploadService = require('./imageUploadService');
const counterService = require('./counterService');
const { extractZipEntries } = require('../utils/zipExtractor');
const slugify = require('../utils/slugify');
const crypto = require('crypto');
const common = require('../utils/common');
const logger = require('../utils/logger');

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
const applySizeImages = async ({
    vendorId, userId, sizeFiles, existingImage, existingAdditionalImages, companyMasterData, websiteMasterData
}) => {
    const result = {};

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
    }

    // --- additional images (one image OR one zip) -----------------------
    if (sizeFiles?.additionalImages?.length) {
        if (sizeFiles.additionalImages.length > 1) {
            return common.returnResult(false, 400, 'Only one file is allowed for additional images per size - send a single image, or a single .zip containing multiple images.');
        }

        const { files: expandedFiles, isFromZip } = resolveAdditionalImageFiles(sizeFiles.additionalImages);
        const limit = companyMasterData.numberOfAdditionalImagesAllowedInVariant;

        if (!isFromZip && limit !== undefined && limit !== null && expandedFiles.length > limit) {
            return common.returnResult(false, 403, `Only ${limit} additional image(s) allowed per size.`);
        }

        // Full replace, same semantics as the rest of this system.
        for (const old of (existingAdditionalImages || [])) {
            if (old.imageAssetId) {
                await imageUploadService.deleteImage({ imageId: old.imageAssetId, userId });
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
                return common.returnResult(false, uploadResult.statusCode, uploadResult.message);
            }

            uploaded.push({ url: uploadResult.meta.image.url, imageAssetId: uploadResult.meta.image._id });
        }
        result.additionalImages = uploaded;
    }

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

        const existing = await Product.find(
            { _id: { $in: recommendedProducts }, vendorId, status: 'A' },
            { _id: 1 }
        ).lean();
        const existingIds = new Set(existing.map(doc => doc._id.toString()));

        const missing = recommendedProducts.filter(id => !existingIds.has(id.toString()));
        if (missing.length > 0) {
            return common.returnResult(false, 400, `One or more recommended products not found: ${missing.join(', ')}`);
        }

        return common.returnResult(true, 200, 'All Good');
    } catch (err) {
        throw err;
    }
};

const resolveProductCode = async ({ vendorId, productCode, companySettingsData }) => {
    try {
        console.log(`company settings data is ${companySettingsData}`)
        if (companySettingsData.isProductCodeAutoGenerated) {
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

const resolveVariantCode = async ({ vendorId, variantCode, companySettingsData, usedManualCodesInPayload }) => {
    try {
        if (companySettingsData.isVariantCodeAutoGenerated) {
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
        if (companySettingsData.isSizeCodeAutoGenerated) {
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

const resolveSizeSku = async ({ vendorId, sku, usedManualSkusInPayload }) => {
    try {
        const normalizedSku = sku.trim().toUpperCase();

        if (usedManualSkusInPayload.has(normalizedSku)) {
            return common.returnResult(false, 400, `SKU "${normalizedSku}" is used more than once in this request.`);
        }
        usedManualSkusInPayload.add(normalizedSku);

        // Vendor-wide uniqueness - across ALL of this vendor's products.
        const existing = await Product.findOne({
            vendorId,
            status: { $ne: 'D' },
            'variants.sizes.sku': normalizedSku
        });
        if (existing) {
            return common.returnResult(false, 409, `SKU "${normalizedSku}" already exists.`);
        }

        return common.returnResult(true, 200, 'All Good', { sku: normalizedSku });
    } catch (err) {
        throw err;
    }
};

const resolveSizeBarcode = async ({ barcode, usedManualBarcodesInPayload }) => {
    try {
        if (!barcode) {
            return common.returnResult(true, 200, 'All Good', { barcode: null });
        }

        const normalizedBarcode = barcode.trim();

        if (usedManualBarcodesInPayload.has(normalizedBarcode)) {
            return common.returnResult(false, 400, `Barcode "${normalizedBarcode}" is used more than once in this request.`);
        }
        usedManualBarcodesInPayload.add(normalizedBarcode);

        // Globally unique across ALL vendors - deliberately not vendorId-scoped.
        const existing = await Product.findOne({
            status: { $ne: 'D' },
            'variants.sizes.barcode': normalizedBarcode
        });
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
    vendorId, size, companyMasterData, companySettingsData,
    sizeMasterCache, usedManualSkusInPayload, usedManualBarcodesInPayload, usedManualSizeCodesInPayload
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
            const unitDoc = await UnitMaster.findOne({ _id: size.weight.unit, status: 'A' });
            if (!unitDoc) {
                return common.returnResult(false, 400, 'Weight unit not found or inactive.');
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

        // --- sku / barcode / sizeCode --------------------------------------------
        const skuResult = await resolveSizeSku({ vendorId, sku: size.sku, usedManualSkusInPayload });
        if (!skuResult.isSuccess) {
            return common.returnResult(false, skuResult.statusCode, skuResult.message);
        }

        const barcodeResult = await resolveSizeBarcode({ barcode: size.barcode, usedManualBarcodesInPayload });
        if (!barcodeResult.isSuccess) {
            return common.returnResult(false, barcodeResult.statusCode, barcodeResult.message);
        }

        const sizeCodeResult = await resolveSizeCode({
            vendorId, sizeCode: size.sizeCode, companySettingsData, usedManualCodesInPayload: usedManualSizeCodesInPayload
        });
        if (!sizeCodeResult.isSuccess) {
            return common.returnResult(false, sizeCodeResult.statusCode, sizeCodeResult.message);
        }

        return common.returnResult(true, 200, 'All Good', {
            sku: skuResult.meta.sku,
            barcode: barcodeResult.meta.barcode,
            sizeCode: sizeCodeResult.meta.sizeCode,
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

const generateUniqueSlug = async (vendorId, name) => {
    try {
        const base = slugify(name);
        let candidate = base;
        let attempts = 0;

        while (await Product.findOne({ vendorId, slug: candidate, status: { $ne: 'D' } })) {
            candidate = `${base}-${crypto.randomBytes(3).toString('hex')}`;
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
// Exported service functions
// ---------------------------------------------------------------------------

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
                return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
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
                    vendorId, size, companyMasterData, companySettingsData,
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

        await product.save();

        logger.logInfo(1, 0, 'Product created successfully', { vendorId, productId: product._id });

        return common.returnResult(true, 201, 'Product created successfully', { product });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    createProduct
    // TODO: updateProduct, deleteProduct, fetchAllProductsForAdmin,
    // fetchAllProductsForClient, fetchProductById - add incrementally.
};