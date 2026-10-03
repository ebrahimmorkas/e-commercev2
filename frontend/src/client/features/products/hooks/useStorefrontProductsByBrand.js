import { useCallback } from 'react';
import { getStorefrontProductsByBrand } from '../api/productApi';
import { usePagedProducts } from './usePagedProducts';

/**
 * Active storefront products of one brand, a page at a time. The backend
 * sends the brand's name with each page.
 *
 * @param {string} brandId
 * @param {string} [sort]
 */
export const useStorefrontProductsByBrand = (brandId, sort = 'featured') => {
  const fetchPage = useCallback(
    (page) => getStorefrontProductsByBrand(brandId, { page, sort }),
    [brandId, sort]
  );
  const list = usePagedProducts({ fetchPage, resetKey: `${brandId}|${sort}`, enabled: !!brandId });
  return { ...list, brandName: list.extra.brandName || '' };
};

export default useStorefrontProductsByBrand;
