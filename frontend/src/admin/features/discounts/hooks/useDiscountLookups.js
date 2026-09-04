import { useCallback, useEffect, useMemo, useState } from 'react';
import * as lookupApi from '../api/lookupApi';

/**
 * Loads the reference data the discount form needs: companyMaster (drives
 * which giveDiscountTo / discountType / discount-flow options are gated for
 * this vendor, plus the monthly creation limit) and the PRODUCT/CATEGORY/USER
 * groups usable as productGroupIds/categoryGroupIds/userGroupIds targets.
 */
export const useDiscountLookups = () => {
  const [companyMaster, setCompanyMaster] = useState(null);
  const [productGroups, setProductGroups] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([
      lookupApi.getCompanyMasterData(),
      lookupApi.getGroups('PRODUCT'),
      lookupApi.getGroups('CATEGORY'),
      lookupApi.getGroups('USER'),
    ]);
    const [masterRes, productGroupsRes, categoryGroupsRes, userGroupsRes] = results;

    setCompanyMaster(masterRes.status === 'fulfilled' ? masterRes.value || null : null);
    setProductGroups(productGroupsRes.status === 'fulfilled' ? productGroupsRes.value?.groups || [] : []);
    setCategoryGroups(categoryGroupsRes.status === 'fulfilled' ? categoryGroupsRes.value?.groups || [] : []);
    setUserGroups(userGroupsRes.status === 'fulfilled' ? userGroupsRes.value?.groups || [] : []);

    const failures = results.filter((r) => r.status === 'rejected');
    setError(failures.length > 0 ? failures.map((r) => r.reason?.message).filter(Boolean).join(' ') : '');
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const productGroupOptions = useMemo(
    () => productGroups.map((g) => ({ value: String(g._id), label: g.groupName })),
    [productGroups]
  );
  const categoryGroupOptions = useMemo(
    () => categoryGroups.map((g) => ({ value: String(g._id), label: g.groupName })),
    [categoryGroups]
  );
  const userGroupOptions = useMemo(
    () => userGroups.map((g) => ({ value: String(g._id), label: g.groupName })),
    [userGroups]
  );

  return {
    loading,
    error,
    refetch: fetchAll,
    companyMaster,
    productGroupOptions,
    categoryGroupOptions,
    userGroupOptions,
  };
};

export default useDiscountLookups;
