/**
 * Client-side "draft" shape for the product form, and the two conversions
 * to/from the backend contract (see backend/models/Product.js,
 * backend/middlewares/validations/productValidations.js and
 * backend/services/productService.js for the source of truth).
 *
 * IMPORTANT caveat baked into mapApiProductToDraft(): the admin GET response
 * (productService.shapeVariantForResponse/shapeSizeForResponse) only returns
 * the COMBINED description/disclaimer/bulkPricing arrays and never the raw
 * isXSameFromYDetails flags or the raw *Additional* fields that produced
 * them. There is no way to reconstruct those from the response alone (the
 * combination is only reversible if you already know the flag). So on edit,
 * every "same as parent" flag is initialized to false and the full combined
 * array/string the API returned becomes that level's own editable
 * "additional" content directly. Resubmitting untouched is still byte-for-
 * byte equivalent (combineArrays with sameFlag=false returns the additional
 * array verbatim), so this is safe - it just means an edited product's
 * "same as parent" toggles always start OFF and re-inherit nothing until
 * the user explicitly turns them back on and cleans up any now-duplicated
 * rows themselves.
 */

let clientIdCounter = 0;
export const nextClientId = (prefix) => `${prefix}-${Date.now()}-${clientIdCounter++}`;

export const emptyPolicy = () => ({ isAvailable: false, duration: null, durationType: null });

export const emptyShipping = () => ({ type: 'COMPANY_SETTINGS', value: null });

export const emptySize = (sizeMaster = null) => ({
  clientId: nextClientId('size'),
  _id: undefined,
  isDefaultSize: false,
  sizeType: sizeMaster?.type || 'LABEL',
  sizeId: sizeMaster ? String(sizeMaster._id) : '',
  sizeName: sizeMaster?.name || '',
  imageFile: null,
  imagePreviewUrl: null,
  existingImage: null,
  removeImage: false,
  additionalImageFile: null,
  additionalImagePreviewUrl: null,
  existingAdditionalImages: [],
  removeAdditionalImages: false,
  // Product videos, in gallery order: { videoAssetId, url, name, isNew }.
  // isNew = uploaded while this form was open and not saved yet (see
  // hooks/useProductVideoUploads.js). Videos still uploading are kept outside
  // the draft, in that hook.
  videos: [],
  sizeAdditionalDisclaimer: '',
  sizeAdditionalDescription: [],
  sizeAdditionalBulkPricing: [],
  isDescriptionSameFromVariantsDetails: false,
  isDisclaimerSameFromVariantsDetails: false,
  isBulkPricingSameFromVariantsDetails: false,
  warranty: emptyPolicy(),
  return: emptyPolicy(),
  exchange: emptyPolicy(),
  shipping: emptyShipping(),
  precedence: null,
  excludeCountries: [],
  excludeStates: [],
  excludeCities: [],
  excludeZipCodes: [],
  brandId: '',
  values: [],
  labelValue: '',
  price: '',
  cancelledPrice: '',
  internationalPrice: '',
  internationalCancelledPrice: '',
  stock: 0,
  weight: null,
  sku: '',
  barcode: '',
  sizeCode: '',
});

export const emptyVariant = () => ({
  clientId: nextClientId('variant'),
  _id: undefined,
  isDefaultVariant: false,
  color: null,
  displayName: '',
  variantAdditionalDisclaimer: '',
  variantAdditionalDescription: [],
  variantAdditionalBulkPricing: [],
  isDescriptionSameFromProductBasicDetails: false,
  isDisclaimerSameFromProductBasicDetails: false,
  isBulkPricingSameFromProductBasicDetails: false,
  variantCode: '',
  sizes: [],
});

export const emptyProduct = () => ({
  name: '',
  description: [],
  disclaimer: '',
  colors: [],
  mainCategory: '',
  subCategory: '',
  searchKeywords: [],
  recommendedProducts: [],
  taxIds: [],
  precedence: null,
  productCode: '',
  bulkPricing: [],
  variants: [],
});

