import { useCallback, useEffect, useState } from 'react';
import * as lookupApi from '../api/lookupApi';

/**
 * Loads the CompanyMaster entitlement flags the banner form needs
 * (isVideoUploadingFeatureOn, mediaUploadAllowedInBanner) to decide which
 * media type(s) this vendor may attach to a banner. Kept separate from
 * useBanners so this (relatively static) data isn't refetched every time the
 * banner list mutates.
 */
export const useBannerLookups = () => {
  const [companyMaster, setCompanyMaster] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await lookupApi.getCompanyMasterData();
      setCompanyMaster(data || null);
    } catch {
      // No CompanyMaster doc yet (or the request failed) - the form falls back
      // to the schema defaults (image-only, video off) via its own null checks.
      setCompanyMaster(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { companyMaster, loading, refetch: fetchAll };
};

export default useBannerLookups;
