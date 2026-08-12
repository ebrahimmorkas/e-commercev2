const Product = require('../models/Product');
const Category = require('../models/Category');
const SizeMaster = require('../models/SizeMaster');
const UnitMaster = require('../models/UnitMaster');
const TaxMaster = require('../models/TaxMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const logger = require('../utils/logger');
const common = require('../utils/common');

const MAX_CATEGORY_DEPTH = 25; // safety cap while walking parent_category_id chain

// Friendly names for the duplicate-key handler (point 8). Add an entry here
// whenever a new unique index is added to Product.js.
const DUPLICATE_FIELD_LABELS = {
    'vendorId_1_slug_1': 'slug',
    'vendorId_1_productCode_1': 'product code',
    'vendorId_1_variants.sku_1': 'variant SKU',
    'vendorId_1_variants.variantCode_1': 'variant code'
};

// ---------------------------------------------------------------------------
// Helpers (not exported - internal to this service)
// ---------------------------------------------------------------------------

const slugify = (text) => {
    return text
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const generateUniqueSlug = async (vendorId, name, excludeProductId = null) => {
    const base = slugify(name) || 'product';
    let candidate = base;
    let suffix = 1;

    while (true) {
        const filter = { vendorId, slug: candidate };
        if (excludeProductId) filter._id = { $ne: excludeProductId };

        const existing = await Product.findOne(filter).select('_id').lean();
        if (!existing) return candidate;

        suffix += 1;
        candidate = `${base}-${suffix}`;
    }
};

// POINT 8: translates a Mongo E11000 duplicate-key error into a clean,
// actionable message instead of surfacing the raw driver error as a
// generic 500. Called from the save() call sites, NOT the outer catch -
// this is a recognized, expected failure mode (two requests racing on the
// same SKU, a retried request, etc.), not an unexpected server error.
const buildDuplicateKeyResult = (saveErr) => {
    const indexName = saveErr.message.match(/index:\s*([^\s]+)/)?.[1];
    const fieldLabel = DUPLICATE_FIELD_LABELS[indexName] || 'value';
    const dupValue = saveErr.keyValue ? Object.values(saveErr.keyValue).join(', ') : '';
    return common.returnResult(
        false,
        409,
        `A product with this ${fieldLabel}${dupValue ? ` ("${dupValue}")` : ''} already exists for your store. Please use a different value.`
    );
};

// mainCategory must be a top-level category (no parent). subCategory, if
// present, must belong to the vendor and its parent chain must eventually
// reach mainCategory (n-level nesting, so we walk up rather than assume a
// direct parent match).
const validateCategoryHierarchy = async (vendorId, mainCategoryId, subCategoryId) => {
    const mainCategory = await Category.findOne({ _id: mainCategoryId, vendorId, status: { $ne: 'D' } }).lean();
    if (!mainCategory) {
        return common.returnResult(false, 400, 'Main category not found for this vendor.');
    }
    if (mainCategory.parent_category_id !== null && mainCategory.parent_category_id !== undefined) {
        return common.returnResult(false, 400, 'Selected main category is not a top-level category.');
    }

    if (!subCategoryId) {
        return common.returnResult(true, 200, 'All Good');
    }

    const current = await Category.findOne({ _id: subCategoryId, vendorId, status: { $ne: 'D' } }).lean();
    if (!current) {
        return common.returnResult(false, 400, 'Sub category not found for this vendor.');
    }

    let depth = 0;
    let reachedMain = current.parent_category_id && current.parent_category_id.toString() === mainCategoryId.toString();
    let cursor = current;

    while (!reachedMain && cursor.parent_category_id && depth < MAX_CATEGORY_DEPTH) {
        cursor = await Category.findOne({ _id: cursor.parent_category_id, vendorId }).lean();
        if (!cursor) break;
        if (cursor.parent_category_id && cursor.parent_category_id.toString() === mainCategoryId.toString()) {
            reachedMain = true;
            break;
        }
        depth += 1;
    }

    if (!reachedMain) {
        return common.returnResult(false, 400, 'Sub category does not belong under the selected main category.');
    }

    return common.returnResult(true, 200, 'All Good');
};

// POINT 6: validates excludeCountries/States/Cities against
// companyMasterData.allowedCountries, walking State -> Country and
// City -> State -> Country so a vendor can't exclude geography they were
// never assigned in the first place. Previously this check silently
// no-op'd whenever allowedCountries was empty ("if the array is empty,
// skip the check") - that's backwards: an empty allowed list means the
// vendor is allowed NO countries, so the check must always run, never be
// skipped.
const validateGeographyExclusions = async (companyMasterData, excludeCountries = [], excludeStates = [], excludeCities = []) => {
    const allowedCountryIdStrings = (companyMasterData.allowedCountries || []).map((c) => c.toString());

    if (excludeCountries.length) {
        const invalid = excludeCountries.filter((c) => !allowedCountryIdStrings.includes(c.toString()));
        if (invalid.length) {
            return common.returnResult(false, 403, 'One or more excluded countries are not in your allowed countries list.');
        }
    }

    if (excludeStates.length) {
        const states = await StateMaster.find({ _id: { $in: excludeStates } }).lean();
        if (states.length !== excludeStates.length) {
            return common.returnResult(false, 400, 'One or more excluded states do not exist.');
        }
        const invalidState = states.find((s) => !allowedCountryIdStrings.includes(s.country_id.toString()));
        if (invalidState) {
            return common.returnResult(false, 403, `State "${invalidState.state_name}" belongs to a country that is not in your allowed countries list.`);
        }
    }

    if (excludeCities.length) {
        const cities = await CityMaster.find({ _id: { $in: excludeCities } }).lean();
        if (cities.length !== excludeCities.length) {
            return common.returnResult(false, 400, 'One or more excluded cities do not exist.');
        }
        const stateIds = [...new Set(cities.map((c) => c.state_id.toString()))];
        const states = await StateMaster.find({ _id: { $in: stateIds } }).lean();
        const stateById = new Map(states.map((s) => [s._id.toString(), s]));

        for (const city of cities) {
            const parentState = stateById.get(city.state_id.toString());
            if (!parentState || !allowedCountryIdStrings.includes(parentState.country_id.toString())) {
                return common.returnResult(false, 403, `City "${city.city_name}" belongs to a country that is not in your allowed countries list.`);
            }
        }
    }

    return common.returnResult(true, 200, 'All Good');
};

// POINT 6 (tax leg): the country a tax belongs to must be one the vendor is
// allowed to sell into.
const validateTaxIdsAgainstAllowedCountries = async (companyMasterData, taxIds = []) => {
    if (!taxIds.length) return common.returnResult(true, 200, 'All Good');

    const allowedCountryIdStrings = (companyMasterData.allowedCountries || []).map((c) => c.toString());
    const taxes = await TaxMaster.find({ _id: { $in: taxIds } }).lean();

    const invalidTax = taxes.find((t) => !allowedCountryIdStrings.includes(t.countryId.toString()));
    if (invalidTax) {
        return common.returnResult(false, 403, `Tax "${invalidTax.name}" belongs to a country that is not in your allowed countries list.`);
    }

    return common.returnResult(true, 200, 'All Good');
};

// Resolves & validates every variant's color/sizeId/unitId against the
// product's own colors[] and against the vendor's plan
// (companyMasterData.allowedSizes), then computes the auto-generated
// variant name. Mutates nothing - returns either an error result or the
// list of variants annotated with resolved names.
//
// FIX (point 6): the allowedSizes check used to be skipped entirely
// whenever companyMasterData.allowedSizes was empty ("if the array has
// items, check membership") - same backwards logic as the geography
// check above. An empty allowedSizes means nothing is allowed, so the
// check must always run.
const resolveAndValidateVariants = async (variants, colors, companyMasterData) => {
    const normalizedColors = colors.map((c) => c.trim().toLowerCase());
    const allowedSizeIdStrings = (companyMasterData.allowedSizes || []).map((s) => s.toString());

    const defaultVariants = variants.filter((v) => v.isDefault === true);
    if (defaultVariants.length > 1) {
        return common.returnResult(false, 400, 'Only one variant can be marked as the default variant.');
    }

    const seenCombinations = new Set();
    const seenSkus = new Set();
    const seenVariantCodes = new Set();
    const resolvedVariants = [];

    for (const variant of variants) {
        if (!normalizedColors.includes(variant.color.trim().toLowerCase())) {
            return common.returnResult(false, 400, `Variant color "${variant.color}" was not found in the product's colors list.`);
        }
        if (!allowedSizeIdStrings.includes(variant.sizeId.toString())) {
            return common.returnResult(false, 403, 'Selected size is not allowed on your current plan.');
        }

        const sizeDoc = await SizeMaster.findOne({ _id: variant.sizeId, status: 'A' }).lean();
        if (!sizeDoc) {
            return common.returnResult(false, 400, 'Selected size does not exist or is inactive.');
        }
        const allowedUnitIdStrings = (sizeDoc.allowedUnits || []).map((u) => u.toString());
        if (!allowedUnitIdStrings.includes(variant.unitId.toString())) {
            return common.returnResult(false, 400, `Selected unit is not valid for the size "${sizeDoc.name}".`);
        }

        const unitDoc = await UnitMaster.findOne({ _id: variant.unitId, status: 'A' }).lean();
        if (!unitDoc) {
            return common.returnResult(false, 400, 'Selected unit does not exist or is inactive.');
        }

        const geoCheck = await validateGeographyExclusions(
            companyMasterData, variant.excludeCountries, variant.excludeStates, variant.excludeCities
        );
        if (!geoCheck.isSuccess) return geoCheck;

        const comboKey = `${variant.color.trim().toLowerCase()}|${variant.sizeId}|${variant.unitId}`;
        if (seenCombinations.has(comboKey)) {
            return common.returnResult(false, 400, 'Duplicate color, size and unit combination found across variants.');
        }
        seenCombinations.add(comboKey);

        const skuKey = variant.sku.trim().toLowerCase();
        if (seenSkus.has(skuKey)) {
            return common.returnResult(false, 400, `Duplicate SKU "${variant.sku}" within the submitted variants.`);
        }
        seenSkus.add(skuKey);

        const codeKey = variant.variantCode.trim().toLowerCase();
        if (seenVariantCodes.has(codeKey)) {
            return common.returnResult(false, 400, `Duplicate variant code "${variant.variantCode}" within the submitted variants.`);
        }
        seenVariantCodes.add(codeKey);

        resolvedVariants.push({
            ...variant,
            name: `${variant.color.trim()} ${sizeDoc.name} ${unitDoc.name}`
        });
    }

    return common.returnResult(true, 200, 'All Good', { resolvedVariants });
};

// POINT 7: pricePerUnit of any bulk pricing tier that actually applies to a
// variant must be less than that variant's own price. "Applies to" means:
//   - product-level `bulkPricing` tiers, for every variant with
//     isBulkPricingSame = true (that variant reuses the product's tiers)
//   - a variant's own `additionalBulkPricing` tiers, always (regardless of
//     the isBulkPricingSame flag), since a variant-specific tier priced
//     above the variant's own price is never valid either way
const validateBulkPricingAgainstVariantPrices = (productBulkPricing, variants) => {
    for (const variant of variants) {
        if (variant.isBulkPricingSame) {
            const offender = (productBulkPricing || []).find((tier) => tier.pricePerUnit >= variant.price);
            if (offender) {
                return common.returnResult(
                    false, 400,
                    `Bulk pricing tier (min qty ${offender.minQty}) has a price per unit that is not less than the price of variant "${variant.color} / ${variant.sku}".`
                );
            }
        }
        const offenderAdditional = (variant.additionalBulkPricing || []).find((tier) => tier.pricePerUnit >= variant.price);
        if (offenderAdditional) {
            return common.returnResult(
                false, 400,
                `Additional bulk pricing tier (min qty ${offenderAdditional.minQty}) has a price per unit that is not less than the price of variant "${variant.color} / ${variant.sku}".`
            );
        }
    }
    return common.returnResult(true, 200, 'All Good');
};

// Merges description Map: only keys ABSENT from the base map are pulled in
// from the overlay (variant additionalDescription never overrides an
// existing product-level key) - per explicit instruction.
const mergeDescriptionOverlay = (baseMap, overlayMap) => {
    const base = baseMap instanceof Map ? Object.fromEntries(baseMap) : (baseMap || {});
    const overlay = overlayMap instanceof Map ? Object.fromEntries(overlayMap) : (overlayMap || {});
    const merged = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
        if (!(key in merged)) merged[key] = value;
    }
    return merged;
};

// POINT 1: the default variant must always come first in the response,
// regardless of `precedence`. Everything else keeps precedence order
// (ascending), preserving original array order as a tiebreaker.
const sortVariantsDefaultFirst = (variants) => {
    return [...(variants || [])].sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return (a.precedence || 0) - (b.precedence || 0);
    });
};

