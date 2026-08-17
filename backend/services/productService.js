const Product = require('../models/Product');
const Category = require('../models/Category');
const TaxMaster = require('../models/TaxMaster');
const imageUploadService = require('./imageUploadService');
const counterService = require('./counterService');
const { extractZipEntries } = require('../utils/zipExtractor');
const slugify = require('../utils/slugify');
const crypto = require('crypto');
const common = require('../utils/common');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Image-handling helpers.
// Kept isolated at the top of the file on purpose - everything else that
// still needs to be ported over from the old productService.js (category
// hierarchy, tax vs allowed countries, bulk pricing cross-checks, plan
// limits, slug/productCode uniqueness, etc.) plugs in around createProduct
// below without needing to touch any of this.
// ---------------------------------------------------------------------------

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

        // --- bulk pricing feature gate (product-level AND any variant-level) -------
        const hasBulkPricing = (body.bulkPricing && body.bulkPricing.length > 0) ||
            (body.variants || []).some(v => v.variantAdditionalBulkPricing && v.variantAdditionalBulkPricing.length > 0);

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
        const usedManualCodesInPayload = new Set();

        for (const variant of (body.variants || [])) {
            const variantCodeResult = await resolveVariantCode({
                vendorId,
                variantCode: variant.variantCode,
                companySettingsData,
                usedManualCodesInPayload
            });
            if (!variantCodeResult.isSuccess) {
                return common.returnResult(false, variantCodeResult.statusCode, variantCodeResult.message);
            }

            variants.push({
                ...variant,
                variantCode: variantCodeResult.meta.variantCode,
                createdBy: userId,
                status: 'A',
                sizes: (variant.sizes || []).map((size) => ({
                    ...size,
                    createdBy: userId,
                    status: 'A'
                }))
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
            status: 'A'
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