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
import SearchInput from '../../../../components/common/SearchInput';
import { useDeliveryAgents } from '../hooks/useDeliveryAgents';
import { useCustomerLookups } from '../../customers/hooks/useCustomerLookups';
import { filterBySearch } from '../../../../utils/searchFilter';
import DeliveryAgentForm from '../components/DeliveryAgentForm';
import theme from '../../customers/theme/theme';

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
const KeyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const validateNewPassword = (value) => {
  if (!value || value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > 128) return 'Password must not exceed 128 characters';
  if (!PASSWORD_PATTERN.test(value)) return 'Password must contain at least one uppercase letter, one lowercase letter and one number';
  return '';
};

const filterAgents = (agents, term) => filterBySearch(agents, term, (a) => [a.name, a.username, a.email, a.phone_no, a.whatsapp_no]);

/**
 * The vendor's own delivery agents: create, edit, activate/deactivate, change
 * password, delete. The plan limit (CompanyMaster.numberOfDeliveryAgentsAllowed)
 * counts active and inactive agents. An agent who still has orders to deliver
 * can't be deactivated or deleted (the server refuses and says why).
 */
const DeliveryAgentsPage = () => {
  const { agents, limit, used, loading, error, mutating, fetchAgentById, addAgent, editAgent, changeAgentPassword, toggleStatus, removeAgent } = useDeliveryAgents();
  const lookups = useCustomerLookups();

  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAgents = useMemo(() => filterAgents(agents, searchTerm), [agents, searchTerm]);
  const isAtLimit = used >= limit;

  const openCreate = () => {
    setEditTarget(null);
    setFormMode('create');
  };
  const openEdit = async (agent) => {
    setLoadingEdit(true);
    setFormMode('edit');
    const full = await fetchAgentById(agent._id);
    setLoadingEdit(false);
    if (!full) {
      setFormMode(null);
      return;
    }
    setEditTarget(full);
  };
  const closeForm = () => {
    setFormMode(null);
    setEditTarget(null);
  };
  const handleFormSubmit = async (payload) => {
    const success = formMode === 'create' ? await addAgent(payload) : await editAgent(editTarget._id, payload);
    if (success) closeForm();
  };

  const closePasswordModal = () => {
    setPasswordTarget(null);
    setNewPassword('');
    setPasswordTouched(false);
  };
  const passwordError = passwordTouched ? validateNewPassword(newPassword) : '';
  const handleChangePassword = async () => {
    setPasswordTouched(true);
    if (!passwordTarget || validateNewPassword(newPassword)) return;
    const success = await changeAgentPassword(passwordTarget._id, newPassword);
    if (success) closePasswordModal();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeAgent(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Agent',
        render: (row) => (
          <div className="min-w-0">
            <p className={`font-medium truncate ${theme.text.heading}`}>{row.name}</p>
            <p className={`text-xs truncate ${theme.text.muted}`}>@{row.username}</p>
          </div>
        ),
      },
      {
        key: 'contact',
        label: 'Contact',
        render: (row) => (
          <div className="min-w-0">
            <p className={`text-sm truncate ${theme.text.body}`}>{row.phone_no}</p>
            <p className={`text-xs truncate ${theme.text.muted}`}>{row.email}</p>
          </div>
        ),
      },
      {
        key: 'openOrderCount',
        label: 'Orders to deliver',
        align: 'center',
        render: (row) => <Badge variant={row.openOrderCount > 0 ? 'yellow' : 'gray'} size="sm">{row.openOrderCount}</Badge>,
      },
      {
        key: 'status',
        label: 'Active',
        align: 'center',
        render: (row) => (
          <div className="flex items-center justify-center">
            <Switch checked={row.status === 'A'} onChange={() => toggleStatus(row)} disabled={mutating} color={theme.switch.color} aria-label={`Toggle status for ${row.name}`} />
          </div>
        ),
      },
    ],
    [mutating, toggleStatus]
  );

  const actions = [
    { label: 'Edit', icon: <PencilIcon />, variant: theme.button.secondary, onClick: openEdit },
    { label: 'Change Password', icon: <KeyIcon />, variant: theme.button.outline, onClick: setPasswordTarget },
    { label: 'Delete', icon: <TrashIcon />, variant: theme.button.danger, onClick: setDeleteTarget },
  ];

  const addButton = (
    <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openCreate} disabled={isAtLimit || loading}>
      Add Delivery Agent
    </Button>
  );

  return (
    <div className="max-w-8xl mx-auto p-4 sm:p-6">
      <Card
        title={<span className="font-bold">Delivery Agents</span>}
        subtitle={loading ? 'People who deliver your orders' : `People who deliver your orders - ${used} of ${limit} allowed on your plan (active and inactive)`}
        headerActions={addButton}
      >
        {error && (
          <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>{error}</p>
        )}
        {!loading && !error && isAtLimit && (
          <p className={`mb-4 text-sm ${theme.alert.warning.text} ${theme.alert.warning.background} border ${theme.alert.warning.border} rounded-lg px-4 py-2`}>
            {limit === 0
              ? 'Your plan does not include delivery agents yet. Please contact support to add some.'
              : `You have reached your plan's limit of ${limit} delivery agent${limit === 1 ? '' : 's'}. Delete an agent you no longer need, or contact support for more.`}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : agents.length === 0 ? (
          <EmptyState title="No delivery agents yet" description="Add the people who deliver your orders. They log in to /admin and see only the orders you assign to them." action={!isAtLimit && addButton} />
        ) : (
          <>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search name, username, email or phone…"
              ariaLabel="Search delivery agents"
              matchCount={filteredAgents.length}
              totalCount={agents.length}
              itemLabel="agents"
            />

            <div className="hidden md:block">
              <Table columns={columns} data={filteredAgents} keyField="_id" actions={actions} pageSize={20} resetPageOn={searchTerm} />
            </div>

            <div className="md:hidden space-y-3">
              {filteredAgents.map((agent) => (
                <div key={agent._id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${theme.text.heading}`}>{agent.name}</p>
                      <p className={`text-xs truncate ${theme.text.muted}`}>@{agent.username}</p>
                    </div>
                    <Switch checked={agent.status === 'A'} onChange={() => toggleStatus(agent)} disabled={mutating} color={theme.switch.color} aria-label={`Toggle status for ${agent.name}`} />
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <p className={`text-sm truncate ${theme.text.body}`}>{agent.phone_no}</p>
                    <p className={`text-xs truncate ${theme.text.muted}`}>{agent.email}</p>
                    <p className={`text-xs ${theme.text.muted}`}>Orders to deliver: {agent.openOrderCount}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <Button variant={theme.button.secondary} size="sm" leftIcon={<PencilIcon />} onClick={() => openEdit(agent)} fullWidth>
                      Edit
                    </Button>
                    <Button variant={theme.button.outline} size="sm" leftIcon={<KeyIcon />} onClick={() => setPasswordTarget(agent)} fullWidth>
                      Password
                    </Button>
                    <Button variant={theme.button.danger} size="sm" leftIcon={<TrashIcon />} onClick={() => setDeleteTarget(agent)} fullWidth>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Modal isOpen={!!formMode} onClose={closeForm} title={formMode === 'create' ? 'Add Delivery Agent' : 'Edit Delivery Agent'} size="lg">
        {loadingEdit || lookups.loading || (formMode === 'edit' && !editTarget) ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : (
          <DeliveryAgentForm
            key={editTarget?._id || 'create'}
            mode={formMode}
            initialValues={editTarget || {}}
            lookups={lookups}
            onSubmit={handleFormSubmit}
            onCancel={closeForm}
            submitting={mutating}
          />
        )}
      </Modal>

      <Modal isOpen={!!passwordTarget} onClose={closePasswordModal} title="Change Password" size="sm">
        <div className="space-y-4">
          <p className={`text-sm ${theme.text.body}`}>
            Set a new password for <span className={`font-medium ${theme.text.heading}`}>{passwordTarget?.name}</span>. This immediately signs them out of every device.
          </p>
          <div>
            <InputField
              label="New Password"
              name="newPassword"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
              required
              showError={false}
            />
            {passwordError && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{passwordError}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant={theme.button.ghost} onClick={closePasswordModal} disabled={mutating}>
              Cancel
            </Button>
            <Button variant={theme.button.primary} onClick={handleChangePassword} loading={mutating}>
              Change Password
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Delivery Agent"
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
          Delete <span className={`font-medium ${theme.text.heading}`}>{deleteTarget?.name}</span>? They are signed out and can no longer log in. Their past deliveries stay in each order's history.
        </p>
      </Modal>
    </div>
  );
};

export default DeliveryAgentsPage;
