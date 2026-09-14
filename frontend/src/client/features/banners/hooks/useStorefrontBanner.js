import { useEffect, useState } from 'react';
import { getStorefrontBanners } from '../api/bannerApi';

/**
 * Loads the current vendor's active banners and picks the one the hero should
 * show. The backend already sorts by { isDefault: -1, precedence: 1 }, so the
 * first entry is the right one to display. Banners are decorative like the
 * announcement marquee - any failure (feature off, none configured, network
 * error) just means no banner, and HomePage falls back to the static hero.
 */
export const useStorefrontBanner = () => {
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getStorefrontBanners()
      .then((data) => {
        if (cancelled) return;
        const banners = Array.isArray(data) ? data : [];
        setBanner(banners[0] || null);
      })
      .catch(() => {
        if (!cancelled) setBanner(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { banner, loading };
};

export default useStorefrontBanner;
