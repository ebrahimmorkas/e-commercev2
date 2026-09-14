import { apiRequest } from '../../../../utils/apiClient';

export const getStorefrontBanners = () => apiRequest('/banners/get-all-banner', { auth: false });

export default { getStorefrontBanners };
