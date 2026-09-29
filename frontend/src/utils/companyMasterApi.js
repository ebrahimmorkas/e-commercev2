import { apiRequest } from './apiClient';

/**
 * Fetches the vendor's CompanyMaster and applies the combined rule: every
 * on/off flag reads as (vendor flag AND platform WebsiteMaster flag), using
 * the backend's `featureAccess`. Pages keep reading `companyMaster.isXOn`
 * as before, and now get the effective value. The untouched per-flag
 * values stay available under `featureAccess`.
 */
export const getCompanyMasterData = async () => {
  const data = await apiRequest('/company-master/get-company-master-data');
  return data ? { ...data, ...(data.featureAccess || {}) } : data;
};

export default getCompanyMasterData;
