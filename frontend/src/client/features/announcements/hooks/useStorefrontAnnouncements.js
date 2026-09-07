import { useEffect, useState } from 'react';
import { getStorefrontAnnouncements } from '../api/announcementApi';

/**
 * Loads the current vendor's active announcements for the storefront marquee.
 * Announcements are decorative, not critical - any failure (feature off for
 * this vendor, network error, none configured) just means an empty list, so
 * AnnouncementBar can quietly render nothing rather than showing an error UI.
 */
export const useStorefrontAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getStorefrontAnnouncements()
      .then((data) => {
        if (cancelled) return;
        setAnnouncements(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setAnnouncements([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { announcements, loading };
};

export default useStorefrontAnnouncements;
