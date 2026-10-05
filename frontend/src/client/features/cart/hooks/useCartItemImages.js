import { useEffect, useMemo, useState } from 'react';
import { getStorefrontProductsByIds } from '../../products/api/productApi';

// The backend lookup by ids takes at most 50 per request.
const IDS_PER_REQUEST = 50;

// productId -> { sizeId -> image url }, for the page's lifetime: a quantity
// change, a removal or a re-render never fetches a product's images twice.
const imagesByProduct = new Map();

const sizeImageMap = (product) => {
  const bySize = {};
  let fallback = null;
  for (const variant of product.variants || []) {
    for (const size of variant.sizes || []) {
      const url = size.image?.url || null;
      if (url) {
        bySize[size._id] = url;
        fallback = fallback || url;
      }
    }
  }
  // A size with no picture of its own shows the product's first one.
  for (const variant of product.variants || []) {
    for (const size of variant.sizes || []) {
      if (!bySize[size._id] && fallback) bySize[size._id] = fallback;
    }
  }
  return bySize;
};

/**
 * Thumbnails for the cart's line items. The cart document stores no images
 * (backend/models/Cart.js), so they're looked up from the products themselves.
 * Only products not already looked up are requested, in batches. A failed
 * lookup just leaves those rows without a picture.
 *
 * @param {Array<{ productId: string, sizeId: string }>} lineItems
 * @returns {Record<string, string>} sizeId -> image url (missing = no picture)
 */
export const useCartItemImages = (lineItems) => {
  const productIds = useMemo(() => [...new Set(lineItems.map((item) => item.productId))], [lineItems]);
  // Bumped when a batch lands, to re-read the module-level cache.
  const [loadedCount, setLoadedCount] = useState(0);

  const missingKey = productIds.filter((id) => !imagesByProduct.has(id)).join(',');

  useEffect(() => {
    if (!missingKey) return undefined;
    let cancelled = false;
    const missing = missingKey.split(',');

    const batches = [];
    for (let i = 0; i < missing.length; i += IDS_PER_REQUEST) batches.push(missing.slice(i, i + IDS_PER_REQUEST));

    batches.forEach((ids) => {
      getStorefrontProductsByIds(ids)
        .then((data) => {
          (data?.products || []).forEach((product) => imagesByProduct.set(product._id, sizeImageMap(product)));
          // A product that came back empty (gone/inactive) is remembered as
          // picture-less so it isn't requested again on every render.
          ids.forEach((id) => {
            if (!imagesByProduct.has(id)) imagesByProduct.set(id, {});
          });
          if (!cancelled) setLoadedCount((count) => count + 1);
        })
        .catch(() => {
          // Leave these uncached so a later visit tries again.
        });
    });

    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  // loadedCount is read only to re-run this after a batch lands.
  return useMemo(() => {
    void loadedCount;
    const map = {};
    productIds.forEach((id) => Object.assign(map, imagesByProduct.get(id)));
    return map;
  }, [productIds, loadedCount]);
};

export default useCartItemImages;
