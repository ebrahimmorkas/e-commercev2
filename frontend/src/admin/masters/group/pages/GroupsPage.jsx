import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Switch from '../../../../components/common/Switch';
import Badge from '../../../../components/common/Badge';
import Modal from '../../../../components/common/Modal';
import EmptyState from '../../../../components/common/EmptyState';
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
  const { groups, loading, error, mutating, createGroup, editGroup, removeGroup, toggleStatus } = useGroups();

  const [formModal, setFormModal] = useState({ open: false, mode: 'add', group: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openAddModal = () => setFormModal({ open: true, mode: 'add', group: null });
  const openEditModal = (group) => setFormModal({ open: true, mode: 'edit', group });
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

        <Table
          columns={columns}
          data={groups}
          keyField="_id"
          actions={actions}
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
    </div>
  );
};

export default GroupsPage;
