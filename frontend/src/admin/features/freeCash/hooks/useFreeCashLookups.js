import { useCallback, useEffect, useMemo, useState } from 'react';
import * as lookupApi from '../api/lookupApi';

/**
 * Loads the reference data the Free Cash form needs: companyMaster (drives
 * which giveFreeCashTo options / gating booleans / creation limits apply to
 * this vendor), the categories tree (for the main/sub category targeting
 * options), and the USER-type groups (for the GROUPS targeting option).
 * Mirrors admin/features/discounts/hooks/useDiscountLookups.js.
 */
export const useFreeCashLookups = () => {
  const [companyMaster, setCompanyMaster] = useState(null);
  const [categories, setCategories] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([
      lookupApi.getCompanyMasterData(),
      lookupApi.getAdminCategories(),
      lookupApi.getGroups('USER'),
    ]);
    const [masterRes, categoriesRes, userGroupsRes] = results;

    setCompanyMaster(masterRes.status === 'fulfilled' ? masterRes.value || null : null);
    setCategories(categoriesRes.status === 'fulfilled' && Array.isArray(categoriesRes.value) ? categoriesRes.value : []);
    setUserGroups(userGroupsRes.status === 'fulfilled' ? userGroupsRes.value?.groups || [] : []);

    const failures = results.filter((r) => r.status === 'rejected');
    setError(failures.length > 0 ? failures.map((r) => r.reason?.message).filter(Boolean).join(' ') : '');
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const userGroupOptions = useMemo(
    () => userGroups.map((g) => ({ value: String(g._id), label: g.groupName })),
    [userGroups]
  );

  const mainCategoryOptions = useMemo(
    () =>
      categories
        .filter((c) => !c.parent_category_id && c.status === 'A')
        .map((c) => ({ value: String(c._id), label: c.categoryName })),
    [categories]
  );

  // Sub-category options for a MULTI-select main category picker: any
  // active category whose parent is one of the selected main category ids.
  const getSubCategoryOptions = useCallback(
    (mainCategoryIds) => {
      const mainIdSet = new Set((mainCategoryIds || []).map(String));
      return categories
        .filter((c) => c.parent_category_id && mainIdSet.has(String(c.parent_category_id)) && c.status === 'A')
        .map((c) => ({ value: String(c._id), label: c.categoryName }));
    },
    [categories]
  );

  return {
    loading,
    error,
    refetch: fetchAll,
    companyMaster,
    categories,
    mainCategoryOptions,
    getSubCategoryOptions,
    userGroupOptions,
  };
};

export default useFreeCashLookups;
