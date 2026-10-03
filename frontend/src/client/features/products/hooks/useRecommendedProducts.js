import { useEffect, useState } from 'react';
import { getStorefrontProductsByIds } from '../api/productApi';
import { shapeProductForCard } from '../utils/shapeProduct';
import { loadCategoryNameMap } from '../utils/categoryNames';

/**
 * Resolves a product's `recommendedProducts` (an array of Mongo ids) into
 * shaped cards, fetching just those products by id (GET
 * /products/get-products?ids=...) - inactive ones simply don't come back.
 *
 * Silently resolves to an empty list on failure or when there's nothing to
 * recommend - recommendations are decorative, not core content (same
 * posture the announcement marquee used to have).
 */
export const useRecommendedProducts = (recommendedIds) => {
  const ids = recommendedIds || [];
  const key = ids.length ? [...ids].sort().join(',') : '';

  const [products, setProducts] = useState([]);
  // Tracks which id-set `products` was fetched for, so a change in ids
  // (including going to none) clears stale results synchronously during
  // render instead of leaving the previous product's recommendations
  // showing while the new fetch is in flight.
  const [productsForKey, setProductsForKey] = useState(null);
  if (key !== productsForKey) {
    setProductsForKey(key);
    setProducts([]);
  }

  useEffect(() => {
    if (ids.length === 0) return undefined;
    let cancelled = false;

    Promise.all([getStorefrontProductsByIds(ids), loadCategoryNameMap()])
      .then(([productsResult, categoryNameById]) => {
        if (cancelled) return;
        setProducts((productsResult?.products || []).map((p) => shapeProductForCard(p, categoryNameById)));
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { products };
};

export default useRecommendedProducts;
