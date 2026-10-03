import { useCallback } from 'react';
import { getStorefrontProducts } from '../api/productApi';
import { usePagedProducts } from './usePagedProducts';

export const FEATURED_PRODUCT_COUNT = 12;

/**
 * The homepage's featured products: ONE small page (admin-set precedence
 * first, see backend productService "featured" sort), never the whole
 * catalogue - the landing page costs the same with 10 or 50,000 products.
 * `total` is the catalogue size, for the "View all products" link.
 */
export const useStorefrontProducts = (limit = FEATURED_PRODUCT_COUNT) => {
  const fetchPage = useCallback((page) => getStorefrontProducts({ page, limit, sort: 'featured' }), [limit]);
  const { products, total, loading, error, reload } = usePagedProducts({ fetchPage, resetKey: `featured|${limit}` });
  return { products, total, loading, error, reload };
};

export default useStorefrontProducts;