// Computes the "effective" reuse fields for each variant for read
// responses, without mutating the stored document. isSame=true -> read
// from product base (+ overlay additional data where applicable).
// isSame=false -> variant's own additional* field is the full, standalone
// value and the product base is ignored entirely. Also applies the
// default-first sort (point 1).
const attachEffectiveVariantData = (productDoc) => {
    const product = productDoc.toObject ? productDoc.toObject() : productDoc;

    const withEffectiveData = (product.variants || []).map((variant) => {
        const effectiveDescription = variant.isDescriptionSame
            ? mergeDescriptionOverlay(product.description, variant.additionalDescription)
            : Object.fromEntries(variant.additionalDescription instanceof Map ? variant.additionalDescription : Object.entries(variant.additionalDescription || {}));

        const effectiveDisclaimer = variant.isDisclaimerSame
            ? [product.disclaimer, variant.additionalDisclaimer].filter(Boolean).join(' ')
            : (variant.additionalDisclaimer || '');

        const effectiveBulkPricing = variant.isBulkPricingSame
            ? [...(product.bulkPricing || []), ...(variant.additionalBulkPricing || [])]
            : (variant.additionalBulkPricing || []);

        return {
            ...variant,
            effectiveDescription,
            effectiveDisclaimer,
            effectiveBulkPricing
        };
    });

    product.variants = sortVariantsDefaultFirst(withEffectiveData);

    return product;
};

