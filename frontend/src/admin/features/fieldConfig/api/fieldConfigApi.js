import { apiRequest } from '../../../../utils/apiClient';

// The vendor's field configuration per entity (hidden fields, renamed labels,
// custom fields) - see backend constants/fieldConfigConstants.js. Read-only:
// it is set with backend/scripts/manageVendorFieldConfig.js.
export const getFieldConfigAdmin = () => apiRequest('/field-config/get-field-config-admin');
