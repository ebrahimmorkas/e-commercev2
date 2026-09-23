import { useEffect, useMemo, useState } from 'react';
import { getLocationTaxBundle } from '../api/lookupApi';

/**
 * Dropdown options for the Store Country / State / City fields, from the same
 * location bundle the Shipping tab uses (only the countries the vendor serves,
 * CompanyMaster.allowedCountries). States narrow to the chosen country and
 * cities to the chosen state.
 *
 * @param {string} countryId - Currently selected store country.
 * @param {string} stateId - Currently selected store state.
 */
export const useStoreLocationOptions = (countryId, stateId) => {
  const [bundle, setBundle] = useState({ countries: [], states: [], cities: [] });

  useEffect(() => {
    let cancelled = false;
    getLocationTaxBundle()
      .then((result) => {
        if (!cancelled && result) setBundle(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const countryOptions = useMemo(
    () => (bundle.countries || []).map((country) => ({ value: String(country._id), label: country.country_name })),
    [bundle]
  );

  const stateOptions = useMemo(() => {
    const group = (bundle.states || []).find((g) => String(g.countryId) === String(countryId));
    return (group?.states || []).map((state) => ({ value: String(state._id), label: state.state_name }));
  }, [bundle, countryId]);

  const cityOptions = useMemo(() => {
    const countryGroup = (bundle.cities || []).find((g) => String(g.countryId) === String(countryId));
    const stateGroup = (countryGroup?.states || []).find((g) => String(g.stateId) === String(stateId));
    return (stateGroup?.cities || []).map((city) => ({ value: String(city._id), label: city.city_name }));
  }, [bundle, countryId, stateId]);

  return { countryOptions, stateOptions, cityOptions };
};

export default useStoreLocationOptions;