// POINT 10: hides variants (and taxes) that don't apply to the requesting
// customer's location. Only runs when the caller actually has a resolved
// location (logged-in customer) - guests / unknown location see everything
// unfiltered, since we have no basis to exclude anything for them.
const applyCustomerLocationVisibility = async (product, user) => {
    if (!user || (!user.country && !user.state && !user.city)) {
        return product;
    }

    const visibleVariants = (product.variants || []).filter((variant) => {
        const countryExcluded = user.country && (variant.excludeCountries || []).some((c) => c.toString() === user.country.toString());
        const stateExcluded = user.state && (variant.excludeStates || []).some((s) => s.toString() === user.state.toString());
        const cityExcluded = user.city && (variant.excludeCities || []).some((c) => c.toString() === user.city.toString());
        return !countryExcluded && !stateExcluded && !cityExcluded;
    });

    let applicableTaxes = [];
    if (user.country && product.taxIds && product.taxIds.length) {
        const taxes = await TaxMaster.find({ _id: { $in: product.taxIds }, status: 'A' }).lean();
        applicableTaxes = taxes.filter((t) => t.countryId.toString() === user.country.toString());
    }

    return { ...product, variants: visibleVariants, applicableTaxes };
};

// ---------------------------------------------------------------------------
// Exported service functions
// ---------------------------------------------------------------------------

