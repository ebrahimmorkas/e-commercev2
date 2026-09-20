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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    // Independent fetches so one failing lookup doesn't blank the others.
    const [settingsRes, categoriesRes, weightsRes, bundleRes] = await Promise.allSettled([
      shippingApi.getShippingPriceSettings(),
      lookupApi.getAdminCategories(),
      lookupApi.getWeights(),
      lookupApi.getLocationTaxBundle(),
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
    stateOptions,
    cityOptions,
  };
};

export default useShippingSettings;
