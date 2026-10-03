import { useCallback } from 'react';
import { getStorefrontProductsByCategory } from '../api/productApi';
import { usePagedProducts } from './usePagedProducts';

/**
 * Active storefront products for one category (plus its active
 * descendants - see backend/services/productService.js
 * fetchProductsByCategoryForClient), a page at a time. The backend sends the
 * category's name with each page.
 *
 * @param {string} categoryId
 * @param {string} [sort]
 */
export const useStorefrontProductsByCategory = (categoryId, sort = 'featured') => {
  const fetchPage = useCallback(
    (page) => getStorefrontProductsByCategory(categoryId, { page, sort }),
    [categoryId, sort]
  );
  const list = usePagedProducts({ fetchPage, resetKey: `${categoryId}|${sort}`, enabled: !!categoryId });
  return { ...list, categoryName: list.extra.categoryName || '' };
};

export default useStorefrontProductsByCategory;
