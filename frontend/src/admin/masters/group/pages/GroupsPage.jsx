import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Switch from '../../../../components/common/Switch';
import Badge from '../../../../components/common/Badge';
import Modal from '../../../../components/common/Modal';
import EmptyState from '../../../../components/common/EmptyState';
import BulkActionBar from '../../../../components/common/BulkActionBar';
import { useGroups } from '../hooks/useGroups';
import GroupForm from '../components/GroupForm';
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
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const GroupsPage = () => {
  const { groups, loading, error, mutating, createGroup, editGroup, removeGroup, toggleStatus, bulkToggleStatus, bulkRemoveGroups } = useGroups();

  const [formModal, setFormModal] = useState({ open: false, mode: 'add', group: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const openAddModal = () => {
    setSelectedIds([]);
    setFormModal({ open: true, mode: 'add', group: null });
  };
  const openEditModal = (group) => {
    setSelectedIds([]);
    setFormModal({ open: true, mode: 'edit', group });
  };
  const closeFormModal = () => setFormModal({ open: false, mode: 'add', group: null });

  const handleFormSubmit = async (payload, excelFile) => {
    const success =
      formModal.mode === 'edit'
        ? await editGroup(formModal.group._id, payload, excelFile)
        : await createGroup(payload, excelFile);
    if (success) closeFormModal();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeGroup(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  // --- Bulk multi-select actions (checkbox column) --------------------------
  // Admin list endpoints never return status 'D' rows, so every selected
  // group is already 'A' or 'I' - eligibility only separates those two for
  // the status-toggle buttons; Delete applies to the full selection.
  const selectedGroups = useMemo(
    () => groups.filter((g) => selectedIds.includes(g._id)),
    [groups, selectedIds]
  );
  const activateEligibleIds = useMemo(
    () => selectedGroups.filter((g) => g.status === 'I').map((g) => g._id),
    [selectedGroups]
  );
  const deactivateEligibleIds = useMemo(
    () => selectedGroups.filter((g) => g.status === 'A').map((g) => g._id),
    [selectedGroups]
  );

  // Tracks which specific bulk action is in flight so only that button shows
  // a spinner - `mutating` alone is shared across every mutation in the hook
  // and would otherwise light up every bulk button at once for any one of them.
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
    await bulkRemoveGroups(selectedIds);
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
        key: 'groupName',
        label: 'Group Name',
        sortable: true,
        render: (row) => <span className={`font-medium ${theme.text.heading}`}>{row.groupName}</span>,
      },
      {
        key: 'groupType',
        label: 'Type',
        render: (row) => <Badge variant={theme.groupTypeBadge[row.groupType] || 'gray'}>{row.groupType}</Badge>,
      },
      {
        key: 'membersCount',
        label: 'Members',
        align: 'center',
        render: (row) => <span className={theme.text.body}>{row.membersCount ?? row.members?.length ?? 0}</span>,
      },
      {
        key: 'precedence',
        label: 'Precedence',
        align: 'center',
        render: (row) => <span className={theme.text.body}>{row.precedence ?? 0}</span>,
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
              aria-label={`Toggle status for ${row.groupName}`}
            />
          </div>
        ),
      },
    ],
    [mutating, toggleStatus]
  );

  const actions = [
    {
      label: 'Edit',
      icon: <PencilIcon />,
      variant: theme.button.secondary,
      onClick: openEditModal,
    },
    {
      label: 'Delete',
      icon: <TrashIcon />,
      variant: theme.button.danger,
      onClick: setDeleteTarget,
    },
  ];

  return (
    <div className="max-w-8xl mx-auto p-6">
      <Card
        title={<span className="font-bold">Group Master</span>}
        subtitle="Build reusable member groups (products, categories, users, brands, orders) that other features like Discounts and Free Cash can target"
        headerActions={
          <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAddModal}>
            Add Group
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
          data={groups}
          keyField="_id"
          actions={selectedIds.length > 0 ? [] : actions}
          selectable
          selectedKeys={selectedIds}
          onSelectionChange={setSelectedIds}
          loading={loading}
          pageSize={10}
          emptyComponent={
            <EmptyState
              title="No groups yet"
              description="Create your first group so it can be targeted by other features."
              action={
                <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAddModal}>
                  Add Group
                </Button>
              }
            />
          }
        />
      </Card>

      <Modal
        isOpen={formModal.open}
        onClose={closeFormModal}
        title={formModal.mode === 'edit' ? 'Edit Group' : 'Add Group'}
        size="lg"
      >
        <GroupForm
          mode={formModal.mode}
          initialValues={formModal.group || {}}
          onSubmit={handleFormSubmit}
          onCancel={closeFormModal}
          submitting={mutating}
        />
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Group"
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
          <span className={`font-medium ${theme.text.heading}`}>{deleteTarget?.groupName}</span>? This action cannot
          be undone.
        </p>
      </Modal>

      <Modal
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        title="Delete Groups"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={() => setBulkDeleteConfirmOpen(false)} disabled={mutating}>
              Cancel
            </Button>
            <Button variant={theme.button.danger} onClick={handleConfirmBulkDelete} loading={mutating}>
              Delete
            </Button>
          </>
        }
      >
        <p className={`text-sm ${theme.text.body}`}>
          Are you sure you want to delete <span className={`font-medium ${theme.text.heading}`}>{selectedIds.length}</span> group{selectedIds.length === 1 ? '' : 's'}? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default GroupsPage;
