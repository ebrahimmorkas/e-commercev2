import { apiRequest, apiDownload } from '../../../../utils/apiClient';

const BASE = '/discount';

/**
 * Every non-file field the discount create/update payload can carry, sent as
 * a plain JSON body whenever no excel file is involved - this is important,
 * not just convenient: discountController reads req.body fields directly
 * (unlike /products, which wraps its JSON in a "data" field precisely to
 * dodge this), and discountService does strict `=== true` / `Array.isArray()`
 * checks on them. A multipart/form-data body would flatten every value to a
 * string, silently breaking those checks - so JSON is used whenever possible,
 * and multipart is used only when giveDiscountTo actually requires excelFile.
 *
 * @param {Object} fields
 * @param {File} [excelFile] - required by some giveDiscountTo options (see constants.js)
 */
const buildDiscountFormData = (fields, excelFile) => {
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

export const getAdminDiscounts = () => apiRequest(`${BASE}/`);

export const getDiscountById = (discountId) => apiRequest(`${BASE}/${discountId}`);

export const getActiveDiscounts = () => apiRequest(`${BASE}/storefront/active`, { auth: false });

/**
 * @param {Object} fields
 * @param {File} [excelFile]
 * @returns {Promise<{data: Object, excelReports?: Object}>}
 */
export const addDiscount = (fields, excelFile) =>
  apiRequest(`${BASE}/add-discount`, {
    method: 'POST',
    body: excelFile ? buildDiscountFormData(fields, excelFile) : fields,
  });

export const updateDiscount = (discountId, fields, excelFile) =>
  apiRequest(`${BASE}/${discountId}`, {
    method: 'PUT',
    body: excelFile ? buildDiscountFormData(fields, excelFile) : fields,
  });

export const deleteDiscount = (discountId) => apiRequest(`${BASE}/${discountId}`, { method: 'DELETE' });

/**
 * The sample .xlsx for an excel-based giveDiscountTo option - one file with
 * just the sheet(s) that option reads (Products / Categories / Users).
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadTargetingSampleFile = (giveDiscountTo) =>
  apiDownload(`${BASE}/excel-sample?giveDiscountTo=${encodeURIComponent(giveDiscountTo)}`);

// --- Bulk multi-select actions (checkbox selection in the admin table) ------
// Both return { results, successCount, failureCount } - see
// backend/utils/common.js's runBulkOperation.
// notifyCustomers: only when activating - emails the discounts' customers again.
export const bulkSetDiscountStatus = (discountIds, status, notifyCustomers = false) =>
  apiRequest(`${BASE}/bulk-status`, { method: 'PATCH', body: { discountIds, status, notifyCustomers } });

export const bulkDeleteDiscounts = (discountIds) =>
  apiRequest(`${BASE}/bulk-delete`, { method: 'DELETE', body: { discountIds } });

export default {
  getAdminDiscounts,
  getDiscountById,
  getActiveDiscounts,
  addDiscount,
  updateDiscount,
  deleteDiscount,
  downloadTargetingSampleFile,
  bulkSetDiscountStatus,
  bulkDeleteDiscounts,
};
