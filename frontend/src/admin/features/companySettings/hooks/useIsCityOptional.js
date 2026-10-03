import { useEffect, useState } from 'react';
import { getCompanySettings } from '../api/companySettingsApi';

/**
 * Whether this vendor has "Make City Optional" on (Company Settings >
 * General, CompanySettings.isCityOptional) - used by the admin forms that
 * collect a country/state/city (Add User, Edit Customer, Delivery Agent) to
 * decide whether City is mandatory. Any failure (no settings document yet,
 * network error) falls back to false = city required, matching the schema
 * default; the server enforces the setting either way.
 *
 * @returns {boolean}
 */
export const useIsCityOptional = () => {
  const [isCityOptional, setIsCityOptional] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCompanySettings()
      .then((settings) => {
        if (!cancelled) setIsCityOptional(settings?.isCityOptional === true);
      })
      .catch(() => {
        if (!cancelled) setIsCityOptional(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return isCityOptional;
};

export default useIsCityOptional;
