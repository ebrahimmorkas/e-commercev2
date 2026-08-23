import { useCallback, useEffect, useMemo, useState } from 'react';
import * as lookupApi from '../api/lookupApi';

/**
 * Loads every piece of reference data the product form needs (categories,
 * sizes, units, the location+tax bundle, company settings/master flags)
 * once, and derives the dropdown-ready option lists from it. Kept separate
 * from useProducts so the (relatively static) lookup data isn't refetched
 * every time the product list mutates.
 */
export const useProductLookups = () => {
  const [categories, setCategories] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [units, setUnits] = useState([]);
  const [taxBundle, setTaxBundle] = useState({ countries: [], states: [], cities: [], taxes: [] });
  const [companySettings, setCompanySettings] = useState(null);
  const [companyMaster, setCompanyMaster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    // Fetched independently (not Promise.all) so one missing/erroring lookup
    // (e.g. a vendor with no CompanySettings doc yet) doesn't wipe out the
    // others that loaded fine - the form falls back to sane defaults for
    // whichever piece failed (see ProductForm's companySettings/companyMaster
    // fallbacks).
    const results = await Promise.allSettled([
      lookupApi.getAdminCategories(),
      lookupApi.getSizes(),
      lookupApi.getUnits(),
      lookupApi.getLocationTaxBundle(),
      lookupApi.getCompanySettings(),
      lookupApi.getCompanyMasterData(),
    ]);
    const [categoriesRes, sizesRes, unitsRes, bundleRes, settingsRes, masterRes] = results;

    setCategories(categoriesRes.status === 'fulfilled' && Array.isArray(categoriesRes.value) ? categoriesRes.value : []);
    setSizes(sizesRes.status === 'fulfilled' && Array.isArray(sizesRes.value) ? sizesRes.value : []);
    setUnits(unitsRes.status === 'fulfilled' && Array.isArray(unitsRes.value) ? unitsRes.value : []);
    setTaxBundle(bundleRes.status === 'fulfilled' && bundleRes.value ? bundleRes.value : { countries: [], states: [], cities: [], taxes: [] });
    setCompanySettings(settingsRes.status === 'fulfilled' ? settingsRes.value || null : null);
    setCompanyMaster(masterRes.status === 'fulfilled' ? masterRes.value || null : null);

    const failures = results.filter((r) => r.status === 'rejected');
    setError(failures.length > 0 ? failures.map((r) => r.reason?.message).filter(Boolean).join(' ') : '');
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const mainCategoryOptions = useMemo(
    () =>
      categories
        .filter((c) => !c.parent_category_id && c.status === 'A')
        .map((c) => ({ value: String(c._id), label: c.categoryName })),
    [categories]
  );

  const getSubCategoryOptions = useCallback(
    (mainCategoryId) =>
      categories
        .filter((c) => c.parent_category_id && String(c.parent_category_id) === String(mainCategoryId) && c.status === 'A')
        .map((c) => ({ value: String(c._id), label: c.categoryName })),
    [categories]
  );

  const sizeOptions = useMemo(
    () => sizes.map((s) => ({ value: String(s._id), label: `${s.name} (${s.type === 'LABEL' ? 'Label' : 'Measurable'})` })),
    [sizes]
  );

  const getSizeMasterById = useCallback((sizeId) => sizes.find((s) => String(s._id) === String(sizeId)) || null, [sizes]);

  const unitOptions = useMemo(() => units.map((u) => ({ value: String(u._id), label: u.name })), [units]);

  const taxOptions = useMemo(() => {
    const options = [];
    (taxBundle.taxes || []).forEach((countryGroup) => {
      (countryGroup.taxes || []).forEach((tax) => {
        options.push({ value: String(tax._id), label: `${tax.name} — ${countryGroup.country_name}` });
      });
      (countryGroup.states || []).forEach((stateGroup) => {
        (stateGroup.taxes || []).forEach((tax) => {
          options.push({ value: String(tax._id), label: `${tax.name} — ${countryGroup.country_name} / ${stateGroup.state_name}` });
        });
      });
    });
    return options;
  }, [taxBundle]);

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
    loading,
    error,
    refetch: fetchAll,
    categories,
    mainCategoryOptions,
    getSubCategoryOptions,
    sizes,
    sizeOptions,
    getSizeMasterById,
    unitOptions,
    taxOptions,
    countryOptions,
    stateOptions,
    cityOptions,
    companySettings,
    companyMaster,
  };
};

export default useProductLookups;
