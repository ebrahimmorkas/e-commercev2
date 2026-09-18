import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Badge from '../../../../components/common/Badge';
import Switch from '../../../../components/common/Switch';
import Avatar from '../../../../components/common/Avatar';
import Modal from '../../../../components/common/Modal';
import EmptyState from '../../../../components/common/EmptyState';
import BulkActionBar from '../../../../components/common/BulkActionBar';
import { useCategories } from '../hooks/useCategories';
import { flattenToTree } from '../utils/categoryTree';
import CategoryForm from '../components/CategoryForm';
import BulkUploadModal from '../components/BulkUploadModal';
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
const SubIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const UploadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const CategoriesPage = () => {
  const {
    categories,
    loading,
    error,
    mutating,
    createCategory,
    editCategory,
    removeCategory,
    toggleStatus,
    runBulkUpload,
    bulkToggleStatus,
    bulkRemoveCategories,
  } = useCategories();

  const [formModal, setFormModal] = useState({ open: false, mode: 'add', category: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const treeRows = useMemo(() => flattenToTree(categories), [categories]);

  const descendantCount = (categoryId) => {
    const idStr = String(categoryId);
    return categories.filter((c) => String(c.parent_category_id) === idStr).length;
  };

  const openAddModal = (parentCategory = null) => {
    setSelectedIds([]);
    setFormModal({
      open: true,
      mode: 'add',
      category: parentCategory ? { parent_category_id: parentCategory._id } : null,
    });
  };
  const openEditModal = (category) => {
    setSelectedIds([]);
    setFormModal({ open: true, mode: 'edit', category });
  };
  const closeFormModal = () => setFormModal({ open: false, mode: 'add', category: null });

  const handleFormSubmit = async (fields, imageFile) => {
    const success =
      formModal.mode === 'edit'
        ? await editCategory(formModal.category._id, fields, imageFile)
        : await createCategory(fields, imageFile);
    if (success) closeFormModal();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeCategory(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  // --- Bulk multi-select actions (checkbox column) --------------------------
  // Admin list endpoints never return status 'D' rows, so every selected
  // category is already 'A' or 'I' - eligibility only separates those two
  // for the status-toggle buttons; Delete applies to the full selection.
  // Descendant cascade (activating/deactivating/deleting a category's
  // children along with it) is handled server-side regardless of what's
  // explicitly checked here, same as the existing single-row actions.
  const selectedCategories = useMemo(
    () => categories.filter((c) => selectedIds.includes(c._id)),
    [categories, selectedIds]
  );
  const activateEligibleIds = useMemo(
    () => selectedCategories.filter((c) => c.status === 'I').map((c) => c._id),
    [selectedCategories]
  );
  const deactivateEligibleIds = useMemo(
    () => selectedCategories.filter((c) => c.status === 'A').map((c) => c._id),
    [selectedCategories]
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
    await bulkRemoveCategories(selectedIds);
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
        key: 'categoryName',
        label: 'Category',
        render: (row) => (
          <div className="flex items-center gap-2" style={{ paddingLeft: row.depth * theme.tree.indentPx }}>
            {row.depth > 0 && <span className={theme.tree.connector}>└</span>}
            <Avatar src={row.image?.url} name={row.categoryName} shape="square" size="sm" />
            <span className={`font-medium ${theme.text.heading}`}>{row.categoryName}</span>
            {row.depth === 0 ? (
              <Badge variant={theme.badge.root} size="sm">Root</Badge>
            ) : (
              <Badge variant={theme.badge.sub} size="sm">Sub</Badge>
            )}
          </div>
        ),
      },
      {
        key: 'createdAt',
        label: 'Created',
        render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'),
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
              aria-label={`Toggle status for ${row.categoryName}`}
            />
          </div>
        ),
      },
    ],
    [mutating, toggleStatus]
  );

  const actions = [
    {
      label: 'Add Sub',
      icon: <SubIcon />,
      variant: theme.button.secondary,
      onClick: openAddModal,
    },
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
        title={<span className="font-bold">Categories</span>}
        subtitle="Organize your storefront's product categories and sub-categories"
        headerActions={
          <div className="flex items-center gap-3">
            <Button variant={theme.button.secondary} leftIcon={<UploadIcon />} onClick={() => setBulkUploadOpen(true)}>
              Bulk Upload
            </Button>
            <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={() => openAddModal()}>
              Add Category
            </Button>
          </div>
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
          data={treeRows}
          keyField="_id"
          actions={selectedIds.length > 0 ? [] : actions}
          selectable
          selectedKeys={selectedIds}
          onSelectionChange={setSelectedIds}
          loading={loading}
          emptyComponent={
            <EmptyState
              title="No categories yet"
              description="Create your first category to start organizing your products."
              action={
                <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={() => openAddModal()}>
                  Add Category
                </Button>
              }
            />
          }
        />
      </Card>

      <Modal
        isOpen={formModal.open}
        onClose={closeFormModal}
        title={
          formModal.mode === 'edit'
            ? 'Edit Category'
            : formModal.category?.parent_category_id
              ? 'Add Sub-Category'
              : 'Add Category'
        }
        size="lg"
      >
        <CategoryForm
          mode={formModal.mode}
          initialValues={formModal.category || {}}
          allCategories={categories}
          onSubmit={handleFormSubmit}
          onCancel={closeFormModal}
          submitting={mutating}
        />
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Category"
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
          <span className={`font-medium ${theme.text.heading}`}>{deleteTarget?.categoryName}</span>?
          {deleteTarget && descendantCount(deleteTarget._id) > 0 && (
            <> This will also delete its sub-categories.</>
          )}{' '}
          This action cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        title="Bulk Upload Categories"
        size="lg"
      >
        <BulkUploadModal
          onSubmit={runBulkUpload}
          onClose={() => setBulkUploadOpen(false)}
          submitting={mutating}
        />
      </Modal>

      <Modal
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        title="Delete Categories"
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
          Are you sure you want to delete <span className={`font-medium ${theme.text.heading}`}>{selectedIds.length}</span> categor{selectedIds.length === 1 ? 'y' : 'ies'}? This will also delete any of their sub-categories. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default CategoriesPage;
