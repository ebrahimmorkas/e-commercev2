import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/free-cash';

/**
 * Same "JSON when possible, multipart only when an excel file is involved"
 * convention as admin/features/discounts/api/discountApi.js - freeCashController
 * reads req.body fields directly and freeCashService does strict `=== true` /
 * `Array.isArray()` checks on them, so a multipart body (which flattens every
 * value to a string) is only used when giveFreeCashTo actually requires excelFile.
 *
 * @param {Object} fields
 * @param {File} [excelFile] - required only when giveFreeCashTo === 'SPECIFIC_USERS'
 */
const buildFreeCashFormData = (fields, excelFile) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      // append-field (multer's body parser) only guarantees array output for
      // a repeated field when the key ends in "[]" - a bare repeated key
      // collapses to a scalar if only one item is sent.
      value.forEach((item) => formData.append(`${key}[]`, item));
    } else {
      formData.append(key, value);
    }
  });
  if (excelFile) formData.append('excelFile', excelFile);
  return formData;
};

export const getAdminFreeCash = () => apiRequest(`${BASE}/`);

export const getFreeCashById = (freeCashId) => apiRequest(`${BASE}/${freeCashId}`);

/**
 * @param {Object} fields
 * @param {File} [excelFile]
 * @returns {Promise<{data: Object, excelReports?: Object, issuedCount?: number}>}
 */
export const addFreeCash = (fields, excelFile) =>
  apiRequest(`${BASE}/`, {
    method: 'POST',
    body: excelFile ? buildFreeCashFormData(fields, excelFile) : fields,
  });

export const updateFreeCash = (freeCashId, fields, excelFile) =>
  apiRequest(`${BASE}/${freeCashId}`, {
    method: 'PUT',
    body: excelFile ? buildFreeCashFormData(fields, excelFile) : fields,
  });

export const deleteFreeCash = (freeCashId) => apiRequest(`${BASE}/${freeCashId}`, { method: 'DELETE' });

export const revokeFreeCashForUser = (userId, freeCashId) =>
  apiRequest(`${BASE}/revoke/user`, { method: 'POST', body: { userId, freeCashId } });

export const revokeFreeCashForAllUsers = (freeCashId) =>
  apiRequest(`${BASE}/revoke/all-users`, { method: 'POST', body: { freeCashId } });

export default {
  getAdminFreeCash,
  getFreeCashById,
  addFreeCash,
  updateFreeCash,
  deleteFreeCash,
  revokeFreeCashForUser,
  revokeFreeCashForAllUsers,
};