const fetchAllProductsForAdmin = async (vendorId, query) => {
    try {
        const { page, limit, search, mainCategory, subCategory } = query;

        const filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { productCode: { $regex: search, $options: 'i' } },
                { slug: { $regex: search, $options: 'i' } }
            ];
        }
        if (mainCategory) filter.mainCategory = mainCategory;
        if (subCategory) filter.subCategory = subCategory;

        // common.getAll applies vendorId + defaults status to { $ne: 'D' },
        // i.e. both 'I' and 'A' come back, which matches the admin listing
        // requirement.
        const allMatching = await common.getAll(Product, filter, vendorId);
        if (allMatching.success === false) {
            return common.returnResult(false, 400, allMatching.message);
        }

        const total = allMatching.length;
        const start = (page - 1) * limit;
        const paginated = allMatching.slice(start, start + limit).map((p) => {
            const obj = p.toObject ? p.toObject() : p;
            obj.variants = sortVariantsDefaultFirst(obj.variants);
            return obj;
        });

        return common.returnResult(true, 200, 'Products fetched successfully', {
            products: paginated,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        throw err;
    }
};

const fetchAllProductsForClient = async (vendorId, query, user) => {
    try {
        const { page, limit, search, mainCategory, subCategory } = query;

        const filter = { status: 'A' };
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { searchKeywords: { $regex: search, $options: 'i' } }
            ];
        }
        if (mainCategory) filter.mainCategory = mainCategory;
        if (subCategory) filter.subCategory = subCategory;

        const allMatching = await common.getAll(Product, filter, vendorId);
        if (allMatching.success === false) {
            return common.returnResult(false, 400, allMatching.message);
        }

        const total = allMatching.length;
        const start = (page - 1) * limit;
        const pageSlice = allMatching.slice(start, start + limit).map(attachEffectiveVariantData);

        // POINT 10: apply location visibility, then drop any product left
        // with zero purchasable variants for this customer.
        const withVisibility = await Promise.all(pageSlice.map((p) => applyCustomerLocationVisibility(p, user)));
        const visibleProducts = withVisibility.filter((p) => p.variants.length > 0);

        return common.returnResult(true, 200, 'Products fetched successfully', {
            products: visibleProducts,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        throw err;
    }
};

