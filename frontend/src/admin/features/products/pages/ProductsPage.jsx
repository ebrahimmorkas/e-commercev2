import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Badge from '../../../../components/common/Badge';
import Switch from '../../../../components/common/Switch';
import Modal from '../../../../components/common/Modal';
import EmptyState from '../../../../components/common/EmptyState';
import Spinner from '../../../../components/common/Spinner';
import { useProducts } from '../hooks/useProducts';
import { useProductLookups } from '../hooks/useProductLookups';
import ProductForm from '../components/ProductForm';
import { mapApiProductToDraft } from '../utils/productDraft';
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

const priceRangeOf = (product) => {
  const prices = allSizes(product).map((s) => s.price).filter((p) => typeof p === 'number');
  if (prices.length === 0) return '—';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `₹${min}` : `₹${min} - ₹${max}`;
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
  const { products, loading, error, mutating, createProduct, editProduct, removeProduct, toggleStatus, fetchProductById } = useProducts();
  const lookups = useProductLookups();

  const [view, setView] = useState('list');
  const [editingDraft, setEditingDraft] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const categoryNameById = useMemo(() => {
    const map = new Map();
    (lookups.categories || []).forEach((c) => map.set(String(c._id), c.categoryName));
    return map;
  }, [lookups.categories]);

  const openAdd = () => {
    setEditingDraft(null);
    setView('add');
  };

  const openEdit = async (product) => {
    setLoadingEdit(true);
    const full = await fetchProductById(product._id);
    setLoadingEdit(false);
    if (!full) return;
    setEditingDraft(mapApiProductToDraft(full));
    setView('edit');
  };

  const closeForm = () => {
    setView('list');
    setEditingDraft(null);
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
        render: (row) => <span className="tabular-nums">{priceRangeOf(row)}</span>,
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
    [categoryNameById, mutating, toggleStatus]
  );

  const actions = [
    { label: 'Edit', icon: <PencilIcon />, variant: theme.button.secondary, onClick: openEdit },
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
          <Button type="button" isIconOnly size="sm" variant={theme.button.ghost} ariaLabel="Back to products" onClick={closeForm}>
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
          products={products}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          submitting={mutating}
        />
      </div>
    );
  }

  return (
    <div className="max-w-8xl mx-auto p-4 sm:p-6">
      <Card
        title={<span className="font-bold">Products</span>}
        subtitle="Manage your storefront's products, variants and sizes"
        headerActions={
          <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAdd}>
            Add Product
          </Button>
        }
      >
        {error && (
          <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : products.length === 0 ? (
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
            {/* Desktop / tablet: full data table */}
            <div className="hidden md:block">
              <Table columns={columns} data={products} keyField="_id" actions={actions} pageSize={20} />
            </div>

            {/* Mobile: card list - a 6-column table never reads well this narrow */}
            <div className="md:hidden space-y-3">
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
                        <span className={`font-medium tabular-nums ${theme.text.heading}`}>{priceRangeOf(product)}</span>
                        <span className={`tabular-nums ${theme.text.muted}`}>Stock {stockOf(product)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <Button variant={theme.button.secondary} size="sm" leftIcon={<PencilIcon />} onClick={() => openEdit(product)} fullWidth>
                      Edit
                    </Button>
                    <Button variant={theme.button.danger} size="sm" leftIcon={<TrashIcon />} onClick={() => setDeleteTarget(product)} fullWidth>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
    </div>
  );
};

export default ProductsPage;
