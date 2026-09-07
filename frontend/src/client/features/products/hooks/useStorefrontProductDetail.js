import { useCallback, useEffect, useState } from 'react';
import { getStorefrontProductById, getStorefrontCategories } from '../api/productApi';
import { shapeProductForDetail } from '../utils/shapeProduct';

/**
 * Loads a single storefront product by id, shaped for the product detail
 * page. Mirrors useStorefrontProducts' loading/error posture - this is core
 * content, so it gets a real spinner and an explicit error state rather than
 * failing silently.
 */
export const useStorefrontProductDetail = (productId) => {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const [productResult, categories] = await Promise.all([
        getStorefrontProductById(productId),
        getStorefrontCategories().catch(() => []),
      ]);

      const categoryNameById = new Map(
        (categories || []).map((c) => [String(c._id), c.categoryName])
      );

      setProduct(shapeProductForDetail(productResult?.product, categoryNameById));
    } catch (err) {
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  return { product, loading, error, reload: load };
};

export default useStorefrontProductDetail;
