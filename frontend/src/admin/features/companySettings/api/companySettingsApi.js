import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/company-settings';

/**
 * Fetches the current vendor's CompanySettings document. Rejects with a 404
 * ApiError when the vendor hasn't created one yet - callers should treat that
 * as "show the create form", not as an error to surface.
 */
export const getCompanySettings = () => apiRequest(`${BASE}/get-company-settings`);

/**
 * create/update both always go through the multipart-form fields declared on
 * the route (companyLogo/paymentScanner/partnerCertificate), so every field -
 * including plain text/boolean/number ones - is sent as multipart/form-data,
 * never JSON.
 *
 * append-field (multer's body parser) only guarantees array output for a
 * repeated field when the key ends in "[]" - same convention as
 * discountApi.js. An empty array is sent as nothing at all (the key is
 * omitted), which means it's not currently possible to clear ccList/bccList
 * back down to empty through this form - only to add/replace entries.
 *
 * @param {Object} fields - plain field values (string/boolean/number/array)
 * @param {Object} files - { companyLogo?: File, paymentScanner?: File, partnerCertificate?: File }
 */
const buildFormData = (fields, files = {}) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(`${key}[]`, item));
    } else if (value === null) {
      formData.append(key, '');
    } else {
      formData.append(key, value);
    }
  });
  if (files.companyLogo) formData.append('companyLogo', files.companyLogo);
  if (files.paymentScanner) formData.append('paymentScanner', files.paymentScanner);
  if (files.partnerCertificate) formData.append('partnerCertificate', files.partnerCertificate);
  return formData;
};

/**
 * @param {Object} fields
 * @param {Object} files
 */
export const createCompanySettings = (fields, files = {}) =>
  apiRequest(`${BASE}/create-company-settings`, { method: 'POST', body: buildFormData(fields, files) });

/**
 * @param {Object} fields
 * @param {Object} files
 */
export const updateCompanySettings = (fields, files = {}) =>
  apiRequest(`${BASE}/update-company-settings`, { method: 'PUT', body: buildFormData(fields, files) });

export default {
  getCompanySettings,
  createCompanySettings,
  updateCompanySettings,
};
