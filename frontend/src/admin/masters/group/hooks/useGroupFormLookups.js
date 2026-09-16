import { useEffect, useState } from 'react';
import * as lookupApi from '../api/lookupApi';

// Resolves a groupType to { value, label } options for the members picker.
// CUSTOM has no backing collection - members are hand-typed ids - so it
// resolves to an empty, non-fetching option list. CATEGORY is handled
// separately below (it needs the raw category docs, not flattened options,
// for CategoryPathPicker's tree drill-down).
const MEMBER_FETCHERS = {
  PRODUCT: async () => {
    const data = await lookupApi.getAdminProducts();
    return (data?.products || []).map((p) => ({ value: p._id, label: p.name }));
  },
  BRAND: async () => {
    const data = await lookupApi.getAdminBrands();
    const brands = Array.isArray(data) ? data : [];
    return brands.map((b) => ({ value: b._id, label: b.brandName }));
  },
  ORDER: async () => {
    const data = await lookupApi.getAdminOrders();
    return (data?.orders || []).map((o) => ({ value: o._id, label: o.orderNumber }));
  },
  USER: async () => {
    const data = await lookupApi.getAdminUsers();
    return (data?.users || []).map((u) => ({ value: u._id, label: `${u.name} (${u.email})` }));
  },
};

/**
 * Loads the reference data the group form needs: companyMaster (drives the
 * numberOfMembersPerGroup client-side cap) and the member option list for
 * whichever groupType is currently selected.
 *
 * @param {string} groupType
 */
export const useGroupFormLookups = (groupType) => {
  const [companyMaster, setCompanyMaster] = useState(null);
  const [memberOptions, setMemberOptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState('');

  useEffect(() => {
    lookupApi
      .getCompanyMasterData()
      .then((data) => setCompanyMaster(data || null))
      .catch(() => setCompanyMaster(null));
  }, []);

  useEffect(() => {
    if (groupType === 'CATEGORY') {
      let cancelled = false;
      setLoadingMembers(true);
      setMembersError('');
      lookupApi
        .getAdminCategories()
        .then((data) => {
          if (!cancelled) setCategories(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          if (!cancelled) {
            setMembersError(err.message || 'Failed to load categories');
            setCategories([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingMembers(false);
        });

      return () => {
        cancelled = true;
      };
    }

    const fetcher = MEMBER_FETCHERS[groupType];
    if (!fetcher) {
      setMemberOptions([]);
      setMembersError('');
      return;
    }

    let cancelled = false;
    setLoadingMembers(true);
    setMembersError('');
    fetcher()
      .then((options) => {
        if (!cancelled) setMemberOptions(options);
      })
      .catch((err) => {
        if (!cancelled) {
          setMembersError(err.message || 'Failed to load members');
          setMemberOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMembers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [groupType]);

  return {
    companyMaster,
    memberOptions,
    categories,
    loadingMembers,
    membersError,
  };
};

export default useGroupFormLookups;
