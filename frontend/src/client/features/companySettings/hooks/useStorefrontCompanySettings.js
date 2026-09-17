import { useEffect, useState } from 'react';
import { getStorefrontCompanySettings } from '../api/companySettingsApi';

/**
 * Loads the current vendor's CompanySettings show/hide toggles for the
 * storefront (showAnnouncements, showBanners, ...). Any failure (vendor
 * hasn't created company settings yet, network error) falls back to `null`,
 * which callers should treat as "unknown - don't hide anything", matching
 * the schema's own defaults (showAnnouncements/showReviewsToCustomers
 * default to true) rather than punishing a vendor who never touched this
 * page yet.
 */
export const useStorefrontCompanySettings = () => {
  const [companySettings, setCompanySettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getStorefrontCompanySettings()
      .then((data) => {
        if (!cancelled) setCompanySettings(data || null);
      })
      .catch(() => {
        if (!cancelled) setCompanySettings(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { companySettings, loading };
};

export default useStorefrontCompanySettings;
