import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/send-email';

/**
 * What the compose form needs: access/limits, the Company Settings library,
 * user groups, templates to start from, and the {{variables}}.
 */
export const getSendEmailOptions = () => apiRequest(`${BASE}/options`);

/** Store customers (with an email) matching name / email / phone - at most 20. */
export const searchCustomers = (query) => apiRequest(`${BASE}/customers?q=${encodeURIComponent(query || '')}`);

/**
 * Sends the email (in the background - follow it in the history). Always
 * multipart, since uploaded files ride along; arrays use the "name[]" key.
 * @param {Object} fields - subject, htmlBody, textBody, customerIds, groupIds, allCustomers,
 *   externalEmails, includeCompanyCcList, includeCompanyBccList, ccList, bccList,
 *   attachmentIds, imageIds, uploadImageNames
 * @param {{ attachments: File[], images: File[] }} files - images[i] is named uploadImageNames[i]
 */
export const sendEmail = (fields, files = {}) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((item) => formData.append(`${key}[]`, item));
    else formData.append(key, value);
  });
  (files.attachments || []).forEach((file) => formData.append('attachments', file));
  (files.images || []).forEach((file) => formData.append('images', file));
  return apiRequest(`${BASE}/send`, { method: 'POST', body: formData });
};

/** @returns {Promise<{ items: Object[], total: number, page: number, limit: number }>} */
export const getSentEmails = (page = 1, limit = 20) => apiRequest(`${BASE}/history?page=${page}&limit=${limit}`);

export const getSentEmail = (id) => apiRequest(`${BASE}/history/${id}`);

export default { getSendEmailOptions, searchCustomers, sendEmail, getSentEmails, getSentEmail };