const fetchProductById = async (vendorId, encodedProductId, isAdmin, user) => {
    try {
        const decodedId = common.decodeId(encodedProductId);
        const idCheck = common.validateObjectId(decodedId);
        if (!idCheck.valid) {
            return common.returnResult(false, 400, idCheck.message);
        }

        const filter = { _id: decodedId, vendorId };
        filter.status = isAdmin ? { $ne: 'D' } : 'A';

        const product = await Product.findOne(filter);
        if (!product) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        let result = attachEffectiveVariantData(product);

        if (!isAdmin) {
            result = await applyCustomerLocationVisibility(result, user);
            if (result.variants.length === 0) {
                return common.returnResult(false, 404, 'Product not found.');
            }
        }

        return common.returnResult(true, 200, 'Product fetched successfully', result);
    } catch (err) {
        throw err;
    }
};

const createProduct = async (vendorId, userId, companyMasterData, websiteMasterData, body) => {
    try {
        // --- Feature gating ---------------------------------------------
        if (body.mainCategory || body.subCategory) {
            const categoryFeature = await common.checkFeatureOnOrOff(
                vendorId, websiteMasterData, companyMasterData, 'isCategoryFeatureOn', 'isCategoryFeatureOn'
            );
            if (!categoryFeature.isSuccess) {
                return common.returnResult(false, categoryFeature.statusCode, categoryFeature.message);
            }
            if (body.subCategory && !companyMasterData.isCategoryNestingAllowed) {
                return common.returnResult(false, 403, 'Sub-category selection is not allowed on your current plan.');
            }
        }

        const wantsBulkPricing = (body.bulkPricing && body.bulkPricing.length)
            || body.variants.some((v) => v.additionalBulkPricing && v.additionalBulkPricing.length);
        if (wantsBulkPricing) {
            const bulkPricingFeature = await common.checkFeatureOnOrOff(
                vendorId, websiteMasterData, companyMasterData, 'isBulkPricingFeatureOn', 'isBulkPricingFeatureOn'
            );
            if (!bulkPricingFeature.isSuccess) {
                return common.returnResult(false, bulkPricingFeature.statusCode, `Bulk Pricing is not enabled`);
            }
        }

        // --- Plan limits -----------------------------------------------
        if (companyMasterData.numberOfProductsAllowed !== undefined && companyMasterData.numberOfProductsAllowed !== null) {
            const existingCount = await Product.countDocuments({ vendorId, status: { $ne: 'D' } });
            if (existingCount >= companyMasterData.numberOfProductsAllowed) {
                return common.returnResult(false, 403, 'Product limit reached for your current plan.');
            }
        }
        if (companyMasterData.numberOfProductsVaiantsAllowed !== undefined && companyMasterData.numberOfProductsVaiantsAllowed !== null) {
            if (body.variants.length > companyMasterData.numberOfProductsVaiantsAllowed) {
                return common.returnResult(false, 403, 'Variant limit per product exceeded for your current plan.');
            }
        }

        // --- Category hierarchy -----------------------------------------
        if (body.mainCategory) {
            const categoryCheck = await validateCategoryHierarchy(vendorId, body.mainCategory, body.subCategory);
            if (!categoryCheck.isSuccess) {
                return common.returnResult(false, categoryCheck.statusCode, categoryCheck.message);
            }
        } else if (body.subCategory) {
            return common.returnResult(false, 400, 'subCategory cannot be set without a mainCategory.');
        }

        // --- Tax vs allowed countries (point 6) -------------------------
        if (body.taxIds && body.taxIds.length) {
            const existsCheck = await common.checkWhetherDocumentExists(TaxMaster, body.taxIds);
            if (!existsCheck.success) return common.returnResult(false, 400, existsCheck.message);

            const taxGeoCheck = await validateTaxIdsAgainstAllowedCountries(companyMasterData, body.taxIds);
            if (!taxGeoCheck.isSuccess) return common.returnResult(false, taxGeoCheck.statusCode, taxGeoCheck.message);
        }

        // --- recommendedProducts existence ------------------------------
        if (body.recommendedProducts && body.recommendedProducts.length) {
            const check = await common.checkWhetherDocumentExists(Product, body.recommendedProducts, vendorId);
            if (!check.success) return common.returnResult(false, 400, check.message);
        }

        // --- productCode / slug uniqueness (friendly pre-check) ---------
        const existingCode = await Product.findOne({ vendorId, productCode: body.productCode }).select('_id').lean();
        if (existingCode) {
            return common.returnResult(false, 409, 'Product code already exists for this vendor.');
        }
        const slug = body.slug
            ? (await Product.findOne({ vendorId, slug: body.slug }).select('_id').lean())
                ? await generateUniqueSlug(vendorId, body.slug)
                : body.slug
            : await generateUniqueSlug(vendorId, body.name);

        // --- Variants: color/size/unit resolution + geography (point 6) -
        const variantsResult = await resolveAndValidateVariants(body.variants, body.colors, companyMasterData);
        if (!variantsResult.isSuccess) {
            return common.returnResult(false, variantsResult.statusCode, variantsResult.message);
        }
        const resolvedVariants = variantsResult.meta.resolvedVariants;

        // --- Bulk pricing vs variant price (point 7) ---------------------
        const bulkPricingCheck = validateBulkPricingAgainstVariantPrices(body.bulkPricing, resolvedVariants);
        if (!bulkPricingCheck.isSuccess) {
            return common.returnResult(false, bulkPricingCheck.statusCode, bulkPricingCheck.message);
        }

        const finalVariants = resolvedVariants.map((v) => ({
            ...v,
            createdBy: userId,
            status: 'A'
        }));

        const product = new Product({
            ...body,
            slug,
            remarks: 'manual', // forced - excel import is a separate pass
            variants: finalVariants,
            vendorId,
            createdBy: userId,
            status: 'A'
        });

        // POINT 8: E11000 is an expected/recoverable failure (a race with
        // another request, or a value that slipped past the friendly
        // pre-checks above) - handled here with its own try/catch instead
        // of falling through to the generic 500 in the controller.
        try {
            await product.save();
        } catch (saveErr) {
            if (saveErr.code === 11000) {
                return buildDuplicateKeyResult(saveErr);
            }
            throw saveErr;
        }

        return common.returnResult(true, 201, 'Product created successfully', product);
    } catch (err) {
        throw err;
    }
};

