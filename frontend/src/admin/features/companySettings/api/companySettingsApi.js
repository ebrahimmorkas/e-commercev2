import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/company-settings';

/**
 * Fetches the current vendor's full CompanySettings document (bank details,
 * admin contact info, TRN/invoice settings, email config, ...). Rejects with
 * a 404 ApiError when the vendor hasn't created one yet - callers should
 * treat that as "show the create form", not as an error to surface.
 *
 * Uses the -admin endpoint (authenticated): the plain get-company-settings
 * route is public/unauthenticated for the storefront and only returns a
 * filtered subset of fields - see backend/controllers/companySettingsController.js.
 */
export const getCompanySettings = () => apiRequest(`${BASE}/get-company-settings-admin`);

/**
 * The order workflow the platform assigned to this store - what the order step
 * settings (cancellation cutoff, payment step, delivery agent step change) can be set to.
 * @returns {Promise<{ steps: Array<{ code: string, name: string, sequence: number }>, lastStepCode: string|null, isDeliveryAgentAccessOn: boolean }>}
 */
export const getAssignedOrderSteps = () => apiRequest(`${BASE}/order-steps`);

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
// Lists that can be emptied: an empty one is sent as a single '' (which the
// backend drops), otherwise it would be omitted and never cleared.
const CLEARABLE_LISTS = ['ccList', 'bccList'];

const buildFormData = (fields, files = {}) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      if (value.length === 0 && CLEARABLE_LISTS.includes(key)) formData.append(`${key}[]`, '');
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

// --- Email tab: attachments and images ------------------------------------
// Saved immediately (not through create/update). Each returns the current
// { emailAttachments, emailImages } lists.

/**
 * @param {File} file
 * @param {string} displayName - the file name customers see (optional)
 */
export const addEmailAttachment = (file, displayName = '') => {
  const formData = new FormData();
  formData.append('file', file);
  if (displayName) formData.append('displayName', displayName);
  return apiRequest(`${BASE}/email-attachments`, { method: 'POST', body: formData });
};

export const removeEmailAttachment = (attachmentId) =>
  apiRequest(`${BASE}/email-attachments/${attachmentId}`, { method: 'DELETE' });

/**
 * @param {File} file
 * @param {string} name - short name a template uses to place it, e.g. "logo" for {{image:logo}}
 */
export const addEmailImage = (file, name) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  return apiRequest(`${BASE}/email-images`, { method: 'POST', body: formData });
};

export const removeEmailImage = (imageId) => apiRequest(`${BASE}/email-images/${imageId}`, { method: 'DELETE' });

/**
 * The vendor's own email account (every email of the store is sent through it).
 * The password is never returned - only hasPassword.
 * @returns {Promise<{ emailAccount: Object|null }>}
 */
export const getEmailAccount = () => apiRequest(`${BASE}/email-account`);

/**
 * Signs in to the email server first and saves only if that works. Leave
 * password out to keep the saved one.
 * @returns {Promise<{ emailAccount: Object }>}
 */
export const saveEmailAccount = (fields) => apiRequest(`${BASE}/email-account`, { method: 'PUT', body: fields });

export const removeEmailAccount = () => apiRequest(`${BASE}/email-account`, { method: 'DELETE' });

/** Sends a test email through the saved account - to `to`, or the account's own address when empty. */
export const sendTestEmail = (to) => apiRequest(`${BASE}/email-account/test`, { method: 'POST', body: to ? { to } : {} });

export default {
  getCompanySettings,
  getAssignedOrderSteps,
  createCompanySettings,
  updateCompanySettings,
  addEmailAttachment,
  removeEmailAttachment,
  addEmailImage,
  removeEmailImage,
  getEmailAccount,
  saveEmailAccount,
  removeEmailAccount,
  sendTestEmail,
};
