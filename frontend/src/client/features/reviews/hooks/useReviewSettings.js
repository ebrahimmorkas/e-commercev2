import { useEffect, useState } from 'react';
import { getReviewSettings } from '../api/reviewApi';

// Every product card asks for the same thing, so one request is shared by
// the whole page load. A failed request is forgotten so a later mount retries.
let settingsPromise = null;

const loadSettings = () => {
  if (!settingsPromise) {
    settingsPromise = getReviewSettings()
      .then((data) => data?.settings || null)
      .catch(() => {
        settingsPromise = null;
        return null;
      });
  }
  return settingsPromise;
};

/**
 * Store-wide review switches (backend reviewService.getReviewSettings):
 *   isEnabled   - customers may write reviews (WebsiteMaster + CompanyMaster
 *                 isProductReviewFeatureOn)
 *   showReviews - ratings/reviews may be shown (isEnabled + the vendor's
 *                 "Show reviews to customers")
 *   imagesAllowed, maxImagesPerReview, maxImageSizeMB, allowedImageFormats
 * Until it loads (or if it fails) everything is treated as off, so no review
 * UI flashes up on a store that has reviews switched off.
 */
export const useReviewSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then((data) => {
      if (cancelled) return;
      setSettings(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    settings,
    loading,
    isEnabled: !!settings?.isEnabled,
    showReviews: !!settings?.showReviews,
  };
};

export default useReviewSettings;