const toDraftSize = (size) => ({
  clientId: nextClientId('size'),
  _id: size._id,
  isDefaultSize: !!size.isDefaultSize,
  sizeType: size.sizeType,
  sizeId: size.sizeId ? String(size.sizeId) : '',
  sizeName: size.sizeName || '',
  imageFile: null,
  imagePreviewUrl: null,
  existingImage: size.image || null,
  removeImage: false,
  additionalImageFile: null,
  additionalImagePreviewUrl: null,
  existingAdditionalImages: size.additionalImages || [],
  removeAdditionalImages: false,
  videos: (size.videos || []).map((video, index) => ({
    videoAssetId: String(video.videoAssetId),
    url: video.url,
    name: `Video ${index + 1}`,
    isNew: false,
  })),
  sizeAdditionalDisclaimer: (size.disclaimer && size.disclaimer[0]) || '',
  sizeAdditionalDescription: size.description || [],
  sizeAdditionalBulkPricing: size.bulkPricing || [],
  isDescriptionSameFromVariantsDetails: false,
  isDisclaimerSameFromVariantsDetails: false,
  isBulkPricingSameFromVariantsDetails: false,
  warranty: size.warranty || emptyPolicy(),
  return: size.return || emptyPolicy(),
  exchange: size.exchange || emptyPolicy(),
  shipping: size.shipping || emptyShipping(),
  precedence: size.precedence ?? null,
  excludeCountries: (size.excludeCountries || []).map(String),
  excludeStates: (size.excludeStates || []).map(String),
  excludeCities: (size.excludeCities || []).map(String),
  excludeZipCodes: size.excludeZipCodes || [],
  brandId: size.brandId ? String(size.brandId) : '',
  values: (size.values || []).map((v) => ({ measurementId: String(v.measurementId), unit: String(v.unit), value: v.value })),
  labelValue: size.labelValue || '',
  price: size.price ?? '',
  cancelledPrice: size.cancelledPrice ?? '',
  internationalPrice: size.internationalPrice ?? '',
  internationalCancelledPrice: size.internationalCancelledPrice ?? '',
  stock: size.stock ?? 0,
  weight: size.weight ? { value: size.weight.value, unit: String(size.weight.unit) } : null,
  sku: size.sku || '',
  barcode: size.barcode || '',
  sizeCode: size.sizeCode || '',
});

const toDraftVariant = (variant) => ({
  clientId: nextClientId('variant'),
  _id: variant._id,
  isDefaultVariant: !!variant.isDefaultVariant,
  color: variant.color || null,
  displayName: variant.displayName || '',
  variantAdditionalDisclaimer: (variant.disclaimer && variant.disclaimer[0]) || '',
  variantAdditionalDescription: variant.description || [],
  variantAdditionalBulkPricing: variant.bulkPricing || [],
  isDescriptionSameFromProductBasicDetails: false,
  isDisclaimerSameFromProductBasicDetails: false,
  isBulkPricingSameFromProductBasicDetails: false,
  variantCode: variant.variantCode || '',
  sizes: (variant.sizes || []).map(toDraftSize),
});

export const mapApiProductToDraft = (product) => ({
  _id: product._id,
  name: product.name || '',
  description: product.description || [],
  disclaimer: (product.disclaimer && product.disclaimer[0]) || '',
  colors: product.colors || [],
  mainCategory: product.mainCategory ? String(product.mainCategory) : '',
  subCategory: product.subCategory ? String(product.subCategory) : '',
  searchKeywords: product.searchKeywords || [],
  recommendedProducts: (product.recommendedProducts || []).map(String),
  taxIds: (product.taxIds || []).map(String),
  precedence: product.precedence ?? null,
  productCode: product.productCode || '',
  bulkPricing: product.bulkPricing || [],
  variants: (product.variants || []).map(toDraftVariant),
});

// Blank optional price -> null (the backend treats null as "not set").
const optionalPrice = (value) => (value === '' || value == null ? null : Number(value));

const cleanBulkPricing = (rows) =>
  (rows || [])
    .filter((r) => r.minimumQuantity !== '' && r.maximumQuantity !== '' && r.price !== '')
    .map((r) => ({
      minimumQuantity: Number(r.minimumQuantity),
      maximumQuantity: Number(r.maximumQuantity),
      price: Number(r.price),
      internationalPrice: optionalPrice(r.internationalPrice),
    }));

const cleanPolicy = (policy) => {
  if (!policy?.isAvailable) return { isAvailable: false, duration: null, durationType: null };
  return { isAvailable: true, duration: policy.duration === '' ? null : Number(policy.duration), durationType: policy.durationType || null };
};

const cleanShipping = (shipping) => {
  if (!shipping) return null;
  if (shipping.type === 'CUSTOM') return { type: 'CUSTOM', value: shipping.value === '' ? null : Number(shipping.value) };
  return { type: 'COMPANY_SETTINGS' };
};

// Every video the draft lists (all sizes) - the per-product count limit is on this.
export const countDraftVideos = (draft) =>
  (draft?.variants || []).reduce(
    (sum, variant) => sum + (variant.sizes || []).reduce((sizeSum, size) => sizeSum + (size.videos?.length || 0), 0),
    0
  );

/**
 * Converts the in-progress draft into the JSON body the create/update
 * endpoints expect, plus the flat lists of {variantIndex, sizeIndex, file}
 * new-image uploads to append to the multipart FormData (see productApi.js).
 * Existing images that weren't replaced are simply omitted - the backend
 * carries them forward by matching each size's `_id`.
 */
