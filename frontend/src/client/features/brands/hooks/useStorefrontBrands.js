import { useEffect, useState } from 'react';
import { getStorefrontBrands } from '../api/brandApi';

/**
 * Loads the current vendor's active brands for the storefront Brands
 * mega-menu. Same silent-fail posture as categories/announcements - if the
 * brand feature is off for this vendor or the request fails, the menu just
 * renders its empty state rather than an error UI.
 */
export const useStorefrontBrands = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getStorefrontBrands()
      .then((data) => {
        if (cancelled) return;
        setBrands(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setBrands([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { brands, loading };
};

export default useStorefrontBrands;
