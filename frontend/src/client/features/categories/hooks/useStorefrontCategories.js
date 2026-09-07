import { useEffect, useState } from 'react';
import { getStorefrontCategories } from '../api/categoryApi';
import { buildCategoryTree } from '../utils/buildCategoryTree';

/**
 * Loads the current vendor's active category tree for the storefront Shop
 * mega-menu. Same silent-fail posture as announcements/products' category
 * lookup - if the category feature is off for this vendor or the request
 * fails, the menu just renders its empty state rather than an error UI.
 */
export const useStorefrontCategories = () => {
  const [categoryTree, setCategoryTree] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getStorefrontCategories()
      .then((data) => {
        if (cancelled) return;
        setCategoryTree(buildCategoryTree(Array.isArray(data) ? data : []));
      })
      .catch(() => {
        if (!cancelled) setCategoryTree([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { categoryTree, loading };
};

export default useStorefrontCategories;
