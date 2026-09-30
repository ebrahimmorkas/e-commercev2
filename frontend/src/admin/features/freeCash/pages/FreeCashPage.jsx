import { useCallback, useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Badge from '../../../../components/common/Badge';
import Switch from '../../../../components/common/Switch';
import Modal from '../../../../components/common/Modal';
import InputField from '../../../../components/common/InputField';
import EmptyState from '../../../../components/common/EmptyState';
import Spinner from '../../../../components/common/Spinner';
import BulkActionBar from '../../../../components/common/BulkActionBar';
import { useFreeCash } from '../hooks/useFreeCash';
import { useFreeCashLookups } from '../hooks/useFreeCashLookups';
import FreeCashForm from '../components/FreeCashForm';
import { mapApiFreeCashToDraft, formatFreeCashDate } from '../utils/freeCashDraft';
import { GIVE_FREE_CASH_TO_CONFIG } from '../constants';
import theme from '../theme/theme';
import { useStoreCurrency } from '../../../currency/useStoreCurrency';

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
const RevokeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

// Loose shape check for the revoke-by-email field; the server does the real match.
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const givenToLabel = (row) => GIVE_FREE_CASH_TO_CONFIG[row.giveFreeCashTo]?.label || row.giveFreeCashTo;
const windowLabel = (row) => (row.startDate || row.endDate
  ? `${formatFreeCashDate(row.startDate, row.timezone)} – ${formatFreeCashDate(row.endDate, row.timezone)}`
  : '—');

const FreeCashPage = () => {
  // Amounts are in the store currency (Company Settings).
  const { formatMoney } = useStoreCurrency();
  const {
    freeCashList, loading, error, mutating,
    createFreeCash, editFreeCash, removeFreeCash, toggleStatus, fetchFreeCashById,
    revokeForUser, revokeForAllUsers, bulkToggleStatus, bulkRemoveFreeCash,
  } = useFreeCash();
  const lookups = useFreeCashLookups();

  const [view, setView] = useState('list');
  const [editingDraft, setEditingDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeEmail, setRevokeEmail] = useState('');
  // Which revoke is running ('all' | 'user') - only that button spins, the other just waits.
  const [revokingAction, setRevokingAction] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const openAdd = () => {
    setEditingDraft(null);
    setEditingId(null);
    setSelectedIds([]);
    setView('add');
  };

  const openEdit = async (freeCash) => {
    setLoadingEdit(true);
    const full = await fetchFreeCashById(freeCash._id);
    setLoadingEdit(false);
    if (!full) return;
    setEditingDraft(mapApiFreeCashToDraft(full));
    setEditingId(full._id);
    setSelectedIds([]);
    setView('edit');
  };

  const closeForm = () => {
    setView('list');
    setEditingDraft(null);
    setEditingId(null);
  };

  const handleSubmit = async (fields, excelFile) => {
    const result = view === 'edit' ? await editFreeCash(editingId, fields, excelFile) : await createFreeCash(fields, excelFile);
    if (result.success) closeForm();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeFreeCash(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  const closeRevokeModal = () => {
    if (revokingAction) return;
    setRevokeTarget(null);
    setRevokeEmail('');
  };

  const runRevoke = async (action, request) => {
    if (!revokeTarget || revokingAction) return;
    setRevokingAction(action);
    try {
      const result = await request();
      if (result.success) {
        setRevokeTarget(null);
        setRevokeEmail('');
      }
    } finally {
      setRevokingAction(null);
    }
  };

  const handleRevokeAllUsers = () => runRevoke('all', () => revokeForAllUsers(revokeTarget._id));

  const handleRevokeUser = () => {
    if (!isEmail(revokeEmail)) return;
    return runRevoke('user', () => revokeForUser(revokeEmail.trim().toLowerCase(), revokeTarget._id));
  };

  // --- Bulk multi-select actions (checkbox column) --------------------------
  // Admin list endpoints never return status 'D' rows, so every selected
  // campaign is already 'A' or 'I' - eligibility only separates those two
  // for the status-toggle buttons; Delete applies to the full selection.
  // Revoke is not a bulk action - it targets specific grants, not the
  // campaign's own status, so it isn't offered here.
  const selectedFreeCash = useMemo(
    () => freeCashList.filter((f) => selectedIds.includes(f._id)),
    [freeCashList, selectedIds]
  );
  const activateEligibleIds = useMemo(
    () => selectedFreeCash.filter((f) => f.status === 'I').map((f) => f._id),
    [selectedFreeCash]
  );
  const deactivateEligibleIds = useMemo(
    () => selectedFreeCash.filter((f) => f.status === 'A').map((f) => f._id),
    [selectedFreeCash]
  );

  // Tracks which specific bulk action is in flight so only that button shows
  // a spinner - `mutating` alone is shared across every mutation in the hook
  // and would otherwise light up every bulk button at once for any one of them.
  const [bulkAction, setBulkAction] = useState(null);


  // Activating (switch or bulk "Mark Active") asks whether to email the
  // customers again - the list has no form with the checkbox. Holds
  // { label, run(notifyCustomers) } while the question is open.
  const [activateConfirm, setActivateConfirm] = useState(null);
  const [activating, setActivating] = useState(false);

  const handleToggleStatus = useCallback((item) => {
    if (item.status === 'A') return toggleStatus(item);
    setActivateConfirm({ label: `"${item.freeCashName}"`, run: (notifyCustomers) => toggleStatus(item, notifyCustomers) });
    return undefined;
  }, [toggleStatus]);

  const handleConfirmActivate = async (notifyCustomers) => {
    setActivating(true);
    await activateConfirm.run(notifyCustomers);
    setActivating(false);
    setActivateConfirm(null);
  };

  const handleBulkActivate = () => {
    const ids = activateEligibleIds;
    setActivateConfirm({
      label: `${ids.length} Free Cash campaign${ids.length === 1 ? '' : 's'}`,
      run: async (notifyCustomers) => {
        setBulkAction('activate');
        await bulkToggleStatus(ids, 'A', notifyCustomers);
        setBulkAction(null);
        setSelectedIds([]);
      },
    });
  };

  const handleBulkDeactivate = async () => {
    setBulkAction('deactivate');
    await bulkToggleStatus(deactivateEligibleIds, 'I');
    setBulkAction(null);
    setSelectedIds([]);
  };

  const handleConfirmBulkDelete = async () => {
    setBulkAction('delete');
    await bulkRemoveFreeCash(selectedIds);
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
        key: 'freeCashName',
        label: 'Free Cash',
        render: (row) => (
          <div className="min-w-0">
            <p className={`font-medium truncate ${theme.text.heading}`}>{row.freeCashName}</p>
            <p className={`text-xs truncate ${theme.text.muted}`}>{givenToLabel(row)}</p>
          </div>
        ),
      },
      {
        key: 'freeCashAmount',
        label: 'Amount',
        render: (row) => <span className="tabular-nums">{formatMoney(row.freeCashAmount)}</span>,
      },
      {
        key: 'window',
        label: 'Window',
        render: (row) => windowLabel(row),
      },
      {
        key: 'validAbove',
        label: 'Valid Above',
        align: 'center',
        render: (row) => <span className="tabular-nums">{formatMoney(row.validAbove ?? 0)}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        align: 'center',
        render: (row) => (
          <div className="flex items-center justify-center">
            <Switch
              checked={row.status === 'A'}
              onChange={() => handleToggleStatus(row)}
              disabled={mutating}
              color={theme.switch.color}
              aria-label={`Toggle status for ${row.freeCashName}`}
            />
          </div>
        ),
      },
    ],
    [mutating, handleToggleStatus, formatMoney]
  );

  const actions = [
    { label: 'Edit', icon: <PencilIcon />, variant: theme.button.secondary, onClick: openEdit },
    { label: 'Revoke', icon: <RevokeIcon />, variant: theme.button.outline, onClick: setRevokeTarget },
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
          <Button type="button" isIconOnly size="sm" variant={theme.button.ghost} ariaLabel="Back to Free Cash" onClick={closeForm}>
            <BackIcon />
          </Button>
          <div>
            <p className={`text-xs ${theme.text.muted}`}>Free Cash</p>
            <h1 className={`text-xl font-bold leading-tight ${theme.text.heading}`}>{view === 'edit' ? 'Edit Free Cash' : 'Add Free Cash'}</h1>
          </div>
        </div>
        {lookups.error && (
          <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>{lookups.error}</p>
        )}
        <FreeCashForm mode={view} initialDraft={editingDraft} lookups={lookups} onSubmit={handleSubmit} onCancel={closeForm} submitting={mutating} />
      </div>
    );
  }

  return (
    <div className="max-w-8xl mx-auto p-4 sm:p-6">
      <Card
        title={<span className="font-bold">Free Cash</span>}
        subtitle="Create and manage Free Cash campaigns given to your customers"
        headerActions={
          <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAdd}>
            Add Free Cash
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
        ) : freeCashList.length === 0 ? (
          <EmptyState
            title="No Free Cash campaigns yet"
            description="Create your first Free Cash campaign to start rewarding customers."
            action={
              <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAdd}>
                Add Free Cash
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <BulkActionBar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} actions={bulkActions} />
              <Table
                columns={columns}
                data={freeCashList}
                keyField="_id"
                actions={selectedIds.length > 0 ? [] : actions}
                selectable
                selectedKeys={selectedIds}
                onSelectionChange={setSelectedIds}
                pageSize={20}
              />
            </div>

            <div className="md:hidden space-y-3">
              {freeCashList.map((freeCash) => (
                <div key={freeCash._id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${theme.text.heading}`}>{freeCash.freeCashName}</p>
                      <p className={`text-xs truncate ${theme.text.muted}`}>{givenToLabel(freeCash)}</p>
                    </div>
                    <Switch
                      checked={freeCash.status === 'A'}
                      onChange={() => handleToggleStatus(freeCash)}
                      disabled={mutating}
                      color={theme.switch.color}
                      aria-label={`Toggle status for ${freeCash.freeCashName}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge variant={theme.badge.default} size="sm">{formatMoney(freeCash.freeCashAmount)}</Badge>
                    <Badge variant="gray" size="sm">{windowLabel(freeCash)}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <Button variant={theme.button.secondary} size="sm" leftIcon={<PencilIcon />} onClick={() => openEdit(freeCash)} fullWidth>
                      Edit
                    </Button>
                    <Button variant={theme.button.outline} size="sm" leftIcon={<RevokeIcon />} onClick={() => setRevokeTarget(freeCash)} fullWidth>
                      Revoke
                    </Button>
                    <Button variant={theme.button.danger} size="sm" leftIcon={<TrashIcon />} onClick={() => setDeleteTarget(freeCash)} fullWidth>
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
        title="Delete Free Cash"
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
          Are you sure you want to delete <span className={`font-medium ${theme.text.heading}`}>{deleteTarget?.freeCashName}</span>? This action
          cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        title="Delete Free Cash Campaigns"
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
          Are you sure you want to delete <span className={`font-medium ${theme.text.heading}`}>{selectedIds.length}</span> campaign{selectedIds.length === 1 ? '' : 's'}? This action cannot be undone.
        </p>
      </Modal>

      <Modal isOpen={!!revokeTarget} onClose={closeRevokeModal} title="Revoke Free Cash" size="sm">
        <div className="space-y-5">
          <p className={`text-sm ${theme.text.body}`}>
            Revoking <span className={`font-medium ${theme.text.heading}`}>{revokeTarget?.freeCashName}</span> only affects grants that haven't
            already been used.
          </p>

          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className={`text-sm font-medium ${theme.text.heading}`}>Revoke for all users</p>
            <p className={`text-xs ${theme.text.muted}`}>Immediately revokes every currently unused grant of this Free Cash.</p>
            <Button
              variant={theme.button.danger}
              size="sm"
              onClick={handleRevokeAllUsers}
              loading={revokingAction === 'all'}
              disabled={!!revokingAction}
              fullWidth
            >
              Revoke for All Users
            </Button>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className={`text-sm font-medium ${theme.text.heading}`}>Revoke for a specific customer</p>
            <p className={`text-xs ${theme.text.muted}`}>Removes this customer&apos;s unused balance of this Free Cash. Amounts already used are not affected.</p>
            <InputField
              label="Customer Email"
              name="revokeEmail"
              type="email"
              placeholder="e.g. customer@example.com"
              value={revokeEmail}
              onChange={(e) => setRevokeEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isEmail(revokeEmail) && !revokingAction) handleRevokeUser();
              }}
              showError={false}
            />
            {revokeEmail.trim() && !isEmail(revokeEmail) && (
              <p className="-mt-1 text-xs text-red-600">Enter a valid email address.</p>
            )}
            <Button
              variant={theme.button.danger}
              size="sm"
              onClick={handleRevokeUser}
              loading={revokingAction === 'user'}
              disabled={!isEmail(revokeEmail) || !!revokingAction}
              fullWidth
            >
              Revoke for This Customer
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={!!activateConfirm}
        onClose={() => !activating && setActivateConfirm(null)}
        title="Email customers?"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={() => setActivateConfirm(null)} disabled={activating}>
              Cancel
            </Button>
            <Button variant={theme.button.secondary} onClick={() => handleConfirmActivate(false)} disabled={activating}>
              Activate only
            </Button>
            <Button variant={theme.button.primary} onClick={() => handleConfirmActivate(true)} loading={activating}>
              Activate and notify
            </Button>
          </>
        }
      >
        <p className={`text-sm ${theme.text.body}`}>
          You are activating {activateConfirm?.label}. Do you also want to email the customers it is for? (Who gets
          the email is set in Company Settings &gt; Discount and Free Cash.)
        </p>
      </Modal>
    </div>
  );
};

export default FreeCashPage;
