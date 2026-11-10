import { useCallback, useEffect, useMemo, useState } from 'react';
import * as shippingApi from '../api/shippingPriceSettingsApi';
import * as lookupApi from '../api/lookupApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the vendor's ShippingPriceSettings singleton for the Shipping tab: the
 * settings document itself (create vs update picked automatically), plus the
 * reference data its rule pickers need (categories, weight units the vendor
 * is assigned, countries/states/cities the vendor serves).
 *
 * @param {Object|null} companyMaster - CompanyMaster flags (allowedWeights).
 */
export const useShippingSettings = (companyMaster) => {
  const [settings, setSettings] = useState(null);
  const [exists, setExists] = useState(false);
  const [categories, setCategories] = useState([]);
  const [weights, setWeights] = useState([]);
  const [taxBundle, setTaxBundle] = useState({ countries: [], states: [], cities: [] });
  const [currencies, setCurrencies] = useState([]);
  const [priceCurrencies, setPriceCurrencies] = useState({ storeCurrencyCode: null, otherCountriesCurrencyCode: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    // Independent fetches so one failing lookup doesn't blank the others.
    const [settingsRes, categoriesRes, weightsRes, bundleRes, currenciesRes, priceCurrenciesRes] = await Promise.allSettled([
      shippingApi.getShippingPriceSettings(),
      lookupApi.getAdminCategories(),
      lookupApi.getWeights(),
      lookupApi.getLocationTaxBundle(),
      lookupApi.getCurrencies(),
      shippingApi.getShippingPriceCurrencies(),
    ]);

    if (settingsRes.status === 'fulfilled') {
      setSettings(settingsRes.value);
      setExists(true);
    } else if (settingsRes.reason?.statusCode === 404) {
      setSettings(null);
      setExists(false);
    } else {
      setError(settingsRes.reason?.message || 'Failed to load shipping settings');
    }

    setCategories(categoriesRes.status === 'fulfilled' && Array.isArray(categoriesRes.value) ? categoriesRes.value : []);
    setWeights(weightsRes.status === 'fulfilled' && Array.isArray(weightsRes.value) ? weightsRes.value : []);
    setTaxBundle(bundleRes.status === 'fulfilled' && bundleRes.value ? bundleRes.value : { countries: [], states: [], cities: [] });
    setCurrencies(currenciesRes.status === 'fulfilled' && Array.isArray(currenciesRes.value?.currencies) ? currenciesRes.value.currencies : []);
    setPriceCurrencies(priceCurrenciesRes.status === 'fulfilled' && priceCurrenciesRes.value
      ? priceCurrenciesRes.value
      : { storeCurrencyCode: null, otherCountriesCurrencyCode: null });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const save = async (payload) => {
    setSaving(true);
    try {
      const result = exists
        ? await shippingApi.updateShippingPriceSettings(payload)
        : await shippingApi.createShippingPriceSettings(payload);
      setSettings(result);
      setExists(true);
      toast.success(exists ? 'Shipping settings updated successfully' : 'Shipping settings created successfully');
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to save shipping settings');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = useMemo(() => {
    const byId = new Map(categories.map((c) => [String(c._id), c]));
    return categories
      .filter((c) => c.status === 'A')
      .map((c) => {
        const parent = c.parent_category_id ? byId.get(String(c.parent_category_id)) : null;
        return { value: String(c._id), label: parent ? `${parent.categoryName} > ${c.categoryName}` : c.categoryName };
      });
  }, [categories]);

  // Only weight units assigned to this vendor may be used (the backend rejects any other).
  const weightOptions = useMemo(() => {
    const allowed = new Set((companyMaster?.allowedWeights || []).map(String));
    return weights
      .filter((w) => allowed.has(String(w._id)))
      .map((w) => ({ value: String(w._id), label: `${w.weightName} (${w.symbol})` }));
  }, [weights, companyMaster]);

  const countryOptions = useMemo(
    () => (taxBundle.countries || []).map((c) => ({ value: String(c._id), label: c.country_name })),
    [taxBundle]
  );

  // Every country the vendor serves, with the currency its free-shipping
  // amount is entered in (currencyCode null = no currency set up yet).
  const freeAboveCountries = useMemo(() => {
    const codeById = new Map(currencies.map((c) => [String(c._id), c.code]));
    return (taxBundle.countries || []).map((c) => ({
      value: String(c._id),
      label: c.country_name,
      currencyCode: c.currency_id ? codeById.get(String(c.currency_id)) || null : null,
    }));
  }, [taxBundle, currencies]);

  // The currency a country/state/city shipping price is typed in: its
  // country's currency, else the store currency (same rule as the backend).
  const currencyByLocation = useMemo(() => {
    const byCountry = new Map(freeAboveCountries.map((c) => [c.value, c.currencyCode]));
    const byState = new Map();
    (taxBundle.states || []).forEach((group) => {
      (group.states || []).forEach((state) => byState.set(String(state._id), byCountry.get(String(group.countryId)) || null));
    });
    const byCity = new Map();
    (taxBundle.cities || []).forEach((group) => {
      (group.states || []).forEach((stateGroup) => {
        (stateGroup.cities || []).forEach((city) => byCity.set(String(city._id), byCountry.get(String(group.countryId)) || null));
      });
    });
    return { COUNTRY: byCountry, STATE: byState, CITY: byCity };
  }, [freeAboveCountries, taxBundle]);

  /** Currency code for a COUNTRY/STATE/CITY rule row's price (null until a place is picked). */
  const ruleCurrencyCode = useCallback(
    (method, placeId) => {
      if (!placeId) return null;
      return currencyByLocation[method]?.get(String(placeId)) || priceCurrencies.storeCurrencyCode;
    },
    [currencyByLocation, priceCurrencies]
  );

  const stateOptions = useMemo(() => {
    const options = [];
    (taxBundle.states || []).forEach((countryGroup) => {
      (countryGroup.states || []).forEach((state) => {
        options.push({ value: String(state._id), label: `${state.state_name} (${countryGroup.country_name})` });
      });
    });
    return options;
  }, [taxBundle]);

  const cityOptions = useMemo(() => {
    const options = [];
    (taxBundle.cities || []).forEach((countryGroup) => {
      (countryGroup.states || []).forEach((stateGroup) => {
        (stateGroup.cities || []).forEach((city) => {
          options.push({ value: String(city._id), label: `${city.city_name} (${stateGroup.state_name}, ${countryGroup.country_name})` });
        });
      });
    });
    return options;
  }, [taxBundle]);

  return {
    settings,
    exists,
    loading,
    error,
    saving,
    save,
    refetch: fetchAll,
    categoryOptions,
    weightOptions,
    countryOptions,
    freeAboveCountries,
    ruleCurrencyCode,
    storeCurrencyCode: priceCurrencies.storeCurrencyCode,
    otherCountriesCurrencyCode: priceCurrencies.otherCountriesCurrencyCode,
    stateOptions,
    cityOptions,
  };
};

export default useShippingSettings;
