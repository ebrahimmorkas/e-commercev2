import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/inventory';

// Drops empty values so the URL only carries what was actually set.
const toQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

/**
 * One page of the vendor's stock - one row per product size.
 *
 * @param {{ page?: number, limit?: number, search?: string,
 *   stockFilter?: 'ALL'|'IN_STOCK'|'LOW_STOCK'|'OUT_OF_STOCK',
 *   sort?: 'NAME'|'STOCK_LOW_TO_HIGH'|'STOCK_HIGH_TO_LOW' }} [params]
 * @returns {Promise<{ items: Object[], pagination: Object, summary: Object, lowStock: Object }>}
 */
export const getInventory = (params) => apiRequest(`${BASE}/get-inventory${toQueryString(params)}`);

/**
 * Stock history, newest first. `sizeId` narrows it to one product size.
 *
 * @param {{ page?: number, limit?: number, search?: string, sizeId?: string,
 *   type?: 'INITIAL'|'INCREASE'|'DEDUCT' }} [params]
 * @returns {Promise<{ logs: Object[], pagination: Object }>}
 */
export const getInventoryLogs = (params) => apiRequest(`${BASE}/get-inventory-logs${toQueryString(params)}`);

/**
 * Adds to / takes off the stock of one product size.
 *
 * @param {{ productId: string, variantId: string, sizeId: string,
 *   operation: 'INCREASE'|'DEDUCT', quantity: number, remark?: string }} data
 */
export const adjustStock = (data) => apiRequest(`${BASE}/adjust-stock`, { method: 'PATCH', body: data });

/**
 * Adds / takes off the same quantity on every selected product size.
 * Returns { results, successCount, failureCount }.
 *
 * @param {{ items: Array<{ productId: string, variantId: string, sizeId: string }>,
 *   operation: 'INCREASE'|'DEDUCT', quantity: number, remark?: string }} data
 */
export const bulkAdjustStock = (data) => apiRequest(`${BASE}/bulk-adjust-stock`, { method: 'PATCH', body: data });

export default {
  getInventory,
  getInventoryLogs,
  adjustStock,
  bulkAdjustStock,
};
