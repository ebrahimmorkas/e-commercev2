import { useEffect, useMemo, useState } from 'react';
import { getSignupLocations } from '../api/authApi';

/**
 * Country -> State -> City options for the signup form: only the countries
 * this store serves (CompanyMaster.allowedCountries), states of the chosen
 * country, cities of the chosen state. Values are the (encoded) ids the
 * backend stores on the account and turns into the Country/State/City cookies
 * that decide the shopper's currency, tax and shipping.
 *
 * @param {boolean} enabled - Load only while the register form is open.
 * @param {string} countryId
 * @param {string} stateId
 */
export const useSignupLocations = (enabled, countryId, stateId) => {
  const [bundle, setBundle] = useState(null);

  useEffect(() => {
    if (!enabled || bundle) return undefined;
    let cancelled = false;
    getSignupLocations()
      .then((result) => {
        if (!cancelled) setBundle(result || { countries: [], states: [], cities: [] });
      })
      .catch(() => {
        if (!cancelled) setBundle({ countries: [], states: [], cities: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, bundle]);

  const countryOptions = useMemo(
    () => (bundle?.countries || []).map((country) => ({ value: String(country._id), label: country.country_name })),
    [bundle]
  );

  const stateOptions = useMemo(() => {
    const group = (bundle?.states || []).find((g) => String(g.countryId) === String(countryId));
    return (group?.states || []).map((state) => ({ value: String(state._id), label: state.state_name }));
  }, [bundle, countryId]);

  const cityOptions = useMemo(() => {
    const countryGroup = (bundle?.cities || []).find((g) => String(g.countryId) === String(countryId));
    const stateGroup = (countryGroup?.states || []).find((g) => String(g.stateId) === String(stateId));
    return (stateGroup?.cities || []).map((city) => ({ value: String(city._id), label: city.city_name }));
  }, [bundle, countryId, stateId]);

  return { loading: enabled && !bundle, countryOptions, stateOptions, cityOptions };
};

export default useSignupLocations;
