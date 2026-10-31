import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/users';

/**
 * Fetches all (active + inactive, non-deleted) customers for the current
 * vendor, admin view.
 */
/** @param {'user'|'deliveryAgent'} [role] - customers (default) or the store's delivery agents */
export const getAllUsersAdmin = (role = 'user') => apiRequest(`${BASE}/get-all-users-admin?role=${role}`);

const toQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

/**
 * One page of the Customers list - the backend paginates, searches (name,
 * username, email, phone, WhatsApp), filters and sorts, and adds each
 * customer's orderCount / reviewCount / lastLoginAt.
 * Resolves to { users, pagination: { page, limit, total, totalPages, hasMore }, totalCustomers }.
 *
 * @param {{ page?: number, limit?: number, q?: string, sort?: string, status?: 'A'|'I',
 *   orders?: 'has'|'none', reviews?: 'has'|'none', login?: 'never'|'logged_in',
 *   joinedFrom?: string, joinedTo?: string }} [params] - joinedFrom/joinedTo are ISO date-times
 */
export const listCustomersAdmin = (params) => apiRequest(`${BASE}/list-customers-admin${toQueryString(params)}`);

/** Resolves to { customer: { _id, name }, orders } - every non-deleted order, newest first. */
export const getCustomerOrders = (userId) => apiRequest(`${BASE}/customer-orders-admin/${userId}`);

/** Resolves to { customer: { _id, name }, reviews } - every non-deleted review with its moderation status. */
export const getCustomerReviews = (userId) => apiRequest(`${BASE}/customer-reviews-admin/${userId}`);

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
  listCustomersAdmin,
  getCustomerOrders,
  getCustomerReviews,
  getUserById,
  updateUser,
  changePassword,
  deleteUser,
  bulkSetUserStatus,
  bulkDeleteUsers,
};
