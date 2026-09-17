import { useEffect, useState } from 'react';
import { getStorefrontAnnouncements } from '../api/announcementApi';
import { useStorefrontCompanySettings } from '../../companySettings/hooks/useStorefrontCompanySettings';

/**
 * Loads the current vendor's active announcements for the storefront marquee.
 * Announcements are decorative, not critical - any failure (feature off for
 * this vendor, network error, none configured) just means an empty list, so
 * AnnouncementBar can quietly render nothing rather than showing an error UI.
 *
 * The backend's own public announcement endpoint doesn't check
 * CompanySettings.showAnnouncements itself (only the platform-level
 * isAnnouncementFeatureOn entitlement), so that vendor-facing on/off toggle
 * is enforced here on the client: the fetched list is only exposed once we
 * know showAnnouncements isn't explicitly false. `null`/loading counts as
 * "unknown", not "off" - see useStorefrontCompanySettings.
 */
export const useStorefrontAnnouncements = () => {
  const [rawAnnouncements, setRawAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const { companySettings, loading: companySettingsLoading } = useStorefrontCompanySettings();

  useEffect(() => {
    let cancelled = false;

    getStorefrontAnnouncements()
      .then((data) => {
        if (cancelled) return;
        setRawAnnouncements(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setRawAnnouncements([]);
      })
      .finally(() => {
        if (!cancelled) setAnnouncementsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loading = announcementsLoading || companySettingsLoading;
  const showAnnouncements = companySettings?.showAnnouncements !== false;
  const announcements = showAnnouncements ? rawAnnouncements : [];

  return { announcements, loading };
};

export default useStorefrontAnnouncements;
