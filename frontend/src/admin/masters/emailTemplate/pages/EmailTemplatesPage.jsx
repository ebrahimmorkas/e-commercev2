import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Switch from '../../../../components/common/Switch';
import Badge from '../../../../components/common/Badge';
import Modal from '../../../../components/common/Modal';
import Dropdown from '../../../../components/common/DropDown';
import Alert from '../../../../components/common/Alert';
import Tooltip from '../../../../components/common/Tooltip';
import EmptyState from '../../../../components/common/EmptyState';
import BulkActionBar from '../../../../components/common/BulkActionBar';
import { useEmailTemplates } from '../hooks/useEmailTemplates';
import EmailTemplateForm from '../components/EmailTemplateForm';
import OrderStepsField from '../components/OrderStepsField';
import { EMAIL_MODULE_OPTIONS, ORDER_MODULE, getModuleLabel } from '../constants';
import {
  findAssignmentConflicts,
  initialStepPicks,
  picksFromRequest,
  toStepRequest,
  isStepEntry,
  describeAssignedSteps,
} from '../utils/stepAssignment';
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
const UnlinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
    stepWise,
    loading,
    error,
    mutating,
    createTemplate,
    editTemplate,
    removeTemplate,
    toggleStatus,
    changeModule,
    unassignModule,
    bulkToggleStatus,
    bulkRemoveTemplates,
    bulkUnassignModules,
  } = useEmailTemplates();

  const [formModal, setFormModal] = useState({ open: false, mode: 'add', template: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [changeModuleModal, setChangeModuleModal] = useState({ open: false, template: null, module: '', stepPicks: [] });
  // Shared "this is already assigned to another template - move it?"
  // confirmation, used by Add, Edit (module/steps changed) and Change Module.
  // conflicts = [{ templateName, stepNames }]; onConfirm re-runs the save
  // with confirmReassign: true.
  const [reassignConfirm, setReassignConfirm] = useState({ open: false, module: '', conflicts: [], onConfirm: null });
  const [reassigning, setReassigning] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const isQuotaReached = numberOfTemplatesAllowed != null && templates.length >= numberOfTemplatesAllowed;
  const isStepModeFor = (module) => stepWise.isOn && module === ORDER_MODULE;

  const openAddModal = () => {
    setSelectedIds([]);
    setFormModal({ open: true, mode: 'add', template: null });
  };
  const openEditModal = (template) => {
    setSelectedIds([]);
    setFormModal({ open: true, mode: 'edit', template });
  };
  const closeFormModal = () => setFormModal({ open: false, mode: 'add', template: null });

  // --- Module assignment ----------------------------------------------------
  // One assignment entry per template.
  const assignmentByTemplate = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      map[a.templateId] = a;
    });
    return map;
  }, [assignments]);
  const assignedModuleByTemplate = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      map[a.templateId] = a.module;
    });
    return map;
  }, [assignments]);

  // Step-wise templates turned off while the Order module only has step
  // assignments -> nothing vendor-made is sent for Order right now.
  const orderAssignments = assignments.filter((a) => a.module === ORDER_MODULE);
  const hasOnlyDormantOrderSteps =
    !stepWise.isOn && orderAssignments.length > 0 && orderAssignments.every((a) => isStepEntry(a));

  const conflictsFor = (templateId, module, picks) =>
    findAssignmentConflicts({
      assignments,
      templates,
      templateId,
      module,
      picks,
      isStepWiseOn: stepWise.isOn,
      stepOptions: stepWise.stepOptions,
    });

  const askToReassign = (module, conflicts, onConfirm) => setReassignConfirm({ open: true, module, conflicts, onConfirm });
  const closeReassignConfirm = () => setReassignConfirm({ open: false, module: '', conflicts: [], onConfirm: null });

  const handleConfirmReassign = async () => {
    setReassigning(true);
    await reassignConfirm.onConfirm();
    setReassigning(false);
    closeReassignConfirm();
  };

  const saveForm = async (payload) => {
    const success =
      formModal.mode === 'edit'
        ? await editTemplate(formModal.template._id, payload)
        : await createTemplate(payload);
    if (success) closeFormModal();
  };

  // Same rule as the backend: a new template, or an edit of an Active
  // template that changes its module (or, in step-wise mode, its order
  // steps), is auto-assigned - so ask first if that would take the module or
  // steps away from other templates.
  const handleFormSubmit = async (payload) => {
    const isEdit = formModal.mode === 'edit';
    const template = formModal.template;
    const isModuleChanged = !isEdit || payload.module !== (template.module || '');
    const willAutoAssign =
      !!payload.module &&
      (!isEdit || ((isModuleChanged || payload.stepSelection !== undefined) && payload.status === 'A'));
    const conflicts = willAutoAssign
      ? conflictsFor(template?._id ?? null, payload.module, picksFromRequest(payload))
      : [];

    if (conflicts.length > 0) {
      askToReassign(payload.module, conflicts, () => saveForm({ ...payload, confirmReassign: true }));
      return;
    }
    await saveForm(payload);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeTemplate(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  const openChangeModuleModal = (template) => {
    setSelectedIds([]);
    setChangeModuleModal({
      open: true,
      template,
      module: template.module || '',
      stepPicks: initialStepPicks(assignmentByTemplate[template._id]),
    });
  };
  const closeChangeModuleModal = () => setChangeModuleModal({ open: false, template: null, module: '', stepPicks: [] });

  const changeModuleTemplate = changeModuleModal.template;
  const isChangeModuleStepMode = isStepModeFor(changeModuleModal.module);
  // In step-wise mode "already assigned" depends on the exact steps, which
  // the backend reports - so only whole-module assignments are checked here.
  const isAlreadyAssignedHere =
    !isChangeModuleStepMode &&
    !!changeModuleTemplate &&
    !!changeModuleModal.module &&
    changeModuleTemplate.module === changeModuleModal.module &&
    assignedModuleByTemplate[changeModuleTemplate._id] === changeModuleModal.module &&
    !isStepEntry(assignmentByTemplate[changeModuleTemplate._id]);
  const changeModuleConflicts =
    changeModuleTemplate && changeModuleModal.module
      ? conflictsFor(changeModuleTemplate._id, changeModuleModal.module, changeModuleModal.stepPicks)
      : [];

  const handleChangeModule = async () => {
    const { template, module, stepPicks } = changeModuleModal;
    const steps = isStepModeFor(module) ? toStepRequest(stepPicks) : {};
    const run = async (confirmReassign) => {
      const success = await changeModule(template._id, module, confirmReassign, steps);
      if (success) closeChangeModuleModal();
    };

    if (changeModuleConflicts.length > 0) {
      askToReassign(module, changeModuleConflicts, () => run(true));
      return;
    }
    await run(false);
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
  const unassignEligibleIds = useMemo(
    () => selectedTemplates.filter((t) => assignedModuleByTemplate[t._id]).map((t) => t._id),
    [selectedTemplates, assignedModuleByTemplate]
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

  const handleBulkUnassign = async () => {
    setBulkAction('unassign');
    await bulkUnassignModules(unassignEligibleIds);
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
      key: 'unassign',
      label: `Unassign Module (${unassignEligibleIds.length})`,
      variant: theme.button.secondary,
      onClick: handleBulkUnassign,
      loading: bulkAction === 'unassign',
      disabled: mutating,
      hidden: unassignEligibleIds.length === 0,
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
          const assignment = assignmentByTemplate[row._id];
          if (!assignment) return <span className={theme.text.muted}>Not assigned</span>;
          // A step assignment is kept while step-wise templates are off, but
          // isn't used until they're turned back on.
          const isDormant = !stepWise.isOn && isStepEntry(assignment);
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge variant={isDormant ? theme.dormantBadge : theme.assignedBadge}>{getModuleLabel(assignment.module)}</Badge>
              {isDormant && <span className={`text-xs ${theme.text.muted}`}>Order steps - not in use</span>}
            </div>
          );
        },
      },
      // Only while step-wise order templates are on.
      ...(stepWise.isOn
        ? [
            {
              key: 'orderSteps',
              label: 'Order Steps',
              render: (row) => {
                const steps = describeAssignedSteps(assignmentByTemplate[row._id], stepWise.stepOptions);
                return steps ? (
                  <span className={`text-sm ${theme.text.body}`}>{steps}</span>
                ) : (
                  <span className={theme.text.muted}>-</span>
                );
              },
            },
          ]
        : []),
      {
        key: 'status',
        label: 'Status',
        align: 'center',
        render: (row) => {
          // An assigned template can't be marked inactive - unassign it first.
          const isLocked = row.status === 'A' && !!assignedModuleByTemplate[row._id];
          return (
            <div className="flex items-center justify-center">
              <Tooltip content="Unassign the module before marking this template inactive" disabled={!isLocked}>
                <Switch
                  checked={row.status === 'A'}
                  onChange={() => toggleStatus(row)}
                  disabled={mutating || isLocked}
                  color={theme.switch.color}
                  aria-label={`Toggle status for ${row.templateName}`}
                />
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [mutating, toggleStatus, assignedModuleByTemplate, assignmentByTemplate, stepWise]
  );

  const actions = [
    {
      label: 'Edit',
      icon: <PencilIcon />,
      variant: theme.button.secondary,
      onClick: openEditModal,
    },
    {
      label: 'Change Module',
      icon: <LinkIcon />,
      variant: theme.button.secondary,
      onClick: openChangeModuleModal,
      show: (row) => row.status === 'A',
    },
    {
      label: 'Unassign Module',
      icon: <UnlinkIcon />,
      variant: theme.button.secondary,
      onClick: (row) => unassignModule(row._id),
      show: (row) => !!assignedModuleByTemplate[row._id],
      disabled: () => mutating,
    },
    {
      label: 'Delete',
      icon: <TrashIcon />,
      variant: theme.button.danger,
      onClick: setDeleteTarget,
      // Assigned templates must be unassigned first (the backend refuses too).
      disabled: (row) => !!assignedModuleByTemplate[row._id],
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

        <Alert variant="info" className="mb-4">
          Each module sends one email template. When you create a template and pick a module, it is assigned to that
          module automatically. To use a different template for a module, click <strong>Change Module</strong> on that
          template. A template that is assigned to a module can&apos;t be deleted or marked inactive until you click{' '}
          <strong>Unassign Module</strong>.
          {stepWise.isOn && (
            <>
              {' '}
              For the {getModuleLabel(ORDER_MODULE)} module you can use different templates for different order steps.
              A step that has no template sends no email.
            </>
          )}
        </Alert>

        {hasOnlyDormantOrderSteps && (
          <Alert variant="warning" className="mb-4">
            Different templates for order steps are currently turned off, so your step-wise{' '}
            {getModuleLabel(ORDER_MODULE)} templates are not being used. To choose one template for all{' '}
            {getModuleLabel(ORDER_MODULE)} emails, click <strong>Change Module</strong> on it. Your step assignments are
            kept and will be used again if the feature is turned back on.
          </Alert>
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
              description="Create your first template and pick a module - it will be assigned to that module automatically."
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
          assignments={assignments}
          templates={templates}
          stepWise={stepWise}
        />
      </Modal>

      <Modal
        isOpen={changeModuleModal.open}
        onClose={closeChangeModuleModal}
        title="Change Module"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={closeChangeModuleModal} disabled={mutating}>
              Cancel
            </Button>
            <Button
              variant={theme.button.primary}
              onClick={handleChangeModule}
              loading={mutating}
              disabled={
                !changeModuleModal.module ||
                isAlreadyAssignedHere ||
                (isChangeModuleStepMode && changeModuleModal.stepPicks.length === 0)
              }
            >
              Save
            </Button>
          </>
        }
      >
        <p className={`text-sm mb-4 ${theme.text.body}`}>
          Choose which module should send{' '}
          <span className={`font-medium ${theme.text.heading}`}>{changeModuleTemplate?.templateName}</span>. If no
          template is assigned to a module, the &quot;Use the default email template&quot; setting in Company Settings
          decides whether the platform&apos;s default email is sent.
        </p>
        <div className="space-y-4">
          <Dropdown
            label="Module"
            name="changeModule"
            options={EMAIL_MODULE_OPTIONS}
            value={changeModuleModal.module}
            onChange={(val) => setChangeModuleModal((prev) => ({ ...prev, module: val || '' }))}
            placeholder="Select a module"
            helperText={
              isAlreadyAssignedHere
                ? 'This template is already assigned to this module.'
                : changeModuleConflicts.length > 0
                  ? 'Part of this is already assigned to another template. You will be asked to confirm before it is moved.'
                  : undefined
            }
          />
          {isChangeModuleStepMode && (
            <OrderStepsField
              value={changeModuleModal.stepPicks}
              onChange={(picks) => setChangeModuleModal((prev) => ({ ...prev, stepPicks: picks }))}
              stepOptions={stepWise.stepOptions}
              hasWorkflow={stepWise.hasWorkflow}
              error={changeModuleModal.stepPicks.length === 0 ? 'Please select at least one order step.' : ''}
            />
          )}
        </div>
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
          <span className={`font-medium ${theme.text.heading}`}>{deleteTarget?.templateName}</span>? This action cannot
          be undone.
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
          {selectedIds.length === 1 ? '' : 's'}? Templates that are assigned to a module will be skipped - unassign
          them first. This action cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={reassignConfirm.open}
        onClose={closeReassignConfirm}
        title="Replace Assigned Template?"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={closeReassignConfirm} disabled={reassigning}>
              Cancel
            </Button>
            <Button variant={theme.button.primary} onClick={handleConfirmReassign} loading={reassigning}>
              Continue
            </Button>
          </>
        }
      >
        {reassignConfirm.conflicts.some((c) => c.stepNames.length > 0) ? (
          <div className={`text-sm space-y-3 ${theme.text.body}`}>
            <p>
              Some of the selected{' '}
              <span className={`font-medium ${theme.text.heading}`}>{getModuleLabel(reassignConfirm.module)}</span> steps
              are already assigned to other templates:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {reassignConfirm.conflicts.map((conflict) => (
                <li key={conflict.templateName}>
                  {conflict.stepNames.map((name) => `"${name}"`).join(', ')}{' '}
                  {conflict.stepNames.length === 1 ? 'belongs' : 'belong'} to{' '}
                  <span className={`font-medium ${theme.text.heading}`}>&quot;{conflict.templateName}&quot;</span>
                </li>
              ))}
            </ul>
            <p>
              If you continue, these steps will be unassigned from those templates and assigned to this template. A
              template that is left with no steps will be unassigned completely. Are you sure you want to continue?
            </p>
          </div>
        ) : (
          <p className={`text-sm ${theme.text.body}`}>
            The <span className={`font-medium ${theme.text.heading}`}>{getModuleLabel(reassignConfirm.module)}</span>{' '}
            module is already assigned to the template{' '}
            <span className={`font-medium ${theme.text.heading}`}>
              &quot;{reassignConfirm.conflicts[0]?.templateName}&quot;
            </span>
            . If you continue, this template will be assigned to the module instead, and &quot;
            {reassignConfirm.conflicts[0]?.templateName}&quot; will be unassigned from it. Are you sure you want to
            continue?
          </p>
        )}
      </Modal>
    </div>
  );
};

export default EmailTemplatesPage;
