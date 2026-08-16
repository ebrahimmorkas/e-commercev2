const Product = require('../models/Product');
const Category = require('../models/Category');
const SizeMaster = require('../models/SizeMaster');
const UnitMaster = require('../models/UnitMaster');
const TaxMaster = require('../models/TaxMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Friendly names for the duplicate-key handler (point 8). Add an entry here
// whenever a new unique index is added to Product.js.
const DUPLICATE_FIELD_LABELS = {
    'vendorId_1_slug_1': 'slug',
    'vendorId_1_productCode_1': 'product code',
    'vendorId_1_variants.sizes.sku_1': 'variant SKU',
    'vendorId_1_variants.sizes.variantCode_1': 'variant code'
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
//
// FIX: the walk used to be capped by a hardcoded MAX_CATEGORY_DEPTH = 25.
// That's wrong - companyMaster already carries the vendor's actual
// configured nesting limit (numberOfSubcategoriesAllowed), so the cap now
// comes from there instead of an arbitrary number invented here. Falls
// back to 50 only if the vendor's plan genuinely has no value set for it.
const validateCategoryHierarchy = async (vendorId, mainCategoryId, subCategoryId, companyMasterData) => {
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

    const maxDepth = (companyMasterData.numberOfSubcategoriesAllowed !== undefined && companyMasterData.numberOfSubcategoriesAllowed !== null)
        ? companyMasterData.numberOfSubcategoriesAllowed
        : 50;

    let depth = 0;
    let reachedMain = current.parent_category_id && current.parent_category_id.toString() === mainCategoryId.toString();
    let cursor = current;

    while (!reachedMain && cursor.parent_category_id && depth < maxDepth) {
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

// Resolves & validates every variant's color + each of its sizes'
// sizeId/unitId against the product's own colors[] and against the
// vendor's plan (companyMasterData.allowedSizes), then computes the
// auto-generated name for each size. Mutates nothing - returns either an
// error result or the list of variants with resolved sizes attached.
//
// CHANGED: a variant (color) can now carry MULTIPLE sizes, each an
// independent inventory line (own price/stock/sku/etc.) - so size/unit
// resolution, the "default" check, and duplicate SKU/variantCode/combo
// checks now operate on `variant.sizes[]` instead of the variant itself.
// color + geography exclusions stay at the variant (color) level, since
// those didn't change.
const resolveAndValidateVariants = async (variants, colors, companyMasterData) => {
    const normalizedColors = colors.map((c) => c.trim().toLowerCase());
    const allowedSizeIdStrings = (companyMasterData.allowedSizes || []).map((s) => s.toString());

    let defaultCount = 0;
    for (const variant of variants) {
        for (const size of variant.sizes) {
            if (size.isDefault === true) defaultCount += 1;
        }
    }
    if (defaultCount > 1) {
        return common.returnResult(false, 400, 'Only one size (across the whole product) can be marked as the default.');
    }

    const seenCombinations = new Set();
    const seenSkus = new Set();
    const seenVariantCodes = new Set();
    const resolvedVariants = [];

    for (const variant of variants) {
        if (!normalizedColors.includes(variant.color.trim().toLowerCase())) {
            return common.returnResult(false, 400, `Variant color "${variant.color}" was not found in the product's colors list.`);
        }

        const geoCheck = await validateGeographyExclusions(
            companyMasterData, variant.excludeCountries, variant.excludeStates, variant.excludeCities
        );
        if (!geoCheck.isSuccess) return geoCheck;

        const resolvedSizes = [];
        for (const size of variant.sizes) {
            if (!allowedSizeIdStrings.includes(size.sizeId.toString())) {
                return common.returnResult(false, 403, `Selected size is not allowed on your current plan (color "${variant.color}").`);
            }

            const sizeDoc = await SizeMaster.findOne({ _id: size.sizeId, status: 'A' }).lean();
            if (!sizeDoc) {
                return common.returnResult(false, 400, `Selected size does not exist or is inactive (color "${variant.color}").`);
            }

            let unitDoc = null;
            if (sizeDoc.type === 'MEASURABLE') {
                if (!size.unitId) {
                    return common.returnResult(false, 400, `Unit is required for size "${sizeDoc.name}" (color "${variant.color}").`);
                }
                const allowedUnitIdStrings = (sizeDoc.allowedUnits || []).map((u) => u.toString());
                if (!allowedUnitIdStrings.includes(size.unitId.toString())) {
                    return common.returnResult(false, 400, `Selected unit is not valid for the size "${sizeDoc.name}" (color "${variant.color}").`);
                }
                unitDoc = await UnitMaster.findOne({ _id: size.unitId, status: 'A' }).lean();
                if (!unitDoc) {
                    return common.returnResult(false, 400, `Selected unit does not exist or is inactive (color "${variant.color}").`);
                }
            } else if (size.unitId) {
                return common.returnResult(false, 400, `Unit should not be provided for size "${sizeDoc.name}" (color "${variant.color}") since it is a label-type size.`);
            }

            // CHANGED: `value` may be a single string or an array. Normalize
            // to an array so single- and multi-value submissions run
            // through the exact same expansion loop below.
            const requestedValues = Array.isArray(size.value) ? size.value : [size.value];
            if (requestedValues.length === 0) {
                return common.returnResult(false, 400, `At least one value is required for size "${sizeDoc.name}" (color "${variant.color}").`);
            }

            const allowedLabelValues = sizeDoc.type === 'LABEL'
                ? (sizeDoc.values || []).map((v) => v.trim().toLowerCase())
                : null;

            for (let index = 0; index < requestedValues.length; index++) {
                const val = requestedValues[index];
                const trimmedVal = val.trim();

                if (sizeDoc.type === 'LABEL' && !allowedLabelValues.includes(trimmedVal.toLowerCase())) {
                    return common.returnResult(false, 400, `"${val}" is not a valid value for size "${sizeDoc.name}" (color "${variant.color}").`);
                }

                const computedName = sizeDoc.type === 'MEASURABLE'
                    ? `${variant.color.trim()} ${sizeDoc.name} ${trimmedVal} ${unitDoc.name}`
                    : `${variant.color.trim()} ${sizeDoc.name} ${trimmedVal}`;

                // CHANGED: when one size entry expands into several values,
                // sku/variantCode from the submitted payload are reused
                // as-is only when there's exactly one value. With multiple
                // values they'd collide (same sku for "Large" and "Small"),
                // so each extra value gets the value appended to keep them
                // unique - e.g. sku "TSHIRT-RED" + value "Small" ->
                // "TSHIRT-RED-SMALL". barcode is left untouched either way
                // - it's a physical-unit identifier, not something safe to
                // auto-generate; if multiple values are submitted with a
                // barcode set, the SAME barcode will be reused across all
                // of them, so provide barcode per-entry separately
                // afterwards (via update) if each physical size truly has
                // its own barcode.
                const suffix = trimmedVal.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                const resolvedSku = requestedValues.length > 1 ? `${size.sku}-${suffix}` : size.sku;
                const resolvedVariantCode = requestedValues.length > 1 ? `${size.variantCode}-${suffix}` : size.variantCode;

                // Only the FIRST generated entry can keep isDefault=true -
                // otherwise a single `isDefault: true` on a multi-value
                // entry would create several defaults at once and trip the
                // "only one default" check below.
                const resolvedIsDefault = size.isDefault === true && index === 0;

                const comboKey = `${variant.color.trim().toLowerCase()}|${size.sizeId}|${size.unitId || ''}|${trimmedVal.toLowerCase()}`;
                if (seenCombinations.has(comboKey)) {
                    return common.returnResult(false, 400, 'Duplicate color, size, unit and value combination found across variants.');
                }
                seenCombinations.add(comboKey);

                const skuKey = resolvedSku.trim().toLowerCase();
                if (seenSkus.has(skuKey)) {
                    return common.returnResult(false, 400, `Duplicate SKU "${resolvedSku}" within the submitted variants.`);
                }
                seenSkus.add(skuKey);

                const codeKey = resolvedVariantCode.trim().toLowerCase();
                if (seenVariantCodes.has(codeKey)) {
                    return common.returnResult(false, 400, `Duplicate variant code "${resolvedVariantCode}" within the submitted variants.`);
                }
                seenVariantCodes.add(codeKey);

                resolvedSizes.push({
                    ...size,
                    value: trimmedVal,
                    sku: resolvedSku,
                    variantCode: resolvedVariantCode,
                    isDefault: resolvedIsDefault,
                    name: computedName
                });
            }
        }

        resolvedVariants.push({
            ...variant,
            sizes: resolvedSizes
        });
    }

    return common.returnResult(true, 200, 'All Good', { resolvedVariants });
};

// POINT 7: pricePerUnit of any bulk pricing tier that actually applies to a
// size must be less than that size's own price. "Applies to" means:
//   - product-level `bulkPricing` tiers, for every size inside a variant
//     with isBulkPricingSame = true (that color reuses the product's tiers
//     for all of its sizes)
//   - a variant's own `additionalBulkPricing` tiers, always (regardless of
//     the isBulkPricingSame flag), checked against every size in that
//     variant, since a variant-specific tier priced above any of its
//     sizes' prices is never valid either way
const validateBulkPricingAgainstVariantPrices = (productBulkPricing, variants) => {
    for (const variant of variants) {
        for (const size of variant.sizes) {
            if (variant.isBulkPricingSame) {
                const offender = (productBulkPricing || []).find((tier) => tier.pricePerUnit >= size.price);
                if (offender) {
                    return common.returnResult(
                        false, 400,
                        `Bulk pricing tier (min qty ${offender.minQty}) has a price per unit that is not less than the price of "${variant.color} / ${size.sku}".`
                    );
                }
            }
            const offenderAdditional = (variant.additionalBulkPricing || []).find((tier) => tier.pricePerUnit >= size.price);
            if (offenderAdditional) {
                return common.returnResult(
                    false, 400,
                    `Additional bulk pricing tier (min qty ${offenderAdditional.minQty}) has a price per unit that is not less than the price of "${variant.color} / ${size.sku}".`
                );
            }
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

// POINT 1: the default SIZE must always come first in the response,
// regardless of `precedence`. CHANGED: isDefault now lives on each size
// entry (not the variant), since a color can carry multiple sizes. This is
// now a two-level sort:
//   1. within each variant, its own sizes are sorted default-first
//   2. the variants themselves are sorted so whichever one CONTAINS the
//      default size comes first; everything else keeps precedence order
const sortSizesDefaultFirst = (sizes) => {
    return [...(sizes || [])].sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return 0;
    });
};

const sortVariantsDefaultFirst = (variants) => {
    const withSortedSizes = (variants || []).map((variant) => ({
        ...variant,
        sizes: sortSizesDefaultFirst(variant.sizes)
    }));

    return withSortedSizes.sort((a, b) => {
        const aHasDefault = (a.sizes || []).some((s) => s.isDefault);
        const bHasDefault = (b.sizes || []).some((s) => s.isDefault);
        if (aHasDefault && !bHasDefault) return -1;
        if (!aHasDefault && bHasDefault) return 1;
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

    // ADDED: GET/PUT/DELETE /products/:productId expect the ENCRYPTED id
    // (common.decodeId reverses it server-side), not the raw Mongo _id.
    // Attaching it here means whatever hits this response can just copy
    // `id` straight into the next request's URL instead of having to
    // encode `_id` themselves.
    product.id = common.encodeId(product._id);

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
        const { search, mainCategory, subCategory } = query;

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

        const products = allMatching.map((p) => {
            const obj = p.toObject ? p.toObject() : p;
            obj.variants = sortVariantsDefaultFirst(obj.variants);
            obj.id = common.encodeId(obj._id);
            return obj;
        });

        return common.returnResult(true, 200, 'Products fetched successfully', { products });
    } catch (err) {
        throw err;
    }
};

const fetchAllProductsForClient = async (vendorId, query, user) => {
    try {
        const { search, mainCategory, subCategory } = query;

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

        const withEffectiveData = allMatching.map(attachEffectiveVariantData);

        // POINT 10: apply location visibility, then drop any product left
        // with zero purchasable variants for this customer.
        const withVisibility = await Promise.all(withEffectiveData.map((p) => applyCustomerLocationVisibility(p, user)));
        const visibleProducts = withVisibility.filter((p) => p.variants.length > 0);

        return common.returnResult(true, 200, 'Products fetched successfully', { products: visibleProducts });
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
                return common.returnResult(false, bulkPricingFeature.statusCode, bulkPricingFeature.message);
            }
        }

        // --- Plan limits -----------------------------------------------
        if (companyMasterData.numberOfProductsAllowed !== undefined && companyMasterData.numberOfProductsAllowed !== null) {
            const existingCount = await Product.countDocuments({ vendorId, status: { $ne: 'D' } });
            if (existingCount >= companyMasterData.numberOfProductsAllowed) {
                return common.returnResult(false, 403, 'Product limit reached for your current plan.');
            }
        }
        // CHANGED: numberOfProductsVaiantsAllowed now counts total SIZE
        // entries across all colors, not the number of colors - each size
        // is its own independent inventory line (the real "variant" now),
        // since a color can hold multiple sizes.
        if (companyMasterData.numberOfProductsVaiantsAllowed !== undefined && companyMasterData.numberOfProductsVaiantsAllowed !== null) {
            const totalSizeEntries = body.variants.reduce((sum, v) => sum + (v.sizes ? v.sizes.length : 0), 0);
            if (totalSizeEntries > companyMasterData.numberOfProductsVaiantsAllowed) {
                return common.returnResult(false, 403, 'Variant limit per product exceeded for your current plan.');
            }
        }

        // --- Category hierarchy -----------------------------------------
        if (body.mainCategory) {
            const categoryCheck = await validateCategoryHierarchy(vendorId, body.mainCategory, body.subCategory, companyMasterData);
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
            status: 'A',
            sizes: v.sizes.map((s) => ({ ...s, createdBy: userId, status: 'A' }))
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

        const responseProduct = product.toObject();
        responseProduct.id = common.encodeId(responseProduct._id);

        return common.returnResult(true, 201, 'Product created successfully', responseProduct);
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
                const categoryCheck = await validateCategoryHierarchy(vendorId, mainCategory, subCategory, companyMasterData);
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
            // CHANGED: counts total SIZE entries, not colors - see the
            // matching comment in createProduct.
            if ((companyMasterData.numberOfProductsVaiantsAllowed !== undefined && companyMasterData.numberOfProductsVaiantsAllowed !== null)) {
                const totalSizeEntries = body.variants.reduce((sum, v) => sum + (v.sizes ? v.sizes.length : 0), 0);
                if (totalSizeEntries > companyMasterData.numberOfProductsVaiantsAllowed) {
                    return common.returnResult(false, 403, 'Variant limit per product exceeded for your current plan.');
                }
            }

            const hasNewBulkPricing = body.variants.some((v) => v.additionalBulkPricing && v.additionalBulkPricing.length)
                || (body.bulkPricing && body.bulkPricing.length);
            if (hasNewBulkPricing) {
                const bulkPricingFeature = await common.checkFeatureOnOrOff(
                    vendorId, websiteMasterData, companyMasterData, 'isBulkPricingFeatureOn', 'isBulkPricingFeatureOn'
                );
                if (!bulkPricingFeature.isSuccess) {
                    return common.returnResult(false, bulkPricingFeature.statusCode, bulkPricingFeature.message);
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

            // --- POINT 2: default-size deletion/deactivation guard ------
            // CHANGED: isDefault now lives on a size entry, not the
            // variant, so this has to find the default SIZE (wherever it
            // is, under whichever color) rather than the default variant.
            let existingDefaultSize = null;
            for (const v of product.variants) {
                const found = (v.sizes || []).find((s) => s.isDefault === true);
                if (found) {
                    existingDefaultSize = found;
                    break;
                }
            }

            if (existingDefaultSize) {
                let submittedMatch = null;
                for (const v of resolvedVariants) {
                    const found = (v.sizes || []).find((s) => s._id && s._id.toString() === existingDefaultSize._id.toString());
                    if (found) {
                        submittedMatch = found;
                        break;
                    }
                }
                const beingRemoved = !submittedMatch;
                const beingDeactivatedWhileStillDefault = submittedMatch && submittedMatch.isDefault && submittedMatch.status === 'I';

                if (beingRemoved || beingDeactivatedWhileStillDefault) {
                    const anotherDefaultExists = resolvedVariants.some((v) =>
                        (v.sizes || []).some((s) => s.isDefault === true
                            && (!s._id || s._id.toString() !== existingDefaultSize._id.toString()))
                    );
                    if (!anotherDefaultExists) {
                        return common.returnResult(
                            false, 400,
                            'The default size cannot be deleted or made inactive without first marking another size as default.'
                        );
                    }
                }
            }

            // --- Merge: match variants (colors) by _id, then match each
            // variant's sizes by _id within it. New variant / new size (no
            // _id sent) -> created. Existing variant/size missing from the
            // submitted payload -> dropped (full-replace semantics, same
            // as before, just one level deeper now).
            const existingVariantById = new Map(product.variants.map((v) => [v._id.toString(), v]));

            finalVariants = resolvedVariants.map((v) => {
                const existingVariant = v._id && existingVariantById.has(v._id.toString())
                    ? existingVariantById.get(v._id.toString())
                    : null;

                const existingSizeById = existingVariant
                    ? new Map(existingVariant.sizes.map((s) => [s._id.toString(), s]))
                    : new Map();

                const mergedSizes = v.sizes.map((s) => {
                    if (s._id && existingSizeById.has(s._id.toString())) {
                        const existingSize = existingSizeById.get(s._id.toString());
                        const stockIncreased = s.stock > existingSize.stock;
                        return {
                            ...existingSize.toObject(),
                            ...s,
                            updatedBy: userId,
                            lastRestockedDate: stockIncreased ? new Date() : existingSize.lastRestockedDate
                        };
                    }
                    // New size added during update (either under an
                    // existing color, or under a brand-new color).
                    return { ...s, createdBy: userId, status: 'A' };
                });

                if (existingVariant) {
                    return {
                        ...existingVariant.toObject(),
                        ...v,
                        sizes: mergedSizes,
                        updatedBy: userId
                    };
                }
                // Brand-new variant (color) added during update.
                return { ...v, sizes: mergedSizes, createdBy: userId, status: 'A' };
            });
            // Any variant present in `product.variants` but absent from the
            // submitted `body.variants` (by _id) is dropped - full-replace
            // semantics for the variants array on update, same as before.
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

        const responseProduct = product.toObject();
        responseProduct.id = common.encodeId(responseProduct._id);

        return common.returnResult(true, 200, 'Product updated successfully', responseProduct);
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