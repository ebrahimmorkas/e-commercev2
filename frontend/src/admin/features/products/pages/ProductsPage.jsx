import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Badge from '../../../../components/common/Badge';
import Switch from '../../../../components/common/Switch';
import Modal from '../../../../components/common/Modal';
import BulkActionBar from '../../../../components/common/BulkActionBar';
import EmptyState from '../../../../components/common/EmptyState';
import SearchInput from '../../../../components/common/SearchInput';
import Spinner from '../../../../components/common/Spinner';
import Pagination from '../../../../components/common/Pagination';
import { useProducts, ADMIN_PRODUCTS_PAGE_SIZE } from '../hooks/useProducts';
import { useProductLookups } from '../hooks/useProductLookups';
import ProductForm from '../components/ProductForm';
import BulkUploadProductsModal from '../components/BulkUploadProductsModal';
import { mapApiProductToDraft } from '../utils/productDraft';
import theme from '../theme/theme';
import { useStoreCurrency } from '../../../currency/useStoreCurrency';

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const UploadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
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
const CloneIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ImagePlaceholderIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 8h16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
  </svg>
);

const allSizes = (product) => (product.variants || []).flatMap((v) => v.sizes || []);

const thumbnailOf = (product) => {
  const sizes = allSizes(product);
  const defaultSize = sizes.find((s) => s.isDefaultSize) || sizes[0];
  return defaultSize?.image?.url || null;
};

const priceRangeOf = (product, formatMoney) => {
  const prices = allSizes(product).map((s) => s.price).filter((p) => typeof p === 'number');
  if (prices.length === 0) return '—';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoney(min) : `${formatMoney(min)} - ${formatMoney(max)}`;
};

const stockOf = (product) => allSizes(product).reduce((sum, s) => sum + (s.stock || 0), 0);

const Thumbnail = ({ product, size = 'w-10 h-10' }) => {
  const url = thumbnailOf(product);
  return url ? (
    <img src={url} alt={product.name} className={`${size} object-cover rounded-lg border border-gray-200 flex-shrink-0`} />
  ) : (
    <div className={`${size} rounded-lg bg-gray-100 text-gray-300 flex items-center justify-center flex-shrink-0`}>
      <ImagePlaceholderIcon />
    </div>
  );
};

