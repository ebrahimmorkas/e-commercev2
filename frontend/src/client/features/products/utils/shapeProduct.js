/**
 * Flattens a product's variants[].sizes[] tree into a single list of sizes,
 * each tagged with its parent variant - mirrors the admin ProductsPage
 * helpers (frontend/src/admin/features/products/pages/ProductsPage.jsx).
 */  
const allSizes = (product) =>
  (product.variants || []).flatMap((variant) =>
    (variant.sizes || []).map((size) => ({ ...size, variantId: variant._id, variantColor: variant.color }))
  );

/**
 * Picks the size a storefront card/detail view should lead with: the size
 * flagged as default, falling back to the first one available.
 */
export const pickDisplaySize = (product) => {
  const sizes = allSizes(product);
  return sizes.find((s) => s.isDefaultSize) || sizes[0] || null;
};

/**
 * Shapes one storefront product (as returned by GET /products/get-products)
 * into the flat fields a product card needs, resolving its category name
 * from the id -> name map built out of GET /category/get-categories.
 *
 * @param {Object} product  
 * @param {Map<string, string>} [categoryNameById]
 */
export const shapeProductForCard = (product, categoryNameById = new Map()) => {
  const sizes = allSizes(product);
  const displaySize = pickDisplaySize(product);
  const prices = sizes.map((s) => s.price).filter((p) => typeof p === 'number');
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const totalStock = sizes.reduce((sum, s) => sum + (s.stock || 0), 0);

  const categoryName =
    categoryNameById.get(String(product.subCategory)) ||
    categoryNameById.get(String(product.mainCategory)) ||
    product.colors?.[0] ||
    'Product';

  // `displaySize.bulkPricing` is already the fully combined product+variant+size
  // tier chain from the backend (see productService.js shapeSizeForResponse /
  // combineArrays) - just sort it for display, no re-merging needed here.
  const bulkPricing = [...(displaySize?.bulkPricing || [])].sort(
    (a, b) => a.minimumQuantity - b.minimumQuantity
  );

  return {
    id: product._id,
    slug: product.slug,
    name: product.name,
    category: categoryName,
    image: displaySize?.image?.url || null,
    price: displaySize?.price ?? minPrice,
    cancelledPrice: displaySize?.cancelledPrice ?? null,
    priceRange: minPrice !== null && minPrice !== maxPrice ? { min: minPrice, max: maxPrice } : null,
    unit: displaySize?.labelValue || null,
    inStock: totalStock > 0,
    stock: displaySize?.stock ?? 0,
    sizeId: displaySize?._id || null,
    variantId: displaySize?.variantId || null,
    bulkPricing,
    averageRating: product.averageRating || 0,
    totalReviews: product.totalReviews || 0,
  };
};

/**
 * Shapes one storefront product (as returned by GET /products/get-product/:id)
 * into the full variant/size tree a product detail page needs - unlike the
 * card shape, nothing is flattened/picked here since the page lets the
 * shopper choose their own variant (color) and size.
 *
 * @param {Object} product
 * @param {Map<string, string>} [categoryNameById]
 */
export const shapeProductForDetail = (product, categoryNameById = new Map()) => {
  const categoryName =
    categoryNameById.get(String(product.subCategory)) ||
    categoryNameById.get(String(product.mainCategory)) ||
    product.colors?.[0] ||
    'Product';

  const variants = (product.variants || []).map((variant) => ({
    id: variant._id,
    color: variant.color,
    displayName: variant.displayName,
    isDefaultVariant: variant.isDefaultVariant,
    sizes: (variant.sizes || []).map((size) => ({
      id: size._id,
      isDefaultSize: size.isDefaultSize,
      sizeName: size.sizeName,
      labelValue: size.labelValue,
      image: size.image?.url || null,
      additionalImages: (size.additionalImages || []).map((img) => img.url).filter(Boolean),
      // Only sent when the store has product videos on (otherwise []).
      videos: (size.videos || []).map((video) => video.url).filter(Boolean),
      description: size.description || [],
      disclaimer: size.disclaimer || [],
      bulkPricing: [...(size.bulkPricing || [])].sort((a, b) => a.minimumQuantity - b.minimumQuantity),
      warranty: size.warranty || null,
      return: size.return || null,
      exchange: size.exchange || null,
      price: size.price,
      cancelledPrice: size.cancelledPrice ?? null,
      stock: size.stock || 0,
      brand: size.brand || null,
      excludeText: size.excludeText || null,
    })),
  }));

  return {
    id: product._id,
    slug: product.slug,
    name: product.name,
    category: categoryName,
    productCode: product.productCode,
    colors: product.colors || [],
    variants,
    recommendedProducts: (product.recommendedProducts || []).map(String),
    averageRating: product.averageRating || 0,
    totalReviews: product.totalReviews || 0,
    // Company Settings: where videos sit in the gallery (1 = first) and whether they autoplay.
    videoGallery: {
      position: Number.isInteger(product.videoGallery?.position) && product.videoGallery.position >= 1 ? product.videoGallery.position : 1,
      autoplay: product.videoGallery?.autoplay !== false,
    },
  };
};

/**
 * A size's gallery, in display order: { type: 'image' | 'video', url }.
 * Every video of the size goes in as one block at `position` (1 = first):
 * with 2 it is main image, the videos, then the additional images. A
 * position past the last image puts the videos last.
 *
 * @param {{ image: string|null, additionalImages: string[], videos?: string[] }} size
 * @param {{ position: number }} videoGallery
 */
export const buildSizeGallery = (size, videoGallery) => {
  if (!size) return [];
  const images = [size.image, ...(size.additionalImages || [])].filter(Boolean).map((url) => ({ type: 'image', url }));
  const videos = (size.videos || []).map((url) => ({ type: 'video', url }));
  const insertAt = Math.min(Math.max((videoGallery?.position || 1) - 1, 0), images.length);
  return [...images.slice(0, insertAt), ...videos, ...images.slice(insertAt)];
};
