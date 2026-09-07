import { useCallback, useEffect, useState } from 'react';
import { getStorefrontCategories, getStorefrontProducts } from '../api/productApi';
import { shapeProductForCard } from '../utils/shapeProduct';

/**
 * Loads the current vendor's active storefront products, shaped for display
 * as product cards. Categories are best-effort - if the category feature is
 * off (or the lookup fails) for this vendor, cards just fall back to a
 * color-based label instead of failing the whole page.
 */
export const useStorefrontProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsResult, categories] = await Promise.all([
        getStorefrontProducts(),
        getStorefrontCategories().catch(() => []),
      ]);

      const categoryNameById = new Map(
        (categories || []).map((c) => [String(c._id), c.categoryName])
      );

      const shaped = (productsResult?.products || []).map((p) => shapeProductForCard(p, categoryNameById));
      setProducts(shaped);
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { products, loading, error, reload: load };
};

export default useStorefrontProducts;
