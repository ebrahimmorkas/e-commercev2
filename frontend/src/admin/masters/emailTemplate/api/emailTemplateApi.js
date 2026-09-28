import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/email-templates';

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
 * Picking a module auto-assigns the new template to it. If another template
 * already holds that module the call fails with 409 unless confirmReassign is true.
 * @param {Object} data - { templateName, module, subject, htmlBody, textBody, confirmReassign? }
 */
export const addTemplate = (data) => apiRequest(`${BASE}/add-template`, { method: 'POST', body: data });

/**
 * Changing `module` behaves like create (auto-assign, confirmReassign rule).
 * @param {Object} data - { templateId, ...fields to update (incl. status 'A'|'I'), confirmReassign? }
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

// --- Module assignment -------------------------------------------------------
// One template per module and one module per template. Change Module moves
// the template's Module field and its assignment together.
// steps = { stepSelection, stepCodes } when step-wise order templates are on.
export const changeTemplateModule = (templateId, module, confirmReassign = false, steps = {}) =>
  apiRequest(`${BASE}/change-module`, { method: 'PATCH', body: { templateId, module, confirmReassign, ...steps } });

// Must be done before an assigned template can be deleted or marked inactive.
export const unassignTemplateModule = (templateId) =>
  apiRequest(`${BASE}/unassign-module`, { method: 'PATCH', body: { templateId } });

// Returns { results, successCount, failureCount }.
export const bulkUnassignTemplateModules = (templateIds) =>
  apiRequest(`${BASE}/bulk-unassign-module`, { method: 'PATCH', body: { templateIds } });

export default {
  getAllTemplates,
  getTemplateById,
  getAvailableVariables,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  bulkSetTemplateStatus,
  bulkDeleteTemplates,
  changeTemplateModule,
  unassignTemplateModule,
  bulkUnassignTemplateModules,
};
