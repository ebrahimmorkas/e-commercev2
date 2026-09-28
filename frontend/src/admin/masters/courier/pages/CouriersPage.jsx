import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Switch from '../../../../components/common/Switch';
import Modal from '../../../../components/common/Modal';
import EmptyState from '../../../../components/common/EmptyState';
import BulkActionBar from '../../../../components/common/BulkActionBar';
import SearchInput from '../../../../components/common/SearchInput';
import { filterBySearch } from '../../../../utils/searchFilter';
import { useCouriers } from '../hooks/useCouriers';
import CourierForm from '../components/CourierForm';
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

// Client-side search: the admin endpoint returns every courier at once (matching rules: utils/searchFilter.js).
const filterCouriers = (couriers, term) => filterBySearch(couriers, term, (courier) => [courier.courierName]);

const CouriersPage = () => {
  const {
    couriers,
    numberOfCouriersAllowed,
    loading,
    error,
    mutating,
    createCourier,
    editCourier,
    removeCourier,
    toggleStatus,
    bulkToggleStatus,
    bulkRemoveCouriers,
  } = useCouriers();

  const [formModal, setFormModal] = useState({ open: false, mode: 'add', courier: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Tracks which specific bulk action is in flight so only that button shows a spinner.
  const [bulkAction, setBulkAction] = useState(null);

  const filteredCouriers = useMemo(() => filterCouriers(couriers, searchTerm), [couriers, searchTerm]);
  const isSearching = searchTerm.trim() !== '';
  const isQuotaReached = numberOfCouriersAllowed != null && couriers.length >= numberOfCouriersAllowed;
  const quotaText =
    numberOfCouriersAllowed != null ? ` (${couriers.length} of ${numberOfCouriersAllowed} couriers used)` : '';

  // A bulk action must never reach rows the admin can no longer see.
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    const stillVisible = new Set(filterCouriers(couriers, value).map((c) => c._id));
    setSelectedIds((prev) => prev.filter((id) => stillVisible.has(id)));
  };

  const openAddModal = () => {
    setSelectedIds([]);
    setSearchTerm('');
    setFormModal({ open: true, mode: 'add', courier: null });
  };
  const openEditModal = (courier) => {
    setSelectedIds([]);
    setFormModal({ open: true, mode: 'edit', courier });
  };
  const closeFormModal = () => setFormModal({ open: false, mode: 'add', courier: null });

  const handleFormSubmit = async (payload) => {
    const success =
      formModal.mode === 'edit' ? await editCourier(formModal.courier._id, payload) : await createCourier(payload);
    if (success) closeFormModal();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeCourier(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  // --- Bulk multi-select actions (checkbox column) --------------------------
  const selectedCouriers = useMemo(() => couriers.filter((c) => selectedIds.includes(c._id)), [couriers, selectedIds]);
  const activateEligibleIds = useMemo(
    () => selectedCouriers.filter((c) => c.status === 'I').map((c) => c._id),
    [selectedCouriers]
  );
  const deactivateEligibleIds = useMemo(
    () => selectedCouriers.filter((c) => c.status === 'A').map((c) => c._id),
    [selectedCouriers]
  );

  const runBulkAction = async (key, action) => {
    setBulkAction(key);
    await action();
    setBulkAction(null);
    setSelectedIds([]);
  };

  const handleConfirmBulkDelete = async () => {
    await runBulkAction('delete', () => bulkRemoveCouriers(selectedIds));
    setBulkDeleteConfirmOpen(false);
  };

  const bulkActions = [
    {
      key: 'activate',
      label: `Mark Active (${activateEligibleIds.length})`,
      variant: theme.button.primary,
      onClick: () => runBulkAction('activate', () => bulkToggleStatus(activateEligibleIds, 'A')),
      loading: bulkAction === 'activate',
      disabled: mutating,
      hidden: activateEligibleIds.length === 0,
    },
    {
      key: 'deactivate',
      label: `Mark Inactive (${deactivateEligibleIds.length})`,
      variant: theme.button.secondary,
      onClick: () => runBulkAction('deactivate', () => bulkToggleStatus(deactivateEligibleIds, 'I')),
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
        key: 'courierName',
        label: 'Courier Name',
        sortable: true,
        render: (row) => <span className={`font-medium ${theme.text.heading}`}>{row.courierName}</span>,
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
              aria-label={`Toggle status for ${row.courierName}`}
            />
          </div>
        ),
      },
    ],
    [mutating, toggleStatus]
  );

  const actions = [
    { label: 'Edit', icon: <PencilIcon />, variant: theme.button.secondary, onClick: openEditModal },
    { label: 'Delete', icon: <TrashIcon />, variant: theme.button.danger, onClick: setDeleteTarget },
  ];

  const addButton = (
    <Button
      variant={theme.button.primary}
      leftIcon={<PlusIcon />}
      onClick={openAddModal}
      disabled={isQuotaReached}
      title={isQuotaReached ? 'You have reached the number of couriers allowed' : undefined}
    >
      Add Courier
    </Button>
  );

  return (
    <div className="max-w-8xl mx-auto p-6">
      <Card
        title={<span className="font-bold">Courier Master</span>}
        subtitle={`Manage the courier companies you ship orders with${quotaText}`}
        headerActions={addButton}
      >
        {error && (
          <p
            className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}
          >
            {error}
          </p>
        )}

        {!loading && couriers.length > 0 && (
          <SearchInput
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search courier name…"
            ariaLabel="Search couriers"
            matchCount={filteredCouriers.length}
            totalCount={couriers.length}
            itemLabel="couriers"
          />
        )}

        <BulkActionBar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} actions={bulkActions} />

        <Table
          columns={columns}
          data={filteredCouriers}
          keyField="_id"
          actions={selectedIds.length > 0 ? [] : actions}
          selectable
          selectedKeys={selectedIds}
          onSelectionChange={setSelectedIds}
          loading={loading}
          pageSize={10}
          resetPageOn={searchTerm}
          emptyComponent={
            isSearching && couriers.length > 0 ? (
              <EmptyState
                size="sm"
                title="No matching couriers"
                description={`Nothing matches "${searchTerm.trim()}". Try a different name.`}
                action={
                  <Button variant={theme.button.secondary} onClick={() => handleSearchChange('')}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No couriers yet"
                description="Add the courier companies you ship with, so you can assign them to orders."
                action={addButton}
              />
            )
          }
        />
      </Card>

      <Modal
        isOpen={formModal.open}
        onClose={closeFormModal}
        title={formModal.mode === 'edit' ? 'Edit Courier' : 'Add Courier'}
        size="lg"
      >
        <CourierForm
          mode={formModal.mode}
          initialValues={formModal.courier || {}}
          onSubmit={handleFormSubmit}
          onCancel={closeFormModal}
          submitting={mutating}
        />
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Courier"
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
          <span className={`font-medium ${theme.text.heading}`}>{deleteTarget?.courierName}</span>? Orders already
          shipped with it keep its name. This action cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        title="Delete Couriers"
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
          Are you sure you want to delete <span className={`font-medium ${theme.text.heading}`}>{selectedIds.length}</span>{' '}
          courier{selectedIds.length === 1 ? '' : 's'}? Orders already shipped with them keep their names. This action
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default CouriersPage;