const updateProduct = async (vendorId, userId, encodedProductId, companyMasterData, websiteMasterData, body) => {
    try {
        const decodedId = common.decodeId(encodedProductId);
        const idCheck = common.validateObjectId(decodedId);
        if (!idCheck.valid) {
            return common.returnResult(false, 400, idCheck.message);
        }

        const product = await Product.findOne({ _id: decodedId, vendorId, status: { $ne: 'D' } });
        if (!product) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        const effectiveColors = body.colors || product.colors;

        if (body.mainCategory !== undefined || body.subCategory !== undefined) {
            const categoryFeature = await common.checkFeatureOnOrOff(
                vendorId, websiteMasterData, companyMasterData, 'isCategoryFeatureOn', 'isCategoryFeatureOn'
            );
            if (!categoryFeature.isSuccess) {
                return common.returnResult(false, categoryFeature.statusCode, categoryFeature.message);
            }
            const mainCategory = body.mainCategory !== undefined ? body.mainCategory : product.mainCategory;
            const subCategory = body.subCategory !== undefined ? body.subCategory : product.subCategory;

            if (subCategory && !companyMasterData.isCategoryNestingAllowed) {
                return common.returnResult(false, 403, 'Sub-category selection is not allowed on your current plan.');
            }
            if (mainCategory) {
                const categoryCheck = await validateCategoryHierarchy(vendorId, mainCategory, subCategory);
                if (!categoryCheck.isSuccess) {
                    return common.returnResult(false, categoryCheck.statusCode, categoryCheck.message);
                }
            } else if (subCategory) {
                return common.returnResult(false, 400, 'subCategory cannot be set without a mainCategory.');
            }
        }

        if (body.taxIds && body.taxIds.length) {
            const existsCheck = await common.checkWhetherDocumentExists(TaxMaster, body.taxIds);
            if (!existsCheck.success) return common.returnResult(false, 400, existsCheck.message);

            const taxGeoCheck = await validateTaxIdsAgainstAllowedCountries(companyMasterData, body.taxIds);
            if (!taxGeoCheck.isSuccess) return common.returnResult(false, taxGeoCheck.statusCode, taxGeoCheck.message);
        }

        if (body.recommendedProducts && body.recommendedProducts.length) {
            if (body.recommendedProducts.some((id) => id.toString() === decodedId.toString())) {
                return common.returnResult(false, 400, 'A product cannot recommend itself.');
            }
            const check = await common.checkWhetherDocumentExists(Product, body.recommendedProducts, vendorId);
            if (!check.success) return common.returnResult(false, 400, check.message);
        }

        if (body.productCode && body.productCode !== product.productCode) {
            const existingCode = await Product.findOne({ vendorId, productCode: body.productCode, _id: { $ne: decodedId } }).select('_id').lean();
            if (existingCode) {
                return common.returnResult(false, 409, 'Product code already exists for this vendor.');
            }
        }

        let slug = product.slug;
        if (body.slug && body.slug !== product.slug) {
            const clash = await Product.findOne({ vendorId, slug: body.slug, _id: { $ne: decodedId } }).select('_id').lean();
            slug = clash ? await generateUniqueSlug(vendorId, body.slug, decodedId) : body.slug;
        }

        let finalVariants = product.variants;
        if (body.variants) {
            if ((companyMasterData.numberOfProductsVaiantsAllowed !== undefined && companyMasterData.numberOfProductsVaiantsAllowed !== null)
                && body.variants.length > companyMasterData.numberOfProductsVaiantsAllowed) {
                return common.returnResult(false, 403, 'Variant limit per product exceeded for your current plan.');
            }

            const hasNewBulkPricing = body.variants.some((v) => v.additionalBulkPricing && v.additionalBulkPricing.length)
                || (body.bulkPricing && body.bulkPricing.length);
            if (hasNewBulkPricing) {
                const bulkPricingFeature = await common.checkFeatureOnOrOff(
                    vendorId, websiteMasterData, companyMasterData, 'isBulkPricingFeatureOn', 'isBulkPricingFeatureOn'
                );
                if (!bulkPricingFeature.isSuccess) {
                    return common.returnResult(false, bulkPricingFeature.statusCode, `Bulk Pricing is not enabled`);
                }
            }

            const variantsResult = await resolveAndValidateVariants(body.variants, effectiveColors, companyMasterData);
            if (!variantsResult.isSuccess) {
                return common.returnResult(false, variantsResult.statusCode, variantsResult.message);
            }
            const resolvedVariants = variantsResult.meta.resolvedVariants;

            const effectiveBulkPricing = body.bulkPricing !== undefined ? body.bulkPricing : product.bulkPricing;
            const bulkPricingCheck = validateBulkPricingAgainstVariantPrices(effectiveBulkPricing, resolvedVariants);
            if (!bulkPricingCheck.isSuccess) {
                return common.returnResult(false, bulkPricingCheck.statusCode, bulkPricingCheck.message);
            }

            // --- POINT 2: default-variant deletion/deactivation guard ---
            const existingDefault = product.variants.find((v) => v.isDefault === true);
            if (existingDefault) {
                const submittedMatch = resolvedVariants.find((v) => v._id && v._id.toString() === existingDefault._id.toString());
                const beingRemoved = !submittedMatch;
                const beingDeactivatedWhileStillDefault = submittedMatch && submittedMatch.isDefault && submittedMatch.status === 'I';

                if (beingRemoved || beingDeactivatedWhileStillDefault) {
                    const anotherDefault = resolvedVariants.find((v) => v.isDefault === true
                        && (!v._id || v._id.toString() !== existingDefault._id.toString()));
                    if (!anotherDefault) {
                        return common.returnResult(
                            false, 400,
                            'The default variant cannot be deleted or made inactive without first marking another variant as default.'
                        );
                    }
                }
            }

            const existingById = new Map(product.variants.map((v) => [v._id.toString(), v]));

            finalVariants = resolvedVariants.map((v) => {
                if (v._id && existingById.has(v._id.toString())) {
                    const existing = existingById.get(v._id.toString());
                    const stockIncreased = v.stock > existing.stock;
                    return {
                        ...existing.toObject(),
                        ...v,
                        updatedBy: userId,
                        lastRestockedDate: stockIncreased ? new Date() : existing.lastRestockedDate
                    };
                }
                // New variant added during update.
                return { ...v, createdBy: userId, status: 'A' };
            });
            // Any variant present in `product.variants` but absent from the
            // submitted `body.variants` (by _id) is dropped - full-replace
            // semantics for the variants array on update.
        }

        const { variants: _ignoredVariants, remarks: _ignoredRemarks, ...restBody } = body;
        Object.assign(product, {
            ...restBody,
            slug,
            variants: finalVariants,
            updatedBy: userId
        });

        try {
            await product.save();
        } catch (saveErr) {
            if (saveErr.code === 11000) {
                return buildDuplicateKeyResult(saveErr);
            }
            throw saveErr;
        }

        return common.returnResult(true, 200, 'Product updated successfully', product);
    } catch (err) {
        throw err;
    }
};

const deleteProduct = async (vendorId, userId, encodedProductId) => {
    try {
        const decodedId = common.decodeId(encodedProductId);
        const idCheck = common.validateObjectId(decodedId);
        if (!idCheck.valid) {
            return common.returnResult(false, 400, idCheck.message);
        }

        const product = await Product.findOne({ _id: decodedId, vendorId, status: { $ne: 'D' } });
        if (!product) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        // POINT 2: a whole-product delete also removes its default variant
        // (there's nothing left to reassign default to), which is fine -
        // this guard only matters for partial updates that drop/deactivate
        // the default variant while OTHER variants remain live.

        const result = await common.softDelete(Product, decodedId, userId);
        if (!result.success) {
            return common.returnResult(false, 400, result.message);
        }

        return common.returnResult(true, 200, 'Product deleted successfully', result.document);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchAllProductsForAdmin,
    fetchAllProductsForClient,
    fetchProductById,
    createProduct,
    updateProduct,
    deleteProduct
};