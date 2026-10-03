import { useEffect, useState } from 'react';
import * as lookupApi from '../api/lookupApi';

// Only active ('A') records can be added to a group; a record without a
// status (older data) counts as active.
const isActiveRecord = (record) => (record?.status ?? 'A') === 'A';

// Resolves a groupType to { value, label, isActive } options for the members
// picker - inactive ones are kept only so a group's existing members still
// show by name (MembersPicker never offers them for picking).
// CUSTOM has no backing collection - members are hand-typed ids - so it
// resolves to an empty, non-fetching option list. CATEGORY is handled
// separately below (it needs the raw category docs, not flattened options,
// for CategoryPathPicker's tree drill-down). PRODUCT isn't listed either:
// a catalogue can run to tens of thousands of products, so GroupForm
// searches them on the server as the admin types (useProductOptionsSearch).
const MEMBER_FETCHERS = {
  BRAND: async () => {
    const data = await lookupApi.getAdminBrands();
    const brands = Array.isArray(data) ? data : [];
    return brands.map((b) => ({ value: b._id, label: b.brandName, isActive: isActiveRecord(b) }));
  },
  ORDER: async () => {
    const data = await lookupApi.getAdminOrders();
    return (data?.orders || []).map((o) => ({ value: o._id, label: o.orderNumber, isActive: isActiveRecord(o) }));
  },
  USER: async () => {
    const data = await lookupApi.getAdminUsers();
    const users = Array.isArray(data) ? data : [];
    return users.map((u) => ({ value: u._id, label: `${u.name} (${u.email})`, isActive: isActiveRecord(u) }));
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
