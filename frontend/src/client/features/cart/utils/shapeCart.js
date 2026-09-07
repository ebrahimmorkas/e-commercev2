/**
 * Flattens a Cart document's products[].variants[].sizes[] tree (see
 * backend/models/Cart.js) into one array of line items - the storefront
 * only ever needs to key/display by size, never by the product/variant
 * grouping the backend stores it in.
 */
export const flattenCartLineItems = (cart) => {
  const items = [];
  for (const product of cart?.products || []) {
    for (const variant of product.variants || []) {
      for (const size of variant.sizes || []) {
        items.push({
          productId: String(product.productId),
          productName: product.productName,
          variantId: String(variant.variantId),
          variantName: variant.variantName,
          sizeId: String(size.sizeId),
          sizeName: size.sizeName,
          labelValue: size.labelValue || null,
          unitPrice: size.unitPrice,
          quantity: size.quantity,
          sku: size.sku,
        });
      }
    }
  }
  return items;
};

/**
 * Map of sizeId -> quantity, the shape ProductCard/QuantityStepper/
 * ProductDetailPage's `cartItems` prop expects.
 */
export const buildCartItemsMap = (cart) =>
  Object.fromEntries(flattenCartLineItems(cart).map((item) => [item.sizeId, item.quantity]));

export default { flattenCartLineItems, buildCartItemsMap };