const ProductsPage = () => {
  // Prices are in the store currency (Company Settings).
  const { formatMoney } = useStoreCurrency();
  const {
    products, pagination, catalogTotal, page, setPage, searchText, setSearchText, loading, initialLoading,
    error, mutating, createProduct, editProduct, removeProduct, toggleStatus, cloneProduct, fetchProductById,
    bulkToggleStatus, bulkRemoveProducts, bulkCloneProducts, runBulkUpload,
  } = useProducts();
  const lookups = useProductLookups();

  const [view, setView] = useState('list');
  const [editingDraft, setEditingDraft] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cloneTarget, setCloneTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkCloneConfirmOpen, setBulkCloneConfirmOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  // Whether the open add/edit form has anything typed into it, and whether the "discard?" prompt is showing.
  const [formDirty, setFormDirty] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const categoryNameById = useMemo(() => {
    const map = new Map();
    (lookups.categories || []).forEach((c) => map.set(String(c._id), c.categoryName));
    return map;
  }, [lookups.categories]);

  // Search and paging run on the server, and a bulk action must never reach
  // rows the admin can no longer see - so both clear the selection.
  const handleSearchChange = (value) => {
    setSearchText(value);
    setSelectedIds([]);
  };

  const handlePageChange = (nextPage) => {
    setPage(nextPage);
    setSelectedIds([]);
  };

  const openAdd = () => {
    setEditingDraft(null);
    setSelectedIds([]);
    // A leftover search would hide the product the admin is about to add.
    setSearchText('');
    setView('add');
  };

  const openEdit = async (product) => {
    setLoadingEdit(true);
    const full = await fetchProductById(product._id);
    setLoadingEdit(false);
    if (!full) return;
    setEditingDraft(mapApiProductToDraft(full));
    setSelectedIds([]);
    setView('edit');
  };

  const closeForm = () => {
    setView('list');
    setEditingDraft(null);
    setFormDirty(false);
    setDiscardConfirmOpen(false);
  };

  // Cancel and the back arrow both come through here: a form with typed-in data asks first, since it's three
  // steps of work that one stray click would otherwise throw away.
  const requestCloseForm = () => {
    if (formDirty) setDiscardConfirmOpen(true);
    else closeForm();
  };

  const handleSubmit = async (payload, mainImages, additionalImageUploads) => {
    const success =
      view === 'edit'
        ? await editProduct(payload, mainImages, additionalImageUploads)
        : await createProduct(payload, mainImages, additionalImageUploads);
    if (success) closeForm();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeProduct(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  const handleConfirmClone = async () => {
    if (!cloneTarget) return;
    const success = await cloneProduct(cloneTarget._id);
    if (success) setCloneTarget(null);
  };

  // --- Bulk multi-select actions (checkbox column) --------------------------
  // Admin list endpoints never return status 'D' rows in the first place, so
  // every selected product is already either 'A' or 'I' - eligibility only
  // needs to separate those two for the status-toggle buttons; Delete/Clone
  // apply to the full selection either way.
  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.includes(p._id)),
    [products, selectedIds]
  );
  const activateEligibleIds = useMemo(
    () => selectedProducts.filter((p) => p.status === 'I').map((p) => p._id),
    [selectedProducts]
  );
  const deactivateEligibleIds = useMemo(
    () => selectedProducts.filter((p) => p.status === 'A').map((p) => p._id),
    [selectedProducts]
  );
  const isCloningAllowed = lookups.companyMaster?.featureAccess?.isCloningProductAllowed ?? !!lookups.companyMaster?.isCloningProductAllowed;

  // Tracks which specific bulk action is in flight so only that button shows
  // a spinner - `mutating` alone is shared across every mutation in the hook
  // and would otherwise light up all four buttons at once for any one of them.
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
    await bulkRemoveProducts(selectedIds);
    setBulkAction(null);
    setBulkDeleteConfirmOpen(false);
    setSelectedIds([]);
  };

  const handleConfirmBulkClone = async () => {
    setBulkAction('clone');
    await bulkCloneProducts(selectedIds);
    setBulkAction(null);
    setBulkCloneConfirmOpen(false);
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
      key: 'clone',
      label: `Clone (${selectedIds.length})`,
      icon: <CloneIcon />,
      variant: theme.button.outline,
      onClick: () => setBulkCloneConfirmOpen(true),
      disabled: mutating,
      hidden: !isCloningAllowed || selectedIds.length === 0,
    },
    {
      key: 'delete',
      label: `Delete (${selectedIds.length})`,
      icon: <TrashIcon />,
      variant: theme.button.danger,
      onClick: () => setBulkDeleteConfirmOpen(true),
      disabled: mutating,
      hidden: selectedIds.length === 0,
    },
  ];

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Product',
        render: (row) => (
          <div className="flex items-center gap-3">
            <Thumbnail product={row} />
            <div className="min-w-0">
              <p className={`font-medium truncate ${theme.text.heading}`}>{row.name}</p>
              <p className={`text-xs truncate ${theme.text.muted}`}>{row.productCode}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'category',
        label: 'Category',
        render: (row) => (row.mainCategory ? categoryNameById.get(String(row.mainCategory)) || '—' : '—'),
      },
      {
        key: 'variants',
        label: 'Variants',
        align: 'center',
        render: (row) => (row.variants || []).length,
      },
      {
        key: 'price',
        label: 'Price',
        render: (row) => <span className="tabular-nums">{priceRangeOf(row, formatMoney)}</span>,
      },
      {
        key: 'stock',
        label: 'Stock',
        align: 'center',
        render: (row) => <span className="tabular-nums">{stockOf(row)}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        align: 'center',
        render: (row) => (
          <div className="flex items-center justify-center">
            <Switch checked={row.status === 'A'} onChange={() => toggleStatus(row)} disabled={mutating} color={theme.switch.color} aria-label={`Toggle status for ${row.name}`} />
          </div>
        ),
      },
    ],
    [categoryNameById, mutating, toggleStatus, formatMoney]
  );

  const noMatchesState = (
    <EmptyState
      size="sm"
      title="No matching products"
      description={`Nothing matches "${searchText.trim()}". Try a different name, code, SKU, brand or category.`}
      action={
        <Button variant={theme.button.secondary} onClick={() => handleSearchChange('')}>
          Clear search
        </Button>
      }
    />
  );

  const actions = [
    { label: 'Edit', icon: <PencilIcon />, variant: theme.button.secondary, onClick: openEdit },
    ...(isCloningAllowed ? [{ label: 'Clone', icon: <CloneIcon />, variant: theme.button.secondary, onClick: setCloneTarget }] : []),
    { label: 'Delete', icon: <TrashIcon />, variant: theme.button.danger, onClick: setDeleteTarget },
  ];

  if (view === 'add' || view === 'edit') {
    if (lookups.loading || loadingEdit) {
      return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      );
    }
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Button type="button" isIconOnly size="sm" variant={theme.button.ghost} ariaLabel="Back to products" onClick={requestCloseForm}>
            <BackIcon />
          </Button>
          <div>
            <p className={`text-xs ${theme.text.muted}`}>Products</p>
            <h1 className={`text-xl font-bold leading-tight ${theme.text.heading}`}>{view === 'edit' ? 'Edit Product' : 'Add Product'}</h1>
          </div>
        </div>
        {lookups.error && (
          <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>{lookups.error}</p>
        )}
        <ProductForm
          mode={view}
          initialDraft={editingDraft}
          lookups={lookups}
          onSubmit={handleSubmit}
          onCancel={requestCloseForm}
          onDirtyChange={setFormDirty}
          submitting={mutating}
        />

        <Modal
          isOpen={discardConfirmOpen}
          onClose={() => setDiscardConfirmOpen(false)}
          title="Discard changes?"
          size="sm"
          footer={
            <>
              <Button variant={theme.button.ghost} onClick={() => setDiscardConfirmOpen(false)}>
                Keep editing
              </Button>
              <Button variant={theme.button.danger} onClick={closeForm}>
                Discard
              </Button>
            </>
          }
        >
          <p className={`text-sm ${theme.text.body}`}>
            {view === 'edit' ? "You have unsaved changes to this product. If you leave now they'll be lost." : "This product hasn't been saved yet. If you leave now everything you've entered will be lost."}
          </p>
        </Modal>
      </div>
    );
  }

  return (
    <div className="max-w-8xl mx-auto p-4 sm:p-6">
      <Card
        title={<span className="font-bold">Products</span>}
        subtitle="Manage your storefront's products, variants and sizes"
        headerActions={
          <div className="flex items-center gap-3">
            <Button variant={theme.button.secondary} leftIcon={<UploadIcon />} onClick={() => setBulkUploadOpen(true)}>
              Bulk Upload
            </Button>
            <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAdd}>
              Add Product
            </Button>
          </div>
        }
      >
        {error && (
          <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>{error}</p>
        )}

        {initialLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : catalogTotal === 0 && !searchText && products.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Create your first product to start selling."
            action={
              <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAdd}>
                Add Product
              </Button>
            }
          />
        ) : (
          <>
            <SearchInput
              value={searchText}
              onChange={handleSearchChange}
              placeholder="Search name, code, SKU, barcode, brand, category…"
              ariaLabel="Search products"
              matchCount={pagination?.total ?? 0}
              totalCount={catalogTotal}
              itemLabel="products"
            />

            {/* Desktop / tablet: full data table */}
            <div className="hidden md:block">
              <BulkActionBar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} actions={bulkActions} />
              <div className={`transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`} aria-busy={loading}>
                <Table
                  columns={columns}
                  data={products}
                  emptyComponent={loading ? null : noMatchesState}
                  keyField="_id"
                  actions={selectedIds.length > 0 ? [] : actions}
                  selectable
                  selectedKeys={selectedIds}
                  onSelectionChange={setSelectedIds}
                />
              </div>
            </div>

            {/* Mobile: card list - a 6-column table never reads well this narrow */}
            <div className={`md:hidden space-y-3 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              {!loading && products.length === 0 && noMatchesState}
              {products.map((product) => (
                <div key={product._id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start gap-3">
                    <Thumbnail product={product} size="w-12 h-12" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`font-medium truncate ${theme.text.heading}`}>{product.name}</p>
                          <p className={`text-xs truncate ${theme.text.muted}`}>{product.productCode}</p>
                        </div>
                        <Switch
                          checked={product.status === 'A'}
                          onChange={() => toggleStatus(product)}
                          disabled={mutating}
                          color={theme.switch.color}
                          aria-label={`Toggle status for ${product.name}`}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {product.mainCategory && (
                          <Badge variant="gray" size="sm">{categoryNameById.get(String(product.mainCategory)) || '—'}</Badge>
                        )}
                        <Badge variant="blue" size="sm">{(product.variants || []).length} variant{(product.variants || []).length === 1 ? '' : 's'}</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-sm">
                        <span className={`font-medium tabular-nums ${theme.text.heading}`}>{priceRangeOf(product, formatMoney)}</span>
                        <span className={`tabular-nums ${theme.text.muted}`}>Stock {stockOf(product)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <Button variant={theme.button.secondary} size="sm" leftIcon={<PencilIcon />} onClick={() => openEdit(product)} fullWidth>
                      Edit
                    </Button>
                    {isCloningAllowed && (
                      <Button variant={theme.button.secondary} size="sm" leftIcon={<CloneIcon />} onClick={() => setCloneTarget(product)} fullWidth>
                        Clone
                      </Button>
                    )}
                    <Button variant={theme.button.danger} size="sm" leftIcon={<TrashIcon />} onClick={() => setDeleteTarget(product)} fullWidth>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className={`text-sm ${theme.text.muted}`}>
                  {((page - 1) * ADMIN_PRODUCTS_PAGE_SIZE + 1).toLocaleString('en-IN')}–
                  {Math.min(page * ADMIN_PRODUCTS_PAGE_SIZE, pagination.total).toLocaleString('en-IN')} of {pagination.total.toLocaleString('en-IN')} products
                </p>
                <Pagination
                  currentPage={page}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                  disabled={loading}
                  size="sm"
                />
              </div>
            )}
          </>
        )}
      </Card>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Product"
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
          Are you sure you want to delete <span className={`font-medium ${theme.text.heading}`}>{deleteTarget?.name}</span>? This action cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={!!cloneTarget}
        onClose={() => setCloneTarget(null)}
        title="Clone Product"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={() => setCloneTarget(null)} disabled={mutating}>
              Cancel
            </Button>
            <Button variant={theme.button.primary} onClick={handleConfirmClone} loading={mutating}>
              Clone
            </Button>
          </>
        }
      >
        <p className={`text-sm ${theme.text.body}`}>
          Clone <span className={`font-medium ${theme.text.heading}`}>{cloneTarget?.name}</span>? This will create a new product named <span className={`font-medium ${theme.text.heading}`}>"{cloneTarget?.name} - Copy N"</span>, numbered after any existing copies.
        </p>
      </Modal>

      <Modal
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        title="Delete Products"
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
          Are you sure you want to delete <span className={`font-medium ${theme.text.heading}`}>{selectedIds.length}</span> product{selectedIds.length === 1 ? '' : 's'}? This action cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={bulkCloneConfirmOpen}
        onClose={() => setBulkCloneConfirmOpen(false)}
        title="Clone Products"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={() => setBulkCloneConfirmOpen(false)} disabled={mutating}>
              Cancel
            </Button>
            <Button variant={theme.button.primary} onClick={handleConfirmBulkClone} loading={mutating}>
              Clone
            </Button>
          </>
        }
      >
        <p className={`text-sm ${theme.text.body}`}>
          Clone <span className={`font-medium ${theme.text.heading}`}>{selectedIds.length}</span> selected product{selectedIds.length === 1 ? '' : 's'}? Each will be created as a new, independent product.
        </p>
      </Modal>

      <Modal
        isOpen={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        title="Bulk Upload Products"
        size="lg"
      >
        <BulkUploadProductsModal
          onSubmit={runBulkUpload}
          onClose={() => setBulkUploadOpen(false)}
          submitting={mutating}
        />
      </Modal>
    </div>
  );
};

export default ProductsPage;
