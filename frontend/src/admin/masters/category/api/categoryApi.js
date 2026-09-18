import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/category';

/**
 * Fetches all (active + inactive, non-deleted) categories for the current
 * vendor, admin view. Flat list - the UI builds the tree client-side from
 * each category's parent_category_id.
 */
export const getAdminCategories = () => apiRequest(`${BASE}/get-admin-categories`);

/**
 * @param {Object} fields - { categoryName, parent_category_id, status }
 * @param {File} [imageFile] - optional category image
 */
export const addCategory = (fields, imageFile) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  if (imageFile) formData.append('image', imageFile);

  return apiRequest(`${BASE}/add-category`, { method: 'POST', body: formData });
};

/**
 * @param {string} categoryId
 * @param {Object} fields - { categoryName, parent_category_id, status }
 * @param {File} [imageFile] - optional replacement image
 */
export const updateCategory = (categoryId, fields, imageFile) => {
  const formData = new FormData();
  formData.append('category_id', categoryId);
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  if (imageFile) formData.append('image', imageFile);

  return apiRequest(`${BASE}/update-category`, { method: 'PUT', body: formData });
};

/**
 * Soft-deletes a category and all of its descendants.
 * @param {string} categoryId
 */
export const deleteCategory = (categoryId) =>
  apiRequest(`${BASE}/delete-category`, { method: 'DELETE', body: { category_id: categoryId } });

/**
 * @param {File} excelFile - .xlsx describing categoryPath / imagePath / status
 * @param {File} zipFile - .zip containing the images referenced by imagePath
 */
export const bulkUploadCategories = (excelFile, zipFile) => {
  const formData = new FormData();
  formData.append('excelFile', excelFile);
  formData.append('imageZip', zipFile);

  return apiRequest(`${BASE}/bulk-upload-categories`, { method: 'POST', body: formData });
};

// --- Bulk multi-select actions (checkbox selection in the admin table) ------
// Both return { results, successCount, failureCount } - see
// backend/utils/common.js's runBulkOperation. Distinct from bulkUploadCategories
// above (an Excel import), these act on already-existing categories.
export const bulkSetCategoryStatus = (categoryIds, status) =>
  apiRequest(`${BASE}/bulk-status`, { method: 'PATCH', body: { categoryIds, status } });

export const bulkDeleteCategories = (categoryIds) =>
  apiRequest(`${BASE}/bulk-delete`, { method: 'DELETE', body: { categoryIds } });

export default {
  getAdminCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  bulkUploadCategories,
  bulkSetCategoryStatus,
  bulkDeleteCategories,
};
