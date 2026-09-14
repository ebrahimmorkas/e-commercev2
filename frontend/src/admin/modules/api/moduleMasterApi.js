import { apiRequest } from '../../../utils/apiClient';

const BASE = '/modules';

/**
 * Currently-active modules (code, moduleName, precedence) for the logged-in
 * admin's own vendor - used to decide which sidebar sections to show.
 */
export const getMyAssignedModules = () => apiRequest(`${BASE}/get-my-assigned-modules`);

export default {
  getMyAssignedModules,
};
