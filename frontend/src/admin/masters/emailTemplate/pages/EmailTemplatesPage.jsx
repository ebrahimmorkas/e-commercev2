import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Switch from '../../../../components/common/Switch';
import Badge from '../../../../components/common/Badge';
import Modal from '../../../../components/common/Modal';
import Dropdown from '../../../../components/common/DropDown';
import EmptyState from '../../../../components/common/EmptyState';
import BulkActionBar from '../../../../components/common/BulkActionBar';
import { useEmailTemplates } from '../hooks/useEmailTemplates';
import EmailTemplateForm from '../components/EmailTemplateForm';
import { EMAIL_MODULE_OPTIONS, getModuleLabel } from '../constants';
import theme from '../theme/theme';

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const LinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const EmailTemplatesPage = () => {
  const {
    templates,
    assignments,
    numberOfTemplatesAllowed,
    loading,
    error,
    mutating,
    createTemplate,
    editTemplate,
    removeTemplate,
    toggleStatus,
    assignToModule,
    unassignFromModule,
    bulkToggleStatus,
    bulkRemoveTemplates,
  } = useEmailTemplates();

  const [formModal, setFormModal] = useState({ open: false, mode: 'add', template: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignModal, setAssignModal] = useState({ open: false, template: null, module: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const isQuotaReached = numberOfTemplatesAllowed != null && templates.length >= numberOfTemplatesAllowed;

  const openAddModal = () => {
    setSelectedIds([]);
    setFormModal({ open: true, mode: 'add', template: null });
  };
  const openEditModal = (template) => {
    setSelectedIds([]);
    setFormModal({ open: true, mode: 'edit', template });
  };
  const closeFormModal = () => setFormModal({ open: false, mode: 'add', template: null });

  const handleFormSubmit = async (payload) => {
    const success =
      formModal.mode === 'edit'
        ? await editTemplate(formModal.template._id, payload)
        : await createTemplate(payload);
    if (success) closeFormModal();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeTemplate(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  // --- Module assignment ----------------------------------------------------
  const assignedModulesByTemplate = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      map[a.templateId] = [...(map[a.templateId] || []), a.module];
    });
    return map;
  }, [assignments]);

  const openAssignModal = (template) => {
    setSelectedIds([]);
    setAssignModal({ open: true, template, module: assignedModulesByTemplate[template._id]?.[0] || '' });
  };
  const closeAssignModal = () => setAssignModal({ open: false, template: null, module: '' });

  const assignmentForModule = (module) => assignments.find((a) => a.module === module);
  const selectedModuleAssignment = assignmentForModule(assignModal.module);
  const isAssignedHere = selectedModuleAssignment?.templateId === assignModal.template?._id;
  const replacedTemplate =
    selectedModuleAssignment && !isAssignedHere
      ? templates.find((t) => t._id === selectedModuleAssignment.templateId)
      : null;

  const handleAssign = async () => {
    const success = await assignToModule(assignModal.module, assignModal.template._id);
    if (success) closeAssignModal();
  };
  const handleUnassign = async () => {
    const success = await unassignFromModule(assignModal.module);
    if (success) closeAssignModal();
  };

  // --- Bulk multi-select actions (checkbox column) --------------------------
  // Admin list endpoints never return status 'D' rows, so every selected
  // template is already 'A' or 'I' - eligibility only separates those two for
  // the status-toggle buttons; Delete applies to the full selection.
  const selectedTemplates = useMemo(
    () => templates.filter((t) => selectedIds.includes(t._id)),
    [templates, selectedIds]
  );
  const activateEligibleIds = useMemo(
    () => selectedTemplates.filter((t) => t.status === 'I').map((t) => t._id),
    [selectedTemplates]
  );
  const deactivateEligibleIds = useMemo(
    () => selectedTemplates.filter((t) => t.status === 'A').map((t) => t._id),
    [selectedTemplates]
  );

  // Tracks which specific bulk action is in flight so only that button shows
  // a spinner - `mutating` alone is shared across every mutation in the hook.
  const [bulkAction, setBulkAction] = useState(null);

  const handleBulkActivate = async () => {
    setBulkAction('activate');
    await bulkToggleStatus(activateEligibleIds, 'A');
    setBulkAction(null);
    setSelectedIds([]);
  };

  const handleBulkDeactivate = async () => {
    setBulkAction('deactivate');
    await bulkToggleStatus(deactivateEligibleIds, 'I');
    setBulkAction(null);
    setSelectedIds([]);
  };

  const handleConfirmBulkDelete = async () => {
    setBulkAction('delete');
    await bulkRemoveTemplates(selectedIds);
    setBulkAction(null);
    setBulkDeleteConfirmOpen(false);
    setSelectedIds([]);
  };

  const bulkActions = [
    {
      key: 'activate',
      label: `Mark Active (${activateEligibleIds.length})`,
      variant: theme.button.primary,
      onClick: handleBulkActivate,
      loading: bulkAction === 'activate',
      disabled: mutating,
      hidden: activateEligibleIds.length === 0,
    },
    {
      key: 'deactivate',
      label: `Mark Inactive (${deactivateEligibleIds.length})`,
      variant: theme.button.secondary,
      onClick: handleBulkDeactivate,
      loading: bulkAction === 'deactivate',
      disabled: mutating,
      hidden: deactivateEligibleIds.length === 0,
    },
    {
      key: 'delete',
      label: `Delete (${selectedIds.length})`,
      variant: theme.button.danger,
      onClick: () => setBulkDeleteConfirmOpen(true),
      disabled: mutating,
      hidden: selectedIds.length === 0,
    },
  ];

  const columns = useMemo(
    () => [
      {
        key: 'templateName',
        label: 'Template Name',
        sortable: true,
        render: (row) => <span className={`font-medium ${theme.text.heading}`}>{row.templateName}</span>,
      },
      {
        key: 'module',
        label: 'Module',
        render: (row) =>
          row.module ? (
            <Badge variant={theme.moduleBadge}>{getModuleLabel(row.module)}</Badge>
          ) : (
            <span className={theme.text.muted}>-</span>
          ),
      },
      {
        key: 'subject',
        label: 'Subject',
        render: (row) => <span className={theme.text.body}>{row.subject}</span>,
      },
      {
        key: 'assignedTo',
        label: 'Assigned To',
        render: (row) => {
          const modules = assignedModulesByTemplate[row._id] || [];
          return modules.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {modules.map((m) => (
                <Badge key={m} variant={theme.assignedBadge}>{getModuleLabel(m)}</Badge>
              ))}
            </div>
          ) : (
            <span className={theme.text.muted}>Not assigned</span>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        align: 'center',
        render: (row) => (
          <div className="flex items-center justify-center">
            <Switch
              checked={row.status === 'A'}
              onChange={() => toggleStatus(row)}
              disabled={mutating}
              color={theme.switch.color}
              aria-label={`Toggle status for ${row.templateName}`}
            />
          </div>
        ),
      },
    ],
    [mutating, toggleStatus, assignedModulesByTemplate]
  );

  const actions = [
    {
      label: 'Edit',
      icon: <PencilIcon />,
      variant: theme.button.secondary,
      onClick: openEditModal,
    },
    {
      label: 'Assign',
      icon: <LinkIcon />,
      variant: theme.button.secondary,
      onClick: openAssignModal,
      show: (row) => row.status === 'A',
    },
    {
      label: 'Delete',
      icon: <TrashIcon />,
      variant: theme.button.danger,
      onClick: setDeleteTarget,
    },
  ];

  const quotaText =
    numberOfTemplatesAllowed != null ? ` (${templates.length} of ${numberOfTemplatesAllowed} templates used)` : '';

  return (
    <div className="max-w-8xl mx-auto p-6">
      <Card
        title={<span className="font-bold">Email Template Master</span>}
        subtitle={`Create the email templates your store sends and choose which template each module uses${quotaText}`}
        headerActions={
          <Button
            variant={theme.button.primary}
            leftIcon={<PlusIcon />}
            onClick={openAddModal}
            disabled={isQuotaReached}
            title={isQuotaReached ? 'You have reached the number of email templates allowed' : undefined}
          >
            Add Template
          </Button>
        }
      >
        {error && (
          <p
            className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}
          >
            {error}
          </p>
        )}

        <BulkActionBar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} actions={bulkActions} />

        <Table
          columns={columns}
          data={templates}
          keyField="_id"
          actions={selectedIds.length > 0 ? [] : actions}
          selectable
          selectedKeys={selectedIds}
          onSelectionChange={setSelectedIds}
          loading={loading}
          pageSize={10}
          emptyComponent={
            <EmptyState
              title="No email templates yet"
              description="Create your first template, then assign it to a module such as Order."
              action={
                <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAddModal} disabled={isQuotaReached}>
                  Add Template
                </Button>
              }
            />
          }
        />
      </Card>

      <Modal
        isOpen={formModal.open}
        onClose={closeFormModal}
        title={formModal.mode === 'edit' ? 'Edit Email Template' : 'Add Email Template'}
        size="xl"
      >
        <EmailTemplateForm
          mode={formModal.mode}
          initialValues={formModal.template || {}}
          onSubmit={handleFormSubmit}
          onCancel={closeFormModal}
          submitting={mutating}
        />
      </Modal>

      <Modal
        isOpen={assignModal.open}
        onClose={closeAssignModal}
        title="Assign Email Template"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={closeAssignModal} disabled={mutating}>
              Cancel
            </Button>
            {isAssignedHere && (
              <Button variant={theme.button.danger} onClick={handleUnassign} loading={mutating}>
                Unassign
              </Button>
            )}
            <Button
              variant={theme.button.primary}
              onClick={handleAssign}
              loading={mutating}
              disabled={!assignModal.module || isAssignedHere}
            >
              Assign
            </Button>
          </>
        }
      >
        <p className={`text-sm mb-4 ${theme.text.body}`}>
          Choose which module should send{' '}
          <span className={`font-medium ${theme.text.heading}`}>{assignModal.template?.templateName}</span>. A module
          uses one template at a time; if none is assigned, the platform default is used.
        </p>
        <Dropdown
          label="Module"
          name="assignModule"
          options={EMAIL_MODULE_OPTIONS}
          value={assignModal.module}
          onChange={(val) => setAssignModal((prev) => ({ ...prev, module: val || '' }))}
          placeholder="Select a module"
          helperText={
            isAssignedHere
              ? 'This template is currently assigned to this module.'
              : replacedTemplate
                ? `This will replace "${replacedTemplate.templateName}", which is currently assigned to this module.`
                : undefined
          }
        />
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Email Template"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={() => setDeleteTarget(null)} disabled={mutating}>
              Cancel
            </Button>
            <Button variant={theme.button.danger} onClick={handleConfirmDelete} loading={mutating}>
              Delete
            </Button>
          </>
        }
      >
        <p className={`text-sm ${theme.text.body}`}>
          Are you sure you want to delete{' '}
          <span className={`font-medium ${theme.text.heading}`}>{deleteTarget?.templateName}</span>? Any module using
          it will fall back to the platform default. This action cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        title="Delete Email Templates"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={() => setBulkDeleteConfirmOpen(false)} disabled={mutating}>
              Cancel
            </Button>
            <Button variant={theme.button.danger} onClick={handleConfirmBulkDelete} loading={bulkAction === 'delete'}>
              Delete
            </Button>
          </>
        }
      >
        <p className={`text-sm ${theme.text.body}`}>
          Are you sure you want to delete{' '}
          <span className={`font-medium ${theme.text.heading}`}>{selectedIds.length}</span> email template
          {selectedIds.length === 1 ? '' : 's'}? Any module using them will fall back to the platform default. This
          action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default EmailTemplatesPage;
