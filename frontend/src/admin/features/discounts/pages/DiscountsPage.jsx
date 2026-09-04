import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Badge from '../../../../components/common/Badge';
import Switch from '../../../../components/common/Switch';
import Modal from '../../../../components/common/Modal';
import EmptyState from '../../../../components/common/EmptyState';
import Spinner from '../../../../components/common/Spinner';
import { useDiscounts } from '../hooks/useDiscounts';
import { useDiscountLookups } from '../hooks/useDiscountLookups';
import DiscountForm from '../components/DiscountForm';
import { mapApiDiscountToDraft } from '../utils/discountDraft';
import { GIVE_DISCOUNT_TO_CONFIG, DISCOUNT_FLOW_OPTIONS } from '../constants';
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

const flowLabel = (doc) => {
  const flow = doc.isOngoingDiscount ? 'ONGOING' : doc.isMinimumDiscountQuantityDiscount ? 'MIN_QTY' : doc.isCouponCodeDiscount ? 'COUPON' : 'SCHEDULED';
  return DISCOUNT_FLOW_OPTIONS.find((f) => f.value === flow)?.label || flow;
};

const valueLabel = (doc) => (doc.discountType === 'PERCENTAGE' ? `${doc.discountValue}% off` : `₹${doc.discountValue} off`);

const DiscountsPage = () => {
  const { discounts, loading, error, mutating, createDiscount, editDiscount, removeDiscount, toggleStatus, fetchDiscountById } = useDiscounts();
  const lookups = useDiscountLookups();

  const [view, setView] = useState('list');
  const [editingDraft, setEditingDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openAdd = () => {
    setEditingDraft(null);
    setEditingId(null);
    setView('add');
  };

  const openEdit = async (discount) => {
    setLoadingEdit(true);
    const full = await fetchDiscountById(discount._id);
    setLoadingEdit(false);
    if (!full) return;
    setEditingDraft(mapApiDiscountToDraft(full));
    setEditingId(full._id);
    setView('edit');
  };

  const closeForm = () => {
    setView('list');
    setEditingDraft(null);
    setEditingId(null);
  };

  const handleSubmit = async (fields, excelFile) => {
    const result = view === 'edit' ? await editDiscount(editingId, fields, excelFile) : await createDiscount(fields, excelFile);
    if (result.success) closeForm();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeDiscount(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Discount',
        render: (row) => (
          <div className="min-w-0">
            <p className={`font-medium truncate ${theme.text.heading}`}>{row.name}</p>
            <p className={`text-xs truncate ${theme.text.muted}`}>{GIVE_DISCOUNT_TO_CONFIG[row.giveDiscountTo]?.label || row.giveDiscountTo}</p>
          </div>
        ),
      },
      {
        key: 'discountValue',
        label: 'Value',
        render: (row) => <span className="tabular-nums">{valueLabel(row)}</span>,
      },
      {
        key: 'flow',
        label: 'Flow',
        render: (row) => <Badge variant={theme.badge.default} size="sm">{flowLabel(row)}</Badge>,
      },
      {
        key: 'window',
        label: 'Window',
        render: (row) =>
          row.isOngoingDiscount
            ? 'Ongoing'
            : row.startDate || row.endDate
              ? `${row.startDate ? new Date(row.startDate).toLocaleDateString() : '—'} – ${row.endDate ? new Date(row.endDate).toLocaleDateString() : '—'}`
              : '—',
      },
      {
        key: 'precedence',
        label: 'Precedence',
        align: 'center',
        render: (row) => <span className="tabular-nums">{row.precedence ?? 0}</span>,
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
              aria-label={`Toggle status for ${row.name}`}
            />
          </div>
        ),
      },
    ],
    [mutating, toggleStatus]
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
          <Button type="button" isIconOnly size="sm" variant={theme.button.ghost} ariaLabel="Back to discounts" onClick={closeForm}>
            <BackIcon />
          </Button>
          <div>
            <p className={`text-xs ${theme.text.muted}`}>Discounts</p>
            <h1 className={`text-xl font-bold leading-tight ${theme.text.heading}`}>{view === 'edit' ? 'Edit Discount' : 'Add Discount'}</h1>
          </div>
        </div>
        {lookups.error && (
          <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>{lookups.error}</p>
        )}
        <DiscountForm mode={view} initialDraft={editingDraft} lookups={lookups} onSubmit={handleSubmit} onCancel={closeForm} submitting={mutating} />
      </div>
    );
  }

  return (
    <div className="max-w-8xl mx-auto p-4 sm:p-6">
      <Card
        title={<span className="font-bold">Discounts</span>}
        subtitle="Create and manage storewide, product, category and coupon-code discounts"
        headerActions={
          <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAdd}>
            Add Discount
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
        ) : discounts.length === 0 ? (
          <EmptyState
            title="No discounts yet"
            description="Create your first discount to start offering savings to customers."
            action={
              <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAdd}>
                Add Discount
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table columns={columns} data={discounts} keyField="_id" actions={actions} pageSize={20} />
            </div>

            <div className="md:hidden space-y-3">
              {discounts.map((discount) => (
                <div key={discount._id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${theme.text.heading}`}>{discount.name}</p>
                      <p className={`text-xs truncate ${theme.text.muted}`}>{GIVE_DISCOUNT_TO_CONFIG[discount.giveDiscountTo]?.label || discount.giveDiscountTo}</p>
                    </div>
                    <Switch
                      checked={discount.status === 'A'}
                      onChange={() => toggleStatus(discount)}
                      disabled={mutating}
                      color={theme.switch.color}
                      aria-label={`Toggle status for ${discount.name}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge variant={theme.badge.default} size="sm">{valueLabel(discount)}</Badge>
                    <Badge variant="gray" size="sm">{flowLabel(discount)}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <Button variant={theme.button.secondary} size="sm" leftIcon={<PencilIcon />} onClick={() => openEdit(discount)} fullWidth>
                      Edit
                    </Button>
                    <Button variant={theme.button.danger} size="sm" leftIcon={<TrashIcon />} onClick={() => setDeleteTarget(discount)} fullWidth>
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
        title="Delete Discount"
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

export default DiscountsPage;
