import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/email-templates';
// Template <-> module assignment lives on CompanySettings, not on the template.
const COMPANY_SETTINGS_BASE = '/company-settings';

/**
 * Admin list (active + inactive).
 * @returns {Promise<{templates: Object[], assignments: {module: string, templateId: string}[], templateCount: number, numberOfTemplatesAllowed: number|null}>}
 */
export const getAllTemplates = () => apiRequest(`${BASE}/get-all-templates`);

export const getTemplateById = (templateId) => apiRequest(`${BASE}/get-template/${templateId}`);

/**
 * Merge tokens ({{key}}) available when authoring a template for `module`.
 * @returns {Promise<{key: string, description: string}[]>}
 */
export const getAvailableVariables = (module) => apiRequest(`${BASE}/variables/${module}`);

/**
 * @param {Object} data - { templateName, module, subject, htmlBody, textBody }
 */
export const addTemplate = (data) => apiRequest(`${BASE}/add-template`, { method: 'POST', body: data });

/**
 * @param {Object} data - { templateId, ...fields to update (incl. status 'A'|'I') }
 */
export const updateTemplate = (data) => apiRequest(`${BASE}/update-template`, { method: 'PUT', body: data });

export const deleteTemplate = (templateId) =>
  apiRequest(`${BASE}/delete-template`, { method: 'DELETE', body: { templateId } });

// --- Bulk multi-select actions (checkbox selection in the admin table) ------
// Both return { results, successCount, failureCount }.
export const bulkSetTemplateStatus = (templateIds, status) =>
  apiRequest(`${BASE}/bulk-status`, { method: 'PATCH', body: { templateIds, status } });

export const bulkDeleteTemplates = (templateIds) =>
  apiRequest(`${BASE}/bulk-delete`, { method: 'DELETE', body: { templateIds } });

// --- Module assignment (CompanySettings.emailTemplateAssignments) -----------
// At most one template per module - assigning replaces the previous one.
export const assignTemplateToModule = (module, templateId) =>
  apiRequest(`${COMPANY_SETTINGS_BASE}/assign-email-template`, { method: 'POST', body: { module, templateId } });

export const unassignTemplateFromModule = (module) =>
  apiRequest(`${COMPANY_SETTINGS_BASE}/unassign-email-template`, { method: 'DELETE', body: { module } });

export default {
  getAllTemplates,
  getTemplateById,
  getAvailableVariables,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  bulkSetTemplateStatus,
  bulkDeleteTemplates,
  assignTemplateToModule,
  unassignTemplateFromModule,
};
