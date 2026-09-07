import { useEffect, useState } from 'react';
import { getStorefrontProducts, getStorefrontCategories } from '../api/productApi';
import { shapeProductForCard } from '../utils/shapeProduct';

/**
 * Resolves a product's `recommendedProducts` (an array of Mongo ids) into
 * shaped cards. There's no "get products by ids" endpoint, so this reuses
 * the same GET /products/get-products list the homepage grid already fetches
 * and filters it down client-side - recommendedProducts lists are small and
 * this is a low-traffic page, so one extra list fetch is cheap compared to
 * adding a new backend route.
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

    Promise.all([getStorefrontProducts(), getStorefrontCategories().catch(() => [])])
      .then(([productsResult, categories]) => {
        if (cancelled) return;
        const categoryNameById = new Map((categories || []).map((c) => [String(c._id), c.categoryName]));
        const idSet = new Set(ids.map(String));
        const matched = (productsResult?.products || [])
          .filter((p) => idSet.has(String(p._id)))
          .map((p) => shapeProductForCard(p, categoryNameById));
        setProducts(matched);
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
