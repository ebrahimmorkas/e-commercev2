import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Switch from '../../../../components/common/Switch';
import Modal from '../../../../components/common/Modal';
import EmptyState from '../../../../components/common/EmptyState';
import { useBrands } from '../hooks/useBrands';
import BrandForm from '../components/BrandForm';
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

const BrandsPage = () => {
  const { brands, loading, error, mutating, createBrand, editBrand, removeBrand, toggleStatus } = useBrands();

  const [formModal, setFormModal] = useState({ open: false, mode: 'add', brand: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openAddModal = () => setFormModal({ open: true, mode: 'add', brand: null });
  const openEditModal = (brand) => setFormModal({ open: true, mode: 'edit', brand });
  const closeFormModal = () => setFormModal({ open: false, mode: 'add', brand: null });

  const handleFormSubmit = async (payload) => {
    const success =
      formModal.mode === 'edit' ? await editBrand(formModal.brand._id, payload) : await createBrand(payload);
    if (success) closeFormModal();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeBrand(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  const columns = useMemo(
    () => [
      {
        key: 'brandName',
        label: 'Brand Name',
        sortable: true,
        render: (row) => <span className={`font-medium ${theme.text.heading}`}>{row.brandName}</span>,
      },
      {
        key: 'brandShortName',
        label: 'Short Name',
        render: (row) => <span className={theme.text.body}>{row.brandShortName || '—'}</span>,
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
              aria-label={`Toggle status for ${row.brandName}`}
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
        title={<span className="font-bold">Brand Master</span>}
        subtitle="Manage the brands your products can be associated with"
        headerActions={
          <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAddModal}>
            Add Brand
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
          data={brands}
          keyField="_id"
          actions={actions}
          loading={loading}
          pageSize={10}
          emptyComponent={
            <EmptyState
              title="No brands yet"
              description="Create your first brand so it can be assigned to products."
              action={
                <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAddModal}>
                  Add Brand
                </Button>
              }
            />
          }
        />
      </Card>

      <Modal
        isOpen={formModal.open}
        onClose={closeFormModal}
        title={formModal.mode === 'edit' ? 'Edit Brand' : 'Add Brand'}
        size="lg"
      >
        <BrandForm
          mode={formModal.mode}
          initialValues={formModal.brand || {}}
          onSubmit={handleFormSubmit}
          onCancel={closeFormModal}
          submitting={mutating}
        />
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Brand"
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
          <span className={`font-medium ${theme.text.heading}`}>{deleteTarget?.brandName}</span>? This action cannot
          be undone.
        </p>
      </Modal>
    </div>
  );
};

export default BrandsPage;
