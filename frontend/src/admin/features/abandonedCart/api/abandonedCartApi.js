import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/abandoned-cart';

/**
 * Fetches every currently-abandoned cart for the current vendor, admin view.
 */
export const getAllAbandonedCartsAdmin = () => apiRequest(BASE);

export default {
  getAllAbandonedCartsAdmin,
};
