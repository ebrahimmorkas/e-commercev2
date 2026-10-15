import { useCallback, useEffect, useState } from 'react';
import { getStorefrontBanners } from '../api/bannerApi';
import { getStorefrontCompanySettings } from '../../companySettings/api/companySettingsApi';

const IMAGE_ROTATION_MS = 5000;

/**
 * Loads the current vendor's active banners and picks the one the hero should
 * show. The backend already sorts by { isDefault: -1, precedence: 1 }, so the
 * first entry is the default. When the vendor turns on CompanySettings.
 * isBannerRotationOn and there are several banners, the hero cycles through
 * them: images advance on a timer, videos advance when they finish (`next` is
 * exposed for that). Banners are decorative like the announcement marquee -
 * any failure (feature off, none configured, network error) just means no
 * banner, and HomePage falls back to the static hero.
 */
export const useStorefrontBanner = () => {
  const [banners, setBanners] = useState([]);
  const [rotationOn, setRotationOn] = useState(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getStorefrontBanners().catch(() => []),
      getStorefrontCompanySettings().catch(() => null),
    ]).then(([data, settings]) => {
      if (cancelled) return;
      setBanners(Array.isArray(data) ? data : []);
      setRotationOn(!!settings?.isBannerRotationOn);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const isRotating = rotationOn && banners.length > 1;
  const banner = banners.length ? banners[index % banners.length] : null;

  const next = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  // Images advance on a timer. Videos are advanced by the caller via `next`
  // (onEnded) so a clip isn't cut off mid-play.
  useEffect(() => {
    if (!isRotating || banner?.video) return undefined;
    const timer = setTimeout(next, IMAGE_ROTATION_MS);
    return () => clearTimeout(timer);
  }, [isRotating, banner, next]);

  return { banner, loading, isRotating, next };
};

export default useStorefrontBanner;
