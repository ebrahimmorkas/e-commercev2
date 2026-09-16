import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/groups';

/**
 * Same "JSON when possible, multipart only when an excel file is involved"
 * convention as admin/features/freeCash/api/freeCashApi.js and
 * admin/features/discounts/api/discountApi.js.
 *
 * @param {Object} fields
 * @param {File} [excelFile]
 */
const buildGroupFormData = (fields, excelFile) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(`${key}[]`, item));
    } else {
      formData.append(key, value);
    }
  });
  if (excelFile) formData.append('excelFile', excelFile);
  return formData;
};

/**
 * @param {'PRODUCT'|'CATEGORY'|'USER'|'BRAND'|'ORDER'|'CUSTOM'} [groupType] - optional filter
 */
export const getAllGroups = (groupType) =>
  apiRequest(`${BASE}${groupType ? `?groupType=${groupType}` : ''}`);

export const getGroupById = (groupId) => apiRequest(`${BASE}/${groupId}`);

/**
 * @param {Object} data - { groupType, groupName, slug, description, members, precedence, remarks }
 *   `members` is omitted when `excelFile` is provided - the server resolves
 *   members from the excel file's rows instead.
 * @param {File} [excelFile]
 * @returns {Promise<{group: Object, excelReport?: Object}>}
 */
export const addGroup = (data, excelFile) =>
  apiRequest(`${BASE}/`, {
    method: 'POST',
    body: excelFile ? buildGroupFormData(data, excelFile) : data,
  });

/**
 * @param {Object} data - { id, ...fields to update }
 * @param {File} [excelFile]
 */
export const updateGroup = (data, excelFile) =>
  apiRequest(`${BASE}/`, {
    method: 'PUT',
    body: excelFile ? buildGroupFormData(data, excelFile) : data,
  });

export const deleteGroup = (groupId) => apiRequest(`${BASE}/`, { method: 'DELETE', body: { id: groupId } });

export const activateGroup = (groupId) => apiRequest(`${BASE}/activate`, { method: 'PATCH', body: { id: groupId } });

export const deactivateGroup = (groupId) => apiRequest(`${BASE}/deactivate`, { method: 'PATCH', body: { id: groupId } });

export default {
  getAllGroups,
  getGroupById,
  addGroup,
  updateGroup,
  deleteGroup,
  activateGroup,
  deactivateGroup,
};
