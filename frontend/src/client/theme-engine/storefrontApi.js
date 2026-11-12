import { apiRequest } from '../../utils/apiClient';

/** The vendor's published storefront config (theme, tokens, home sections). Public. */
export const getStorefrontConfig = () => apiRequest('/storefront/config', { auth: false });
