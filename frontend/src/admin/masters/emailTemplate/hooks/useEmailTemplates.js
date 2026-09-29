import { useCallback, useEffect, useState } from 'react';
import * as emailTemplateApi from '../api/emailTemplateApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the email templates list state for the admin page: fetching, and the
 * create/update/delete/status/module-assignment mutations, each surfacing errors via
 * toast rather than throwing, so callers can just check the boolean result.
 */
export const useEmailTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [numberOfTemplatesAllowed, setNumberOfTemplatesAllowed] = useState(null);
  // Step-wise order templates (isDifferentEmailTemplatesForOrderStepsOn) and
  // the order steps a template can be assigned to while it's on.
  const [stepWise, setStepWise] = useState({ isOn: false, stepOptions: [], hasWorkflow: false });
  // Modules whose feature (courier / discount / Free Cash) is off - not offered.
  const [unavailableModules, setUnavailableModules] = useState([]);
  // CC/BCC switch, the Company Settings attachment/image library and the invoice option.
  const [contentOptions, setContentOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await emailTemplateApi.getAllTemplates();
      setTemplates(Array.isArray(data?.templates) ? data.templates : []);
      setAssignments(Array.isArray(data?.assignments) ? data.assignments : []);
      setNumberOfTemplatesAllowed(data?.numberOfTemplatesAllowed ?? null);
      setStepWise({
        isOn: !!data?.isStepWiseOrderTemplatesOn,
        stepOptions: Array.isArray(data?.orderStepOptions) ? data.orderStepOptions : [],
        hasWorkflow: !!data?.hasOrderWorkflow,
      });
      setUnavailableModules(Array.isArray(data?.unavailableModules) ? data.unavailableModules : []);
      setContentOptions(data?.contentOptions || null);
    } catch (err) {
      setError(err.message || 'Failed to load email templates');
      setTemplates([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Shared shape for the single-item mutations: run, toast, refetch.
  const runMutation = async (action, successMessage, failureMessage) => {
    setMutating(true);
    try {
      await action();
      toast.success(successMessage);
      await fetchTemplates();
      return true;
    } catch (err) {
      toast.error(err.message || failureMessage);
      return false;
    } finally {
      setMutating(false);
    }
  };

  const createTemplate = (payload) =>
    runMutation(
      () => emailTemplateApi.addTemplate(payload),
      'Email template created successfully',
      'Failed to create email template'
    );

  const editTemplate = (templateId, payload) =>
    runMutation(
      () => emailTemplateApi.updateTemplate({ templateId, ...payload }),
      'Email template updated successfully',
      'Failed to update email template'
    );

  const removeTemplate = (templateId) =>
    runMutation(
      () => emailTemplateApi.deleteTemplate(templateId),
      'Email template deleted successfully',
      'Failed to delete email template'
    );

  const toggleStatus = (template) => {
    const activating = template.status !== 'A';
    return runMutation(
      () => emailTemplateApi.updateTemplate({ templateId: template._id, status: activating ? 'A' : 'I' }),
      activating ? 'Email template activated successfully' : 'Email template deactivated successfully',
      'Failed to update email template status'
    );
  };

  // steps = { stepSelection, stepCodes } when step-wise order templates are on.
  const changeModule = (templateId, module, confirmReassign = false, steps = {}) =>
    runMutation(
      () => emailTemplateApi.changeTemplateModule(templateId, module, confirmReassign, steps),
      'Email template module changed successfully',
      'Failed to change email template module'
    );

  const unassignModule = (templateId) =>
    runMutation(
      () => emailTemplateApi.unassignTemplateModule(templateId),
      'Email template unassigned from its module successfully',
      'Failed to unassign email template module'
    );

  // --- Bulk multi-select actions (checkbox column) --------------------------
  // Bulk endpoints process what they can and skip the rest (e.g. templates
  // still assigned to a module) - results come back in the same order as the
  // ids sent, so skipped ones are named from that order.
  const describeBulkOutcome = (data, templateIds, pastTenseVerb, failureVerb) => {
    const successCount = data?.successCount ?? 0;
    const results = Array.isArray(data?.results) ? data.results : [];
    const skipped = results
      .map((result, index) => ({ result, template: templates.find((t) => t._id === templateIds[index]) }))
      .filter(({ result }) => !result.isSuccess);

    if (skipped.length === 0) {
      toast.success(`${successCount} email template(s) ${pastTenseVerb}`);
      return;
    }

    const shown = skipped.slice(0, 3).map(({ result, template }) => `"${template?.templateName || 'Template'}": ${result.message}`);
    const more = skipped.length > 3 ? ` And ${skipped.length - 3} more.` : '';
    const details = `${shown.join(' ')}${more}`;
    if (successCount === 0) {
      toast.error(`Could not ${failureVerb} the selected email template(s). ${details}`);
    } else {
      toast.warning(`${successCount} email template(s) ${pastTenseVerb}, ${skipped.length} skipped. ${details}`);
    }
  };

  const bulkToggleStatus = async (templateIds, status) => {
    if (!templateIds || templateIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await emailTemplateApi.bulkSetTemplateStatus(templateIds, status);
      describeBulkOutcome(data, templateIds, status === 'A' ? 'activated' : 'deactivated', 'update');
      await fetchTemplates();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to update email template status');
      return null;
    } finally {
      setMutating(false);
    }
  };

  const bulkRemoveTemplates = async (templateIds) => {
    if (!templateIds || templateIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await emailTemplateApi.bulkDeleteTemplates(templateIds);
      describeBulkOutcome(data, templateIds, 'deleted', 'delete');
      await fetchTemplates();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to delete email templates');
      return null;
    } finally {
      setMutating(false);
    }
  };

  const bulkUnassignModules = async (templateIds) => {
    if (!templateIds || templateIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await emailTemplateApi.bulkUnassignTemplateModules(templateIds);
      describeBulkOutcome(data, templateIds, 'unassigned', 'unassign');
      await fetchTemplates();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to unassign email template modules');
      return null;
    } finally {
      setMutating(false);
    }
  };

  return {
    templates,
    assignments,
    numberOfTemplatesAllowed,
    stepWise,
    unavailableModules,
    contentOptions,
    loading,
    error,
    mutating,
    refetch: fetchTemplates,
    createTemplate,
    editTemplate,
    removeTemplate,
    toggleStatus,
    changeModule,
    unassignModule,
    bulkToggleStatus,
    bulkRemoveTemplates,
    bulkUnassignModules,
  };
};

export default useEmailTemplates;
