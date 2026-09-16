import { apiRequest } from '../../../../utils/apiClient';

/**
 * CompanyMaster entitlement flags this page needs - whether the Bank
 * Transfer group (showPaymentQRCodeAndBankDetails) and the Partner
 * Certificate upload (isShowingPartnerCertificateFeatureOn) should be shown
 * at all. Same "only the CompanyMaster half of the gate, not WebsiteMaster's"
 * limitation already accepted in banners/api/lookupApi.js - the real
 * entitlement check still happens server-side on save.
 */
export const getCompanyMasterData = () => apiRequest('/company-master/get-company-master-data');

export default {
  getCompanyMasterData,
};
