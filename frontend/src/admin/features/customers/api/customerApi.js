import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/users';

/**
 * Fetches all (active + inactive, non-deleted) customers for the current
 * vendor, admin view.
 */
export const getAllUsersAdmin = () => apiRequest(`${BASE}/get-all-users-admin`);

export const getUserById = (userId) => apiRequest(`${BASE}/get-user-admin/${userId}`);

/**
 * @param {string} userId
 * @param {Object} data - { name, username, email, phone_no, whatsapp_no, country, state, city }
 */
export const updateUser = (userId, data) =>
  apiRequest(`${BASE}/update-user-admin/${userId}`, { method: 'PATCH', body: data });

export const changePassword = (userId, newPassword) =>
  apiRequest(`${BASE}/change-password-admin/${userId}`, { method: 'PATCH', body: { newPassword } });

export const deleteUser = (userId) => apiRequest(`${BASE}/delete-user-admin/${userId}`, { method: 'DELETE' });

// --- Bulk multi-select actions (checkbox selection in the admin table) ------
// Both return { results, successCount, failureCount } - see
// backend/utils/common.js's runBulkOperation.
export const bulkSetUserStatus = (userIds, status) =>
  apiRequest(`${BASE}/bulk-status`, { method: 'PATCH', body: { userIds, status } });

export const bulkDeleteUsers = (userIds) => apiRequest(`${BASE}/bulk-delete`, { method: 'DELETE', body: { userIds } });

export default {
  getAllUsersAdmin,
  getUserById,
  updateUser,
  changePassword,
  deleteUser,
  bulkSetUserStatus,
  bulkDeleteUsers,
};
