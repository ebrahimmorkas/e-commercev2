import { apiRequest, apiDownload } from '../../../../utils/apiClient';

const BASE = '/free-cash';

/**
 * JSON, or multipart/form-data when an excel file is attached (the server's
 * Joi validation converts the multipart strings back to real types). A null
 * is sent as an empty string ("no per-order limit") rather than dropped.
 *
 * @param {Object} fields
 * @param {File} [excelFile] - required only when giveFreeCashTo === 'SPECIFIC_USERS'
 */
const buildFreeCashFormData = (fields, excelFile) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value === null) {
      formData.append(key, '');
      return;
    }
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

/**
 * The sample .xlsx for the Specific Users option (a "Users" sheet with its "Email" heading).
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadUsersSampleFile = () => apiDownload(`${BASE}/excel-sample`);

export const deleteFreeCash = (freeCashId) => apiRequest(`${BASE}/${freeCashId}`, { method: 'DELETE' });

/** Revokes one customer's unused balance - the customer is picked by email. */
export const revokeFreeCashForUser = (email, freeCashId) =>
  apiRequest(`${BASE}/revoke/user`, { method: 'POST', body: { email, freeCashId } });

export const revokeFreeCashForAllUsers = (freeCashId) =>
  apiRequest(`${BASE}/revoke/all-users`, { method: 'POST', body: { freeCashId } });

// --- Bulk multi-select actions (checkbox selection in the admin table) ------
// Both return { results, successCount, failureCount } - see
// backend/utils/common.js's runBulkOperation.
// notifyCustomers: only when activating - emails the campaigns' customers again.
export const bulkSetFreeCashStatus = (freeCashIds, status, notifyCustomers = false) =>
  apiRequest(`${BASE}/bulk-status`, { method: 'PATCH', body: { freeCashIds, status, notifyCustomers } });

export const bulkDeleteFreeCash = (freeCashIds) =>
  apiRequest(`${BASE}/bulk-delete`, { method: 'DELETE', body: { freeCashIds } });

export default {
  getAdminFreeCash,
  getFreeCashById,
  addFreeCash,
  updateFreeCash,
  deleteFreeCash,
  downloadUsersSampleFile,
  revokeFreeCashForUser,
  revokeFreeCashForAllUsers,
  bulkSetFreeCashStatus,
  bulkDeleteFreeCash,
};