export const buildSubmitPayload = (draft, { isProductCodeAutoGenerated } = {}) => {
  const mainImages = [];
  const additionalImageUploads = [];

  const variants = draft.variants.map((variant, variantIndex) => {
    const sizes = variant.sizes.map((size, sizeIndex) => {
      if (size.imageFile) mainImages.push({ variantIndex, sizeIndex, file: size.imageFile });
      if (size.additionalImageFile) additionalImageUploads.push({ variantIndex, sizeIndex, file: size.additionalImageFile });

      const base = {
        ...(size._id ? { _id: size._id, removeImage: !!size.removeImage, removeAdditionalImages: !!size.removeAdditionalImages } : {}),
        isDefaultSize: size.isDefaultSize,
        sizeType: size.sizeType,
        sizeId: size.sizeId,
        sizeName: size.sizeName.trim(),
        // Always sent (also []), so removing every video of a size removes them.
        videos: (size.videos || []).map((video) => video.videoAssetId),
        sizeAdditionalDisclaimer: size.sizeAdditionalDisclaimer || null,
        sizeAdditionalDescription: size.sizeAdditionalDescription,
        sizeAdditionalBulkPricing: cleanBulkPricing(size.sizeAdditionalBulkPricing),
        warranty: cleanPolicy(size.warranty),
        return: cleanPolicy(size.return),
        exchange: cleanPolicy(size.exchange),
        shipping: cleanShipping(size.shipping),
        isDescriptionSameFromVariantsDetails: size.isDescriptionSameFromVariantsDetails,
        isDisclaimerSameFromVariantsDetails: size.isDisclaimerSameFromVariantsDetails,
        isBulkPricingSameFromVariantsDetails: size.isBulkPricingSameFromVariantsDetails,
        precedence: size.precedence === '' || size.precedence == null ? undefined : Number(size.precedence),
        excludeCountries: size.excludeCountries,
        excludeStates: size.excludeStates,
        excludeCities: size.excludeCities,
        excludeZipCodes: size.excludeZipCodes,
        brandId: size.brandId || null,
        price: Number(size.price),
        cancelledPrice: size.cancelledPrice === '' || size.cancelledPrice == null ? null : Number(size.cancelledPrice),
        internationalPrice: optionalPrice(size.internationalPrice),
        internationalCancelledPrice: optionalPrice(size.internationalCancelledPrice),
        stock: size.stock === '' ? 0 : Number(size.stock),
        weight: size.weight && size.weight.value !== '' && size.weight.unit ? { value: Number(size.weight.value), unit: size.weight.unit } : null,
        sku: size.sku.trim(),
        barcode: size.barcode || null,
        ...(size._id ? {} : { sizeCode: size.sizeCode || undefined }),
      };

      if (size.sizeType === 'MEASURABLE') {
        base.values = size.values.map((v) => ({ measurementId: v.measurementId, unit: v.unit, value: Number(v.value) }));
      } else {
        base.labelValue = size.labelValue;
      }

      return base;
    });

    return {
      ...(variant._id ? { _id: variant._id } : {}),
      isDefaultVariant: variant.isDefaultVariant,
      color: variant.color || null,
      displayName: variant.displayName || null,
      sizes,
      variantAdditionalDisclaimer: variant.variantAdditionalDisclaimer || null,
      variantAdditionalDescription: variant.variantAdditionalDescription,
      variantAdditionalBulkPricing: cleanBulkPricing(variant.variantAdditionalBulkPricing),
      isDescriptionSameFromProductBasicDetails: variant.isDescriptionSameFromProductBasicDetails,
      isDisclaimerSameFromProductBasicDetails: variant.isDisclaimerSameFromProductBasicDetails,
      isBulkPricingSameFromProductBasicDetails: variant.isBulkPricingSameFromProductBasicDetails,
      ...(variant._id ? {} : { variantCode: variant.variantCode || undefined }),
    };
  });

  const payload = {
    ...(draft._id ? { productId: draft._id } : {}),
    name: draft.name.trim(),
    description: draft.description,
    disclaimer: draft.disclaimer || null,
    colors: draft.colors,
    mainCategory: draft.mainCategory || null,
    subCategory: draft.subCategory || null,
    searchKeywords: draft.searchKeywords,
    recommendedProducts: draft.recommendedProducts,
    taxIds: draft.taxIds,
    precedence: draft.precedence === '' || draft.precedence == null ? undefined : Number(draft.precedence),
    bulkPricing: cleanBulkPricing(draft.bulkPricing),
    variants,
    ...(isProductCodeAutoGenerated || draft._id ? {} : { productCode: draft.productCode || undefined }),
  };

  return { payload, mainImages, additionalImageUploads };
};
