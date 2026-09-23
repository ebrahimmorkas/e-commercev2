import { apiRequest } from '../../utils/apiClient';

/**
 * The shopper's currency and the rate from the store currency - the backend
 * decides from the Country cookie set at login (guests: the store currency).
 * @returns {Promise<{ currency: Object, storeCurrency: Object, exchangeRate: number, isConverted: boolean }>}
 */
export const getCurrencyContext = () => apiRequest('/currency/context');

export default { getCurrencyContext };
