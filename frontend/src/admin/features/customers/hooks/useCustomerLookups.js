import { useCallback, useEffect, useMemo, useState } from 'react';
import * as lookupApi from '../api/lookupApi';

/**
 * Loads companyMaster (drives isAdminAddingUserFeatureAllowed /
 * isPasswordChangeFeatureByAdminAllowed) and the location-tax bundle (drives
 * the Edit Customer form's cascading Country -> State -> City dropdowns,
 * restricted to this vendor's CompanyMaster.allowedCountries). Mirrors
 * admin/features/addUser/hooks/useAddUserLookups.js.
 */
export const useCustomerLookups = () => {
  const [companyMaster, setCompanyMaster] = useState(null);
  const [locationBundle, setLocationBundle] = useState({ countries: [], states: [], cities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([
      lookupApi.getCompanyMasterData(),
      lookupApi.getLocationTaxBundle(),
    ]);
    const [masterRes, bundleRes] = results;

    setCompanyMaster(masterRes.status === 'fulfilled' ? masterRes.value || null : null);
    setLocationBundle(
      bundleRes.status === 'fulfilled' && bundleRes.value
        ? bundleRes.value
        : { countries: [], states: [], cities: [] }
    );

    const failures = results.filter((r) => r.status === 'rejected');
    setError(failures.length > 0 ? failures.map((r) => r.reason?.message).filter(Boolean).join(' ') : '');
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const countryOptions = useMemo(
    () => (locationBundle.countries || []).map((c) => ({ value: String(c._id), label: c.country_name })),
    [locationBundle]
  );

  // locationBundle.states is grouped [{ countryId, states: [{_id, state_name}] }] -
  // find the group for the selected country and map its states.
  const getStateOptions = useCallback(
    (countryId) => {
      if (!countryId) return [];
      const group = (locationBundle.states || []).find((g) => String(g.countryId) === String(countryId));
      return (group?.states || []).map((s) => ({ value: String(s._id), label: s.state_name }));
    },
    [locationBundle]
  );

  // locationBundle.cities is nested [{ countryId, states: [{ stateId, cities: [{_id, city_name}] }] }] -
  // find the country group, then the state entry within it, then map its cities.
  const getCityOptions = useCallback(
    (countryId, stateId) => {
      if (!countryId || !stateId) return [];
      const countryGroup = (locationBundle.cities || []).find((g) => String(g.countryId) === String(countryId));
      const stateGroup = (countryGroup?.states || []).find((s) => String(s.stateId) === String(stateId));
      return (stateGroup?.cities || []).map((c) => ({ value: String(c._id), label: c.city_name }));
    },
    [locationBundle]
  );

  return {
    loading,
    error,
    refetch: fetchAll,
    companyMaster,
    countryOptions,
    getStateOptions,
    getCityOptions,
  };
};

export default useCustomerLookups;
