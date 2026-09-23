import { useEffect, useMemo, useState } from 'react';
import { getLocationTaxBundle, getCurrencies } from '../api/lookupApi';

/**
 * Dropdown options for the Store Currency and Store Country / State / City fields - locations from the same
 * location bundle the Shipping tab uses (only the countries the vendor serves,
 * CompanyMaster.allowedCountries). States narrow to the chosen country and
 * cities to the chosen state.
 *
 * @param {string} countryId - Currently selected store country.
 * @param {string} stateId - Currently selected store state.
 */
export const useStoreLocationOptions = (countryId, stateId) => {
  const [bundle, setBundle] = useState({ countries: [], states: [], cities: [] });
  const [currencies, setCurrencies] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getLocationTaxBundle()
      .then((result) => {
        if (!cancelled && result) setBundle(result);
      })
      .catch(() => {});
    getCurrencies()
      .then((result) => {
        if (!cancelled) setCurrencies(result?.currencies || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const currencyOptions = useMemo(
    () => currencies.map((currency) => ({ value: String(currency._id), label: `${currency.name} (${currency.code}, ${currency.symbol})` })),
    [currencies]
  );

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

  return { countryOptions, stateOptions, cityOptions, currencyOptions };
};

export default useStoreLocationOptions;
