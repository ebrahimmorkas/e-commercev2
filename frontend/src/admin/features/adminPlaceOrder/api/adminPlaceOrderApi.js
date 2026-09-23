import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/admin-place-order';

const toQuery = (params) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

/** Options for the "search user by" dropdown - [{ key, label }]. */
export const getUserSearchFields = () => apiRequest(`${BASE}/user-search-fields`);

/**
 * Values for the second dropdown - [{ userId, value, name }].
 * @param {{ searchField: string, search?: string, limit?: number }} params
 */
export const getUsers = (params) => apiRequest(`${BASE}/users${toQuery(params)}`);

export const getUserAddresses = (userId) => apiRequest(`${BASE}/users/${userId}/addresses`);

/** Every active category (flat) - the shape CategoryPathPicker expects. */
export const getCategories = () => apiRequest(`${BASE}/categories`);

/** Active products, narrowed to a category (and everything beneath it). */
export const getProducts = (categoryId) => apiRequest(`${BASE}/products${toQuery({ categoryId })}`);

/** { product, allowOutOfStockProductsAdding, variants: [{ variantId, variantName, sizes: [...] }] } */
export const getProductOptions = (productId) => apiRequest(`${BASE}/products/${productId}/options`);

/**
 * @param {Object} data - { userId, items: [{ productId, variantId, sizeId, quantity }],
 *   addressId?, addressText?, shippingAmount, discountAmount, remarks?, orderNumber? }
 */
export const placeOrder = (data) => apiRequest(`${BASE}/place-order`, { method: 'POST', body: data });

/**
 * The currency the order will be in: the customer's (userId) or, without one, a walk-in's store currency.
 * @param {string} [userId]
 * @returns {Promise<{ currency: Object, storeCurrency: Object, exchangeRate: number, isConverted: boolean }>}
 */
export const getOrderCurrency = (userId) => apiRequest(`${BASE}/currency${toQuery({ userId })}`);

/**
 * Live tax preview - nothing is saved.
 * @param {Object} data - { isWalkInCustomer, userId?, addressId?, applyTax?, applyBulkPricing, items }
 * @returns {Promise<{ lines, taxes, totalTaxAmount, isTaxOff, isStoreLocation, isLocationMissing }>}
 */
export const previewTax = (data) => apiRequest(`${BASE}/tax-preview`, { method: 'POST', body: data });

export const getCompanyMasterData = () => apiRequest('/company-master/get-company-master-data');

export default {
  getUserSearchFields,
  getUsers,
  getUserAddresses,
  getCategories,
  getProducts,
  getProductOptions,
  placeOrder,
  previewTax,
  getOrderCurrency,
  getCompanyMasterData,
};
