import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Badge from '../../../../components/common/Badge';
import Switch from '../../../../components/common/Switch';
import Modal from '../../../../components/common/Modal';
import InputField from '../../../../components/common/InputField';
import EmptyState from '../../../../components/common/EmptyState';
import Spinner from '../../../../components/common/Spinner';
import { useFreeCash } from '../hooks/useFreeCash';
import { useFreeCashLookups } from '../hooks/useFreeCashLookups';
import FreeCashForm from '../components/FreeCashForm';
import { mapApiFreeCashToDraft } from '../utils/freeCashDraft';
import { GIVE_FREE_CASH_TO_CONFIG } from '../constants';
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

const givenToLabel = (row) => GIVE_FREE_CASH_TO_CONFIG[row.giveFreeCashTo]?.label || row.giveFreeCashTo;
const windowLabel = (row) => (row.startDate || row.endDate
  ? `${row.startDate ? new Date(row.startDate).toLocaleDateString() : '—'} – ${row.endDate ? new Date(row.endDate).toLocaleDateString() : '—'}`
  : '—');

const FreeCashPage = () => {
  const {
    freeCashList, loading, error, mutating,
    createFreeCash, editFreeCash, removeFreeCash, toggleStatus, fetchFreeCashById,
    revokeForUser, revokeForAllUsers,
  } = useFreeCash();
  const lookups = useFreeCashLookups();

  const [view, setView] = useState('list');
  const [editingDraft, setEditingDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeUserId, setRevokeUserId] = useState('');

  const openAdd = () => {
    setEditingDraft(null);
    setEditingId(null);
    setView('add');
  };

  const openEdit = async (freeCash) => {
    setLoadingEdit(true);
    const full = await fetchFreeCashById(freeCash._id);
    setLoadingEdit(false);
    if (!full) return;
    setEditingDraft(mapApiFreeCashToDraft(full));
    setEditingId(full._id);
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
    setRevokeTarget(null);
    setRevokeUserId('');
  };

  const handleRevokeAllUsers = async () => {
    if (!revokeTarget) return;
    const result = await revokeForAllUsers(revokeTarget._id);
    if (result.success) closeRevokeModal();
  };

  const handleRevokeUser = async () => {
    if (!revokeTarget || !revokeUserId.trim()) return;
    const result = await revokeForUser(revokeUserId.trim(), revokeTarget._id);
    if (result.success) closeRevokeModal();
  };

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
        render: (row) => <span className="tabular-nums">₹{row.freeCashAmount}</span>,
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
        render: (row) => <span className="tabular-nums">₹{row.validAbove ?? 0}</span>,
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
              aria-label={`Toggle status for ${row.freeCashName}`}
            />
          </div>
        ),
      },
    ],
    [mutating, toggleStatus]
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
              <Table columns={columns} data={freeCashList} keyField="_id" actions={actions} pageSize={20} />
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
                      onChange={() => toggleStatus(freeCash)}
                      disabled={mutating}
                      color={theme.switch.color}
                      aria-label={`Toggle status for ${freeCash.freeCashName}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge variant={theme.badge.default} size="sm">₹{freeCash.freeCashAmount}</Badge>
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

      <Modal isOpen={!!revokeTarget} onClose={closeRevokeModal} title="Revoke Free Cash" size="sm">
        <div className="space-y-5">
          <p className={`text-sm ${theme.text.body}`}>
            Revoking <span className={`font-medium ${theme.text.heading}`}>{revokeTarget?.freeCashName}</span> only affects grants that haven't
            already been used.
          </p>

          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className={`text-sm font-medium ${theme.text.heading}`}>Revoke for all users</p>
            <p className={`text-xs ${theme.text.muted}`}>Immediately revokes every currently unused grant of this Free Cash.</p>
            <Button variant={theme.button.danger} size="sm" onClick={handleRevokeAllUsers} loading={mutating} fullWidth>
              Revoke for All Users
            </Button>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className={`text-sm font-medium ${theme.text.heading}`}>Revoke for a specific user</p>
            <InputField
              label="User ID"
              name="revokeUserId"
              placeholder="Paste the user's ID"
              value={revokeUserId}
              onChange={(e) => setRevokeUserId(e.target.value)}
            />
            <Button variant={theme.button.danger} size="sm" onClick={handleRevokeUser} loading={mutating} disabled={!revokeUserId.trim()} fullWidth>
              Revoke for This User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FreeCashPage;
