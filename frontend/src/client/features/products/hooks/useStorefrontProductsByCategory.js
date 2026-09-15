import { useCallback, useEffect, useState } from 'react';
import { getStorefrontCategories, getStorefrontProductsByCategory } from '../api/productApi';
import { shapeProductForCard } from '../utils/shapeProduct';

/**
 * Loads active storefront products for one category (plus its active
 * descendants - see backend/services/productService.js
 * fetchProductsByCategoryForClient), shaped for display as product cards.
 * Same category-name-lookup and silent-fail-on-categories posture as
 * useStorefrontProducts.
 */
export const useStorefrontProductsByCategory = (categoryId) => {
  const [products, setProducts] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    setError(null);
    try {
      const [productsResult, categories] = await Promise.all([
        getStorefrontProductsByCategory(categoryId),
        getStorefrontCategories().catch(() => []),
      ]);

      const categoryNameById = new Map(
        (categories || []).map((c) => [String(c._id), c.categoryName])
      );

      const shaped = (productsResult?.products || []).map((p) => shapeProductForCard(p, categoryNameById));
      setProducts(shaped);
      setCategoryName(categoryNameById.get(String(categoryId)) || '');
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  return { products, categoryName, loading, error, reload: load };
};

export default useStorefrontProductsByCategory;
