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
  };
};
