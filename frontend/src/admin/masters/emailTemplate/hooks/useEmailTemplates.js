import { useCallback, useEffect, useState } from 'react';
import * as emailTemplateApi from '../api/emailTemplateApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the email templates list state for the admin page: fetching, and the
 * create/update/delete/status/assign mutations, each surfacing errors via
 * toast rather than throwing, so callers can just check the boolean result.
 */
export const useEmailTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [numberOfTemplatesAllowed, setNumberOfTemplatesAllowed] = useState(null);
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

  const assignToModule = (module, templateId) =>
    runMutation(
      () => emailTemplateApi.assignTemplateToModule(module, templateId),
      'Email template assigned successfully',
      'Failed to assign email template'
    );

  const unassignFromModule = (module) =>
    runMutation(
      () => emailTemplateApi.unassignTemplateFromModule(module),
      'Email template unassigned successfully',
      'Failed to unassign email template'
    );

  // --- Bulk multi-select actions (checkbox column) --------------------------
  const describeBulkOutcome = (data, pastTenseVerb) => {
    const successCount = data?.successCount ?? 0;
    const failureCount = data?.failureCount ?? 0;
    if (failureCount === 0) {
      toast.success(`${successCount} email template(s) ${pastTenseVerb}`);
    } else if (successCount === 0) {
      toast.error(`Could not ${pastTenseVerb === 'deleted' ? 'delete' : 'update'} the selected email template(s)`);
    } else {
      toast.warning(`${successCount} email template(s) ${pastTenseVerb}, ${failureCount} could not be processed`);
    }
  };

  const bulkToggleStatus = async (templateIds, status) => {
    if (!templateIds || templateIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await emailTemplateApi.bulkSetTemplateStatus(templateIds, status);
      describeBulkOutcome(data, status === 'A' ? 'activated' : 'deactivated');
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
      describeBulkOutcome(data, 'deleted');
      await fetchTemplates();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to delete email templates');
      return null;
    } finally {
      setMutating(false);
    }
  };

  return {
    templates,
    assignments,
    numberOfTemplatesAllowed,
    loading,
    error,
    mutating,
    refetch: fetchTemplates,
    createTemplate,
    editTemplate,
    removeTemplate,
    toggleStatus,
    assignToModule,
    unassignFromModule,
    bulkToggleStatus,
    bulkRemoveTemplates,
  };
};

export default useEmailTemplates;
