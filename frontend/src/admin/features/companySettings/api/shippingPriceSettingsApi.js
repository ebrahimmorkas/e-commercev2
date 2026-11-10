import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/shipping-price-settings';

/**
 * The vendor's single ShippingPriceSettings document. Rejects with a 404
 * ApiError when none exists yet - callers treat that as "not configured".
 */
export const getShippingPriceSettings = () => apiRequest(`${BASE}/get-shipping-price-settings`);

/**
 * The currencies prices are typed in that aren't tied to a country -
 * { storeCurrencyCode, otherCountriesCurrencyCode } (see the backend's
 * shippingPriceSettingsService.fetchShippingPriceCurrencies).
 */
export const getShippingPriceCurrencies = () => apiRequest(`${BASE}/get-shipping-price-currencies`);

export const createShippingPriceSettings = (payload) =>
  apiRequest(`${BASE}/create-shipping-price-settings`, { method: 'POST', body: payload });

export const updateShippingPriceSettings = (payload) =>
  apiRequest(`${BASE}/update-shipping-price-settings`, { method: 'PUT', body: payload });

export default {
  getShippingPriceSettings,
  getShippingPriceCurrencies,
  createShippingPriceSettings,
  updateShippingPriceSettings,
};
