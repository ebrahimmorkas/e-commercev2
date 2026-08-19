const Product = require('../models/Product');
const Category = require('../models/Category');
const TaxMaster = require('../models/TaxMaster');
const SizeMaster = require('../models/SizeMaster');
const UnitMaster = require('../models/UnitMaster');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const imageUploadService = require('./imageUploadService');
const counterService = require('./counterService');
const { extractZipEntries, createZipBuffer } = require('../utils/zipExtractor');
const { parseExcelBuffer } = require('../utils/excelParser');
const { processExcelRows } = require('../utils/excelRowProcessor');
const { createProductSchema } = require('../middlewares/validations/productValidations');
const slugify = require('../utils/slugify');
const crypto = require('crypto');
const path = require('path');
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
            return common.returnResult(true, 200, 'All Good', { barcode: null });
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
    vendorId, size, companyMasterData, companySettingsData,
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

// Deletes every uploaded image (main + additional) belonging to one size
// doc - used when a size/variant is removed entirely during an update, so
// its Cloudinary assets don't become orphaned.
const deleteAllImagesForSize = async (sizeDoc, userId) => {
    if (sizeDoc.image?.imageAssetId) {
        await imageUploadService.deleteImage({ imageId: sizeDoc.image.imageAssetId, userId });
    }
    for (const additional of (sizeDoc.additionalImages || [])) {
        if (additional.imageAssetId) {
            await imageUploadService.deleteImage({ imageId: additional.imageAssetId, userId });
        }
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

const shapeSizeForResponse = (size, variantCombined, isAdmin, locationContext, shouldHide) => {
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
        brand: size.brand,
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

const shapeVariantForResponse = (variant, productCombined, isAdmin, locationContext, shouldHide) => {
    const description = combineArrays(productCombined.description, variant.variantAdditionalDescription, variant.isDescriptionSameFromProductBasicDetails);
    const disclaimer = combineDisclaimerArray(productCombined.disclaimer, variant.variantAdditionalDisclaimer, variant.isDisclaimerSameFromProductBasicDetails);
    const bulkPricing = combineArrays(productCombined.bulkPricing, variant.variantAdditionalBulkPricing, variant.isBulkPricingSameFromProductBasicDetails);

    const variantCombined = { description, disclaimer, bulkPricing };

    const shapedSizes = (variant.sizes || [])
        .map(size => shapeSizeForResponse(size, variantCombined, isAdmin, locationContext, shouldHide))
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

const shapeProductForResponse = (product, isAdmin, locationContext, shouldHide) => {
    const productCombined = {
        description: product.description || [],
        disclaimer: product.disclaimer ? [product.disclaimer] : [],
        bulkPricing: product.bulkPricing || []
    };

    const shapedVariants = (product.variants || [])
        .map(variant => shapeVariantForResponse(variant, productCombined, isAdmin, locationContext, shouldHide))
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

const fetchAllProductsForAdmin = async (vendorId) => {
    try {
        const products = await common.getAll(Product, { status: { $in: ['I', 'A'] } }, vendorId);
        const shaped = products.map(p => shapeProductForResponse(p.toObject(), true, null, false));
        return common.returnResult(true, 200, 'Products fetched successfully', { products: shaped });
    } catch (err) {
        throw err;
    }
};

const fetchAllProductsForClient = async (vendorId, companySettingsData, locationCookies) => {
    try {
        const shouldHide = companySettingsData.shouldProductsBeHiddenWhenLocationsAreExcluded;
        const locationContext = await buildLocationContext(locationCookies);

        const products = await common.getAll(Product, { status: 'A' }, vendorId);
        const shaped = products
            .map(p => shapeProductForResponse(p.toObject(), false, locationContext, shouldHide))
            .filter(Boolean);

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

        const shouldHide = companySettingsData.shouldProductsBeHiddenWhenLocationsAreExcluded;
        const locationContext = await buildLocationContext(locationCookies);

        const shaped = shapeProductForResponse(product.toObject(), false, locationContext, shouldHide);
        if (!shaped) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        return common.returnResult(true, 200, 'Product fetched successfully', { product: shaped });
    } catch (err) {
        throw err;
    }
};

// =============================================================================
// BULK UPLOAD — reuses createProduct() as-is per product. See conversation
// notes: categories/recommended products must pre-exist in DB; a failure
// anywhere inside one product (any variant/size) fails that WHOLE product,
// since createProduct() validates+saves the nested tree atomically.
// =============================================================================

const PRODUCT_SHEET_COLUMNS = [
    { key: 'productTempCode', header: 'ProductTempCode*', required: true },
    { key: 'name', header: 'Name*', required: true },
    { key: 'colors', header: 'Colors*', required: true },
    { key: 'categoryPath', header: 'CategoryPath', required: false },
    { key: 'disclaimer', header: 'Disclaimer', required: false },
    { key: 'searchKeywords', header: 'SearchKeywords', required: false },
    { key: 'recommendedProductCodes', header: 'RecommendedProductCodes', required: false },
    { key: 'taxCodes', header: 'TaxCodes', required: false },
    { key: 'precedence', header: 'Precedence', required: false },
    { key: 'productCode', header: 'ProductCode', required: false }
];

const VARIANT_SHEET_COLUMNS = [
    { key: 'variantTempCode', header: 'VariantTempCode*', required: true },
    { key: 'productTempCode', header: 'ProductTempCode*', required: true },
    { key: 'isDefaultVariant', header: 'IsDefaultVariant*', required: true },
    { key: 'color', header: 'Color', required: false },
    { key: 'displayName', header: 'DisplayName', required: false },
    { key: 'isDescriptionSameFromProductBasicDetails', header: 'IsDescriptionSameFromProductBasicDetails*', required: true },
    { key: 'isDisclaimerSameFromProductBasicDetails', header: 'IsDisclaimerSameFromProductBasicDetails*', required: true },
    { key: 'isBulkPricingSameFromProductBasicDetails', header: 'IsBulkPricingSameFromProductBasicDetails*', required: true },
    { key: 'variantAdditionalDisclaimer', header: 'VariantAdditionalDisclaimer', required: false },
    { key: 'variantCode', header: 'VariantCode', required: false }
];

const SIZE_SHEET_COLUMNS = [
    { key: 'sizeTempCode', header: 'SizeTempCode*', required: true },
    { key: 'variantTempCode', header: 'VariantTempCode*', required: true },
    { key: 'isDefaultSize', header: 'IsDefaultSize*', required: true },
    { key: 'sizeType', header: 'SizeType*', required: true },
    { key: 'sizeMasterName', header: 'SizeMasterName*', required: true },
    { key: 'sizeName', header: 'SizeName*', required: true },
    { key: 'labelValue', header: 'LabelValue', required: false },
    { key: 'brand', header: 'Brand', required: false },
    { key: 'price', header: 'Price*', required: true },
    { key: 'cancelledPrice', header: 'CancelledPrice', required: false },
    { key: 'stock', header: 'Stock', required: false },
    { key: 'weightValue', header: 'WeightValue', required: false },
    { key: 'weightUnitName', header: 'WeightUnitName', required: false },
    { key: 'sku', header: 'SKU*', required: true },
    { key: 'barcode', header: 'Barcode', required: false },
    { key: 'sizeCode', header: 'SizeCode', required: false },
    { key: 'isDescriptionSameFromVariantsDetails', header: 'IsDescriptionSameFromVariantsDetails*', required: true },
    { key: 'isDisclaimerSameFromVariantsDetails', header: 'IsDisclaimerSameFromVariantsDetails*', required: true },
    { key: 'isBulkPricingSameFromVariantsDetails', header: 'IsBulkPricingSameFromVariantsDetails*', required: true },
    { key: 'sizeAdditionalDisclaimer', header: 'SizeAdditionalDisclaimer', required: false },
    { key: 'excludeCountries', header: 'ExcludeCountries', required: false },
    { key: 'excludeStates', header: 'ExcludeStates', required: false },
    { key: 'excludeCities', header: 'ExcludeCities', required: false },
    { key: 'excludeZipCodes', header: 'ExcludeZipCodes', required: false },
    { key: 'precedence', header: 'Precedence', required: false },
    { key: 'warrantyAvailable', header: 'WarrantyAvailable*', required: true },
    { key: 'warrantyDuration', header: 'WarrantyDuration', required: false },
    { key: 'warrantyDurationType', header: 'WarrantyDurationType', required: false },
    { key: 'returnAvailable', header: 'ReturnAvailable*', required: true },
    { key: 'returnDuration', header: 'ReturnDuration', required: false },
    { key: 'returnDurationType', header: 'ReturnDurationType', required: false },
    { key: 'exchangeAvailable', header: 'ExchangeAvailable*', required: true },
    { key: 'exchangeDuration', header: 'ExchangeDuration', required: false },
    { key: 'exchangeDurationType', header: 'ExchangeDurationType', required: false },
    { key: 'shippingType', header: 'ShippingType*', required: true },
    { key: 'shippingValue', header: 'ShippingValue', required: false },
    { key: 'mainImageFileName', header: 'MainImageFileName', required: false },
    { key: 'additionalImageFileNames', header: 'AdditionalImageFileNames', required: false }
];

const MEASUREMENT_VALUE_SHEET_COLUMNS = [
    { key: 'sizeTempCode', header: 'SizeTempCode*', required: true },
    { key: 'measurementLabel', header: 'MeasurementLabel*', required: true },
    { key: 'unitName', header: 'UnitName*', required: true },
    { key: 'value', header: 'Value*', required: true }
];

const DESCRIPTION_SHEET_COLUMNS = [
    { key: 'level', header: 'Level*', required: true },
    { key: 'refTempCode', header: 'RefTempCode*', required: true },
    { key: 'key', header: 'Key*', required: true },
    { key: 'value', header: 'Value*', required: true }
];

const BULK_PRICING_SHEET_COLUMNS = [
    { key: 'level', header: 'Level*', required: true },
    { key: 'refTempCode', header: 'RefTempCode*', required: true },
    { key: 'minimumQuantity', header: 'MinimumQuantity*', required: true },
    { key: 'maximumQuantity', header: 'MaximumQuantity*', required: true },
    { key: 'price', header: 'Price*', required: true }
];

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseBoolean = (val) => {
    if (typeof val === 'boolean') return val;
    if (val === null || val === undefined || val === '') return undefined;
    const s = String(val).trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    return undefined;
};

const parseCsv = (val) => {
    if (!val) return [];
    return String(val).split(',').map(s => s.trim()).filter(Boolean);
};

const bulkUploadProducts = async (vendorId, userId, excelBuffer, mainImagesZipBuffer, additionalImagesZipBuffer, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const { rows: productRows } = await parseExcelBuffer(excelBuffer, PRODUCT_SHEET_COLUMNS, { sheetName: 'Products' });
        const { rows: variantRows } = await parseExcelBuffer(excelBuffer, VARIANT_SHEET_COLUMNS, { sheetName: 'Variants' });
        const { rows: sizeRows } = await parseExcelBuffer(excelBuffer, SIZE_SHEET_COLUMNS, { sheetName: 'Sizes' });
        const { rows: measurementValueRows } = await parseExcelBuffer(excelBuffer, MEASUREMENT_VALUE_SHEET_COLUMNS, { sheetName: 'MeasurementValues' });
        const { rows: descriptionRows } = await parseExcelBuffer(excelBuffer, DESCRIPTION_SHEET_COLUMNS, { sheetName: 'Descriptions' });
        const { rows: bulkPricingRows } = await parseExcelBuffer(excelBuffer, BULK_PRICING_SHEET_COLUMNS, { sheetName: 'BulkPricing' });

        if (productRows.length === 0) {
            return common.returnResult(false, 400, 'Products sheet contains no data rows');
        }

        let mainImageEntries, additionalImageEntries;
        try {
            mainImageEntries = mainImagesZipBuffer ? extractZipEntries(mainImagesZipBuffer) : new Map();
            additionalImageEntries = additionalImagesZipBuffer ? extractZipEntries(additionalImagesZipBuffer) : new Map();
        } catch (err) {
            return common.returnResult(false, 400, `Could not read image zip file(s): ${err.message}`);
        }

        const variantsByProduct = new Map();
        for (const v of variantRows) {
            const key = (v.productTempCode || '').trim();
            if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
            variantsByProduct.get(key).push(v);
        }

        const sizesByVariant = new Map();
        for (const s of sizeRows) {
            const key = (s.variantTempCode || '').trim();
            if (!sizesByVariant.has(key)) sizesByVariant.set(key, []);
            sizesByVariant.get(key).push(s);
        }

        const measurementValuesBySize = new Map();
        for (const mv of measurementValueRows) {
            const key = (mv.sizeTempCode || '').trim();
            if (!measurementValuesBySize.has(key)) measurementValuesBySize.set(key, []);
            measurementValuesBySize.get(key).push(mv);
        }

        const descriptionsByRef = new Map();
        for (const d of descriptionRows) {
            const key = `${(d.level || '').trim().toLowerCase()}::${(d.refTempCode || '').trim()}`;
            if (!descriptionsByRef.has(key)) descriptionsByRef.set(key, []);
            descriptionsByRef.get(key).push(d);
        }

        const bulkPricingByRef = new Map();
        for (const bp of bulkPricingRows) {
            const key = `${(bp.level || '').trim().toLowerCase()}::${(bp.refTempCode || '').trim()}`;
            if (!bulkPricingByRef.has(key)) bulkPricingByRef.set(key, []);
            bulkPricingByRef.get(key).push(bp);
        }

        const sizeMasterCache = new Map();
        const unitCache = new Map();
        const countryCache = new Map();
        const stateCache = new Map();
        const cityCache = new Map();

        const resolveSizeMasterByName = async (name) => {
            const key = name.trim().toLowerCase();
            if (sizeMasterCache.has(key)) return sizeMasterCache.get(key);
            const doc = await SizeMaster.findOne({ status: 'A', name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' } });
            sizeMasterCache.set(key, doc || null);
            return doc || null;
        };

        const resolveUnitByName = async (name) => {
            const key = name.trim().toLowerCase();
            if (unitCache.has(key)) return unitCache.get(key);
            const doc = await UnitMaster.findOne({ status: 'A', name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' } });
            unitCache.set(key, doc ? doc._id : null);
            return doc ? doc._id : null;
        };

        const resolveCountryByName = async (name) => {
            const key = name.trim().toLowerCase();
            if (countryCache.has(key)) return countryCache.get(key);
            const doc = await CountryMaster.findOne({ status: 'A', country_name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' } });
            countryCache.set(key, doc ? doc._id : null);
            return doc ? doc._id : null;
        };

        const resolveStateByName = async (name) => {
            const key = name.trim().toLowerCase();
            if (stateCache.has(key)) return stateCache.get(key);
            const doc = await StateMaster.findOne({ status: 'A', state_name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' } });
            stateCache.set(key, doc ? doc._id : null);
            return doc ? doc._id : null;
        };

        const resolveCityByName = async (name) => {
            const key = name.trim().toLowerCase();
            if (cityCache.has(key)) return cityCache.get(key);
            const doc = await CityMaster.findOne({ status: 'A', city_name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' } });
            cityCache.set(key, doc ? doc._id : null);
            return doc ? doc._id : null;
        };

        // Path must fully pre-exist in DB (per your decision) - first segment
        // = mainCategory (root), last segment = subCategory (exact target).
        const resolveCategoryPath = async (pathStr) => {
            const segments = pathStr.split('>').map(s => s.trim()).filter(Boolean);
            if (segments.length === 0) return { error: 'CategoryPath is empty or invalid' };

            let currentParentId = null;
            let currentDoc = null;
            for (const segment of segments) {
                currentDoc = await Category.findOne({
                    vendorId, parent_category_id: currentParentId, status: 'A',
                    categoryName: { $regex: `^${escapeRegex(segment)}$`, $options: 'i' }
                });
                if (!currentDoc) return { error: `Category "${segment}" not found under the given CategoryPath` };
                currentParentId = currentDoc._id;
            }

            const mainCategoryDoc = await Category.findOne({
                vendorId, status: 'A', parent_category_id: null,
                categoryName: { $regex: `^${escapeRegex(segments[0])}$`, $options: 'i' }
            });
            if (!mainCategoryDoc) return { error: `Top-level category "${segments[0]}" not found` };

            return { mainCategory: mainCategoryDoc._id.toString(), subCategory: currentDoc._id.toString() };
        };

        const result = await processExcelRows(
            productRows,
            async (productRow) => {
                const productTempCode = (productRow.productTempCode || '').trim();
                if (!productTempCode) {
                    return { success: false, errors: ['ProductTempCode is required'] };
                }

                const variantRowsForProduct = variantsByProduct.get(productTempCode) || [];
                if (variantRowsForProduct.length === 0) {
                    return { success: false, errors: [`No variants found on the Variants sheet for ProductTempCode "${productTempCode}"`] };
                }

                const assembledVariants = [];
                const imagePlan = [];

                for (let v = 0; v < variantRowsForProduct.length; v++) {
                    const variantRow = variantRowsForProduct[v];
                    const variantTempCode = (variantRow.variantTempCode || '').trim();
                    if (!variantTempCode) {
                        return { success: false, errors: [`VariantTempCode missing for a variant under ProductTempCode "${productTempCode}"`] };
                    }

                    const sizeRowsForVariant = sizesByVariant.get(variantTempCode) || [];
                    if (sizeRowsForVariant.length === 0) {
                        return { success: false, errors: [`No sizes found on the Sizes sheet for VariantTempCode "${variantTempCode}"`] };
                    }

                    const assembledSizes = [];

                    for (let s = 0; s < sizeRowsForVariant.length; s++) {
                        const sizeRow = sizeRowsForVariant[s];
                        const sizeTempCode = (sizeRow.sizeTempCode || '').trim();
                        if (!sizeTempCode) {
                            return { success: false, errors: [`SizeTempCode missing under VariantTempCode "${variantTempCode}"`] };
                        }

                        if (!sizeRow.sizeMasterName) {
                            return { success: false, errors: [`SizeMasterName missing for SizeTempCode "${sizeTempCode}"`] };
                        }
                        const sizeMasterDoc = await resolveSizeMasterByName(sizeRow.sizeMasterName);
                        if (!sizeMasterDoc) {
                            return { success: false, errors: [`Size "${sizeRow.sizeMasterName}" not found for SizeTempCode "${sizeTempCode}"`] };
                        }

                        const sizeType = (sizeRow.sizeType || '').trim().toUpperCase();

                        let values;
                        if (sizeType === 'MEASURABLE') {
                            const mvRows = measurementValuesBySize.get(sizeTempCode) || [];
                            if (mvRows.length === 0) {
                                return { success: false, errors: [`No MeasurementValues rows found for SizeTempCode "${sizeTempCode}" (required for MEASURABLE sizes)`] };
                            }
                            values = [];
                            for (const mv of mvRows) {
                                const measurementDef = (sizeMasterDoc.measurements || []).find(
                                    m => m.label.trim().toLowerCase() === String(mv.measurementLabel || '').trim().toLowerCase()
                                );
                                if (!measurementDef) {
                                    return { success: false, errors: [`Measurement "${mv.measurementLabel}" not found on size "${sizeRow.sizeMasterName}" (SizeTempCode "${sizeTempCode}")`] };
                                }
                                const unitId = await resolveUnitByName(String(mv.unitName || ''));
                                if (!unitId) {
                                    return { success: false, errors: [`Unit "${mv.unitName}" not found for SizeTempCode "${sizeTempCode}"`] };
                                }
                                values.push({
                                    measurementId: measurementDef._id.toString(),
                                    unit: unitId.toString(),
                                    value: Number(mv.value)
                                });
                            }
                        }

                        let weight;
                        if (sizeRow.weightValue !== null && sizeRow.weightValue !== undefined && sizeRow.weightValue !== '') {
                            if (!sizeRow.weightUnitName) {
                                return { success: false, errors: [`WeightUnitName is required when WeightValue is provided (SizeTempCode "${sizeTempCode}")`] };
                            }
                            const weightUnitId = await resolveUnitByName(String(sizeRow.weightUnitName));
                            if (!weightUnitId) {
                                return { success: false, errors: [`Weight unit "${sizeRow.weightUnitName}" not found for SizeTempCode "${sizeTempCode}"`] };
                            }
                            weight = { value: Number(sizeRow.weightValue), unit: weightUnitId.toString() };
                        }

                        const excludeCountries = [];
                        for (const name of parseCsv(sizeRow.excludeCountries)) {
                            const id = await resolveCountryByName(name);
                            if (!id) return { success: false, errors: [`Excluded country "${name}" not found (SizeTempCode "${sizeTempCode}")`] };
                            excludeCountries.push(id.toString());
                        }
                        const excludeStates = [];
                        for (const name of parseCsv(sizeRow.excludeStates)) {
                            const id = await resolveStateByName(name);
                            if (!id) return { success: false, errors: [`Excluded state "${name}" not found (SizeTempCode "${sizeTempCode}")`] };
                            excludeStates.push(id.toString());
                        }
                        const excludeCities = [];
                        for (const name of parseCsv(sizeRow.excludeCities)) {
                            const id = await resolveCityByName(name);
                            if (!id) return { success: false, errors: [`Excluded city "${name}" not found (SizeTempCode "${sizeTempCode}")`] };
                            excludeCities.push(id.toString());
                        }
                        const excludeZipCodes = parseCsv(sizeRow.excludeZipCodes);

                        const additionalImagePaths = parseCsv(sizeRow.additionalImageFileNames);
                        const additionalLimit = companyMasterData.numberOfAdditionalImagesAllowedInVariant;
                        if (additionalLimit !== undefined && additionalLimit !== null && additionalImagePaths.length > additionalLimit) {
                            return { success: false, errors: [`SizeTempCode "${sizeTempCode}" has ${additionalImagePaths.length} additional images, exceeding the allowed limit of ${additionalLimit}`] };
                        }

                        assembledSizes.push({
                            isDefaultSize: parseBoolean(sizeRow.isDefaultSize),
                            sizeType,
                            sizeName: sizeRow.sizeName,
                            sizeAdditionalDisclaimer: sizeRow.sizeAdditionalDisclaimer || undefined,
                            sizeAdditionalDescription: (descriptionsByRef.get(`size::${sizeTempCode}`) || []).map(d => ({ key: d.key, value: d.value })),
                            sizeAdditionalBulkPricing: (bulkPricingByRef.get(`size::${sizeTempCode}`) || []).map(bp => ({
                                minimumQuantity: Number(bp.minimumQuantity), maximumQuantity: Number(bp.maximumQuantity), price: Number(bp.price)
                            })),
                            warranty: {
                                isAvailable: parseBoolean(sizeRow.warrantyAvailable),
                                duration: sizeRow.warrantyDuration != null && sizeRow.warrantyDuration !== '' ? Number(sizeRow.warrantyDuration) : undefined,
                                durationType: sizeRow.warrantyDurationType || undefined
                            },
                            return: {
                                isAvailable: parseBoolean(sizeRow.returnAvailable),
                                duration: sizeRow.returnDuration != null && sizeRow.returnDuration !== '' ? Number(sizeRow.returnDuration) : undefined,
                                durationType: sizeRow.returnDurationType || undefined
                            },
                            exchange: {
                                isAvailable: parseBoolean(sizeRow.exchangeAvailable),
                                duration: sizeRow.exchangeDuration != null && sizeRow.exchangeDuration !== '' ? Number(sizeRow.exchangeDuration) : undefined,
                                durationType: sizeRow.exchangeDurationType || undefined
                            },
                            shipping: sizeRow.shippingType ? {
                                type: String(sizeRow.shippingType).trim().toUpperCase(),
                                value: sizeRow.shippingValue != null && sizeRow.shippingValue !== '' ? Number(sizeRow.shippingValue) : undefined
                            } : null,
                            isDescriptionSameFromVariantsDetails: parseBoolean(sizeRow.isDescriptionSameFromVariantsDetails),
                            isDisclaimerSameFromVariantsDetails: parseBoolean(sizeRow.isDisclaimerSameFromVariantsDetails),
                            isBulkPricingSameFromVariantsDetails: parseBoolean(sizeRow.isBulkPricingSameFromVariantsDetails),
                            precedence: sizeRow.precedence != null && sizeRow.precedence !== '' ? Number(sizeRow.precedence) : undefined,
                            excludeCountries, excludeStates, excludeCities, excludeZipCodes,
                            brand: sizeRow.brand || undefined,
                            sizeId: sizeMasterDoc._id.toString(),
                            values,
                            labelValue: sizeType === 'LABEL' ? sizeRow.labelValue : undefined,
                            price: Number(sizeRow.price),
                            cancelledPrice: sizeRow.cancelledPrice != null && sizeRow.cancelledPrice !== '' ? Number(sizeRow.cancelledPrice) : undefined,
                            stock: sizeRow.stock != null && sizeRow.stock !== '' ? Number(sizeRow.stock) : undefined,
                            weight,
                            sku: sizeRow.sku,
                            barcode: sizeRow.barcode || undefined,
                            sizeCode: sizeRow.sizeCode || undefined
                        });

                        imagePlan.push({
                            v, s, sizeTempCode,
                            mainImagePath: sizeRow.mainImageFileName ? String(sizeRow.mainImageFileName).trim() : null,
                            additionalImagePaths
                        });
                    }

                    assembledVariants.push({
                        isDefaultVariant: parseBoolean(variantRow.isDefaultVariant),
                        color: variantRow.color || undefined,
                        displayName: variantRow.displayName || undefined,
                        sizes: assembledSizes,
                        variantAdditionalDisclaimer: variantRow.variantAdditionalDisclaimer || undefined,
                        variantAdditionalDescription: (descriptionsByRef.get(`variant::${variantTempCode}`) || []).map(d => ({ key: d.key, value: d.value })),
                        variantAdditionalBulkPricing: (bulkPricingByRef.get(`variant::${variantTempCode}`) || []).map(bp => ({
                            minimumQuantity: Number(bp.minimumQuantity), maximumQuantity: Number(bp.maximumQuantity), price: Number(bp.price)
                        })),
                        isDescriptionSameFromProductBasicDetails: parseBoolean(variantRow.isDescriptionSameFromProductBasicDetails),
                        isDisclaimerSameFromProductBasicDetails: parseBoolean(variantRow.isDisclaimerSameFromProductBasicDetails),
                        isBulkPricingSameFromProductBasicDetails: parseBoolean(variantRow.isBulkPricingSameFromProductBasicDetails),
                        variantCode: variantRow.variantCode || undefined
                    });
                }

                if (!productRow.categoryPath) {
                    return { success: false, errors: [`CategoryPath is required (ProductTempCode "${productTempCode}")`] };
                }
                const categoryResult = await resolveCategoryPath(productRow.categoryPath);
                if (categoryResult.error) {
                    return { success: false, errors: [categoryResult.error] };
                }

                const recommendedProductCodes = parseCsv(productRow.recommendedProductCodes);
                let recommendedProducts = [];
                if (recommendedProductCodes.length > 0) {
                    const docs = await Product.find({
                        vendorId, status: 'A',
                        productCode: { $in: recommendedProductCodes.map(c => c.toUpperCase()) }
                    }, { _id: 1, productCode: 1 }).lean();
                    const foundCodes = new Set(docs.map(d => d.productCode));
                    const missing = recommendedProductCodes.filter(c => !foundCodes.has(c.toUpperCase()));
                    if (missing.length > 0) {
                        return { success: false, errors: [`Recommended product code(s) not found: ${missing.join(', ')}`] };
                    }
                    recommendedProducts = docs.map(d => d._id.toString());
                }

                const taxCodes = parseCsv(productRow.taxCodes);
                let taxIds = [];
                if (taxCodes.length > 0) {
                    const docs = await TaxMaster.find({ status: 'A', code: { $in: taxCodes.map(c => c.toUpperCase()) } }, { _id: 1, code: 1 }).lean();
                    const foundCodes = new Set(docs.map(d => d.code));
                    const missing = taxCodes.filter(c => !foundCodes.has(c.toUpperCase()));
                    if (missing.length > 0) {
                        return { success: false, errors: [`Tax code(s) not found: ${missing.join(', ')}`] };
                    }
                    taxIds = docs.map(d => d._id.toString());
                }

                const assembledBody = {
                    name: productRow.name,
                    description: (descriptionsByRef.get(`product::${productTempCode}`) || []).map(d => ({ key: d.key, value: d.value })),
                    disclaimer: productRow.disclaimer || undefined,
                    colors: parseCsv(productRow.colors),
                    mainCategory: categoryResult.mainCategory,
                    subCategory: categoryResult.subCategory,
                    searchKeywords: parseCsv(productRow.searchKeywords),
                    recommendedProducts,
                    taxIds,
                    precedence: productRow.precedence != null && productRow.precedence !== '' ? Number(productRow.precedence) : undefined,
                    productCode: productRow.productCode || undefined,
                    bulkPricing: (bulkPricingByRef.get(`product::${productTempCode}`) || []).map(bp => ({
                        minimumQuantity: Number(bp.minimumQuantity), maximumQuantity: Number(bp.maximumQuantity), price: Number(bp.price)
                    })),
                    variants: assembledVariants
                };

                const { error, value } = createProductSchema.validate(assembledBody, { abortEarly: false });
                if (error) {
                    return { success: false, errors: error.details.map(d => d.message.replace(/"/g, '')) };
                }

                const pseudoFiles = [];
                for (const plan of imagePlan) {
                    if (plan.mainImagePath) {
                        const imgBuffer = mainImageEntries.get(plan.mainImagePath.toLowerCase());
                        if (!imgBuffer) {
                            return { success: false, errors: [`Main image "${plan.mainImagePath}" not found in main images zip (SizeTempCode "${plan.sizeTempCode}")`] };
                        }
                        pseudoFiles.push({
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
                            const imgBuffer = additionalImageEntries.get(imgPath.toLowerCase());
                            if (!imgBuffer) {
                                return { success: false, errors: [`Additional image "${imgPath}" not found in additional images zip (SizeTempCode "${plan.sizeTempCode}")`] };
                            }
                            zipEntriesForSize.push({ name: path.basename(imgPath), buffer: imgBuffer });
                        }
                        const miniZipBuffer = createZipBuffer(zipEntriesForSize);
                        pseudoFiles.push({
                            fieldname: `sizeAdditionalImages_${plan.v}_${plan.s}`,
                            originalname: `${plan.sizeTempCode}-additional.zip`,
                            mimetype: 'application/zip',
                            buffer: miniZipBuffer,
                            size: miniZipBuffer.length
                        });
                    }
                }

                const createResult = await createProduct(
                    vendorId, userId, companyMasterData, websiteMasterData, companySettingsData, value, pseudoFiles
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

        // --- bulk pricing feature gate (product-level, variant-level, AND size-level) -
        const hasBulkPricing = (rest.bulkPricing && rest.bulkPricing.length > 0) ||
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
        // (numberOfProductsAllowed - total product count cap - intentionally
        // NOT re-checked here; update doesn't create a new product.)
        if (companyMasterData.numberOfProductsVaiantsAllowed !== undefined && companyMasterData.numberOfProductsVaiantsAllowed !== null) {
            if ((submittedVariants || []).length > companyMasterData.numberOfProductsVaiantsAllowed) {
                return common.returnResult(false, 403, `You can add a maximum of ${companyMasterData.numberOfProductsVaiantsAllowed} variant(s) per product.`);
            }
        }

        // --- slug: only regenerate if the name actually changed ---------------------
        let slug = existingProduct.slug;
        if (rest.name && rest.name !== existingProduct.name) {
            slug = await generateUniqueSlug(vendorId, rest.name, productId);
        }

        const existingVariantsMap = new Map(existingProduct.variants.map(v => [v._id.toString(), v]));
        const incomingVariantIds = new Set();

        const productBulkBounds = getBulkPricingBounds(rest.bulkPricing);
        const productMaxBulkPrice = (rest.bulkPricing && rest.bulkPricing.length > 0)
            ? Math.max(...rest.bulkPricing.map(b => b.price))
            : null;

        const usedManualVariantCodesInPayload = new Set();
        const usedManualSizeCodesInPayload = new Set();
        const usedManualSkusInPayload = new Set();
        const usedManualBarcodesInPayload = new Set();
        const sizeMasterCache = new Map();

        const variants = [];

        for (const variant of (submittedVariants || [])) {
            const isExistingVariant = variant._id && existingVariantsMap.has(variant._id.toString());
            const existingVariantDoc = isExistingVariant ? existingVariantsMap.get(variant._id.toString()) : null;
            if (isExistingVariant) incomingVariantIds.add(variant._id.toString());

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
                    ...(rest.bulkPricing || []),
                    ...(variant.variantAdditionalBulkPricing || [])
                ];
                variantBulkBounds = getBulkPricingBounds(effectiveVariantArray);
            }

            const existingSizesMap = existingVariantDoc ? new Map(existingVariantDoc.sizes.map(s => [s._id.toString(), s])) : new Map();
            const incomingSizeIds = new Set();
            const resolvedSizes = [];

            for (const size of (variant.sizes || [])) {
                const isExistingSize = size._id && existingSizesMap.has(size._id.toString());
                const existingSizeDoc = isExistingSize ? existingSizesMap.get(size._id.toString()) : null;
                if (isExistingSize) incomingSizeIds.add(size._id.toString());

                const sizeResult = await resolveSize({
                    vendorId, size, companyMasterData, companySettingsData,
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
                    image: existingSizeDoc ? existingSizeDoc.image : undefined,
                    additionalImages: existingSizeDoc ? existingSizeDoc.additionalImages : [],
                    createdBy: existingSizeDoc ? existingSizeDoc.createdBy : userId,
                    updatedBy: userId,
                    status: 'A',
                    remarks: existingSizeDoc ? existingSizeDoc.remarks : 'MANUAL'
                });
            }

            // --- sizes removed from this variant: clean up their images ------------
            for (const [existingSizeId, existingSizeDoc] of existingSizesMap) {
                if (!incomingSizeIds.has(existingSizeId)) {
                    await deleteAllImagesForSize(existingSizeDoc, userId);
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
        for (const [existingVariantId, existingVariantDoc] of existingVariantsMap) {
            if (!incomingVariantIds.has(existingVariantId)) {
                for (const existingSizeDoc of existingVariantDoc.sizes) {
                    await deleteAllImagesForSize(existingSizeDoc, userId);
                }
            }
        }

        // --- attach new images, matched by variant+size array position ------------
        // Positions with no new files keep whatever was carried forward
        // above untouched.
        const groupedFiles = groupSizeFiles(files);
        for (let v = 0; v < variants.length; v++) {
            for (let s = 0; s < variants[v].sizes.length; s++) {
                const sizeFiles = groupedFiles[v]?.[s];
                if (!sizeFiles) continue;

                const imagesResult = await applySizeImages({
                    vendorId, userId, sizeFiles,
                    existingImage: variants[v].sizes[s].image || null,
                    existingAdditionalImages: variants[v].sizes[s].additionalImages || [],
                    companyMasterData, websiteMasterData
                });
                if (!imagesResult.isSuccess) {
                    return common.returnResult(false, imagesResult.statusCode, imagesResult.message);
                }
                if (imagesResult.meta.image) variants[v].sizes[s].image = imagesResult.meta.image;
                if (imagesResult.meta.additionalImages) variants[v].sizes[s].additionalImages = imagesResult.meta.additionalImages;
            }
        }

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

        logger.logInfo(1, 0, 'Product status updated', { vendorId, productId, status });

        return common.returnResult(true, 200, 'Product status updated successfully', { product: result.document });
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

        logger.logInfo(1, 0, 'Product deleted', { vendorId, productId });

        return common.returnResult(true, 200, 'Product deleted successfully');
    } catch (err) {
        throw err;
    }
};

module.exports = {
    createProduct,
    updateProduct,
    toggleProductStatus,
    deleteProduct,
    fetchAllProductsForAdmin,
    fetchAllProductsForClient,
    fetchProductByIdForAdmin,
    fetchProductByIdForClient,
    bulkUploadProducts
};