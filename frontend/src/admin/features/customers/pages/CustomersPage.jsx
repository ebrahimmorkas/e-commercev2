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
import BulkActionBar from '../../../../components/common/BulkActionBar';
import SearchInput from '../../../../components/common/SearchInput';
import { useCustomers } from '../hooks/useCustomers';
import { useCustomerLookups } from '../hooks/useCustomerLookups';
import { useAssignedModules } from '../../../modules/hooks/useAssignedModules';
import { filterBySearch } from '../../../../utils/searchFilter';
import CustomerForm from '../components/CustomerForm';
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

// Client-side search: the admin endpoint returns every customer at once (matching rules:
// utils/searchFilter.js). Limited to what that list endpoint returns.
const filterCustomers = (customers, term) =>
  filterBySearch(customers, term, (c) => [c.name, c.username, c.email, c.phone_no, c.whatsapp_no, c.role]);

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

const validateNewPassword = (value) => {
  if (!value || value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > 128) return 'Password must not exceed 128 characters';
  if (!PASSWORD_PATTERN.test(value)) return 'Password must contain at least one uppercase letter, one lowercase letter and one number';
  return '';
};

/**
 * @param {Function} props.onAddUser - navigates to the separate Add User
 * module (App.jsx wires this to its own top-level page, not a view swap
 * inside this one - see the ADD_USER ModuleMaster entry).
 */
const CustomersPage = ({ onAddUser }) => {
  const {
    customers, loading, error, mutating,
    fetchCustomerById, editCustomer, changeCustomerPassword, removeCustomer, toggleStatus,
    bulkToggleStatus, bulkRemoveCustomers,
  } = useCustomers();
  const lookups = useCustomerLookups();
  const { companyMaster } = lookups;
  const { assignedCodes } = useAssignedModules(true);

  const [editTarget, setEditTarget] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = useMemo(() => filterCustomers(customers, searchTerm), [customers, searchTerm]);

  // A bulk action must never reach rows the admin can no longer see, so narrowing the
  // search drops any selected customer that just got filtered out.
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    const stillVisible = new Set(filterCustomers(customers, value).map((c) => c._id));
    setSelectedIds((prev) => prev.filter((id) => stillVisible.has(id)));
  };

  // Add User needs BOTH gates to actually work (see backend/routes/userRoutes.js):
  // the ADD_USER module assigned to this vendor, and the
  // isAdminAddingUserFeatureAllowed company flag on. `assignedCodes` null
  // means "still loading/unknown" - fail open, same convention as
  // filterNavItemsByAssignedModules.
  const isAddUserAllowed = (!assignedCodes || assignedCodes.has('ADD_USER')) && !!companyMaster?.isAdminAddingUserFeatureAllowed;
  const isChangePasswordAllowed = !!companyMaster?.isPasswordChangeFeatureByAdminAllowed;

  const openEdit = async (customer) => {
    setLoadingEdit(true);
    const full = await fetchCustomerById(customer._id);
    setLoadingEdit(false);
    if (!full) return;
    setEditingDraft(full);
    setEditTarget(customer);
    setSelectedIds([]);
  };
  const closeEdit = () => {
    setEditTarget(null);
    setEditingDraft(null);
  };

  const handleEditSubmit = async (payload) => {
    if (!editTarget) return;
    const success = await editCustomer(editTarget._id, payload);
    if (success) closeEdit();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeCustomer(deleteTarget._id);
    if (success) setDeleteTarget(null);
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
    const success = await changeCustomerPassword(passwordTarget._id, newPassword);
    if (success) closePasswordModal();
  };

  // --- Bulk multi-select actions (checkbox column) --------------------------
  // Admin list endpoints never return status 'D' rows, so every selected
  // customer is already 'A' or 'I' - eligibility only separates those two
  // for the status-toggle buttons; Delete applies to the full selection.
  const selectedCustomers = useMemo(
    () => customers.filter((c) => selectedIds.includes(c._id)),
    [customers, selectedIds]
  );
  const activateEligibleIds = useMemo(
    () => selectedCustomers.filter((c) => c.status === 'I').map((c) => c._id),
    [selectedCustomers]
  );
  const deactivateEligibleIds = useMemo(
    () => selectedCustomers.filter((c) => c.status === 'A').map((c) => c._id),
    [selectedCustomers]
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
    await bulkRemoveCustomers(selectedIds);
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
        label: 'Customer',
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
            <p className={`text-sm truncate ${theme.text.body}`}>{row.email}</p>
            <p className={`text-xs truncate ${theme.text.muted}`}>{row.phone_no}</p>
          </div>
        ),
      },
      {
        key: 'role',
        label: 'Role',
        align: 'center',
        render: (row) => <Badge variant={theme.badge.default} size="sm">{row.role}</Badge>,
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

  const noMatchesState = (
    <EmptyState
      size="sm"
      title="No matching customers"
      description={`Nothing matches "${searchTerm.trim()}". Try a different name, email or phone number.`}
      action={
        <Button variant={theme.button.secondary} onClick={() => handleSearchChange('')}>
          Clear search
        </Button>
      }
    />
  );

  const actions = [
    { label: 'Edit', icon: <PencilIcon />, variant: theme.button.secondary, onClick: openEdit },
    ...(isChangePasswordAllowed
      ? [{ label: 'Change Password', icon: <KeyIcon />, variant: theme.button.outline, onClick: setPasswordTarget }]
      : []),
    { label: 'Delete', icon: <TrashIcon />, variant: theme.button.danger, onClick: setDeleteTarget },
  ];

  return (
    <div className="max-w-8xl mx-auto p-4 sm:p-6">
      <Card
        title={<span className="font-bold">Customers</span>}
        subtitle="Manage your storefront's registered customers"
        headerActions={
          isAddUserAllowed && (
            <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={onAddUser}>
              Add User
            </Button>
          )
        }
      >
        {error && (
          <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers yet"
            description="Customers who sign up on your storefront will show up here."
            action={
              isAddUserAllowed && (
                <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={onAddUser}>
                  Add User
                </Button>
              )
            }
          />
        ) : (
          <>
            <SearchInput
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search name, username, email or phone…"
              ariaLabel="Search customers"
              matchCount={filteredCustomers.length}
              totalCount={customers.length}
              itemLabel="customers"
            />

            {/* Desktop / tablet: full data table */}
            <div className="hidden md:block">
              <BulkActionBar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} actions={bulkActions} />
              <Table
                columns={columns}
                data={filteredCustomers}
                emptyComponent={noMatchesState}
                keyField="_id"
                actions={selectedIds.length > 0 ? [] : actions}
                selectable
                selectedKeys={selectedIds}
                onSelectionChange={setSelectedIds}
                pageSize={20}
                resetPageOn={searchTerm}
              />
            </div>

            {/* Mobile: card list - a 4-column table never reads well this narrow */}
            <div className="md:hidden space-y-3">
              {filteredCustomers.length === 0 && noMatchesState}
              {filteredCustomers.map((customer) => (
                <div key={customer._id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${theme.text.heading}`}>{customer.name}</p>
                      <p className={`text-xs truncate ${theme.text.muted}`}>@{customer.username}</p>
                    </div>
                    <Switch
                      checked={customer.status === 'A'}
                      onChange={() => toggleStatus(customer)}
                      disabled={mutating}
                      color={theme.switch.color}
                      aria-label={`Toggle status for ${customer.name}`}
                    />
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <p className={`text-sm truncate ${theme.text.body}`}>{customer.email}</p>
                    <p className={`text-xs truncate ${theme.text.muted}`}>{customer.phone_no}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge variant={theme.badge.default} size="sm">{customer.role}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <Button variant={theme.button.secondary} size="sm" leftIcon={<PencilIcon />} onClick={() => openEdit(customer)} fullWidth>
                      Edit
                    </Button>
                    {isChangePasswordAllowed && (
                      <Button variant={theme.button.outline} size="sm" leftIcon={<KeyIcon />} onClick={() => setPasswordTarget(customer)} fullWidth>
                        Password
                      </Button>
                    )}
                    <Button variant={theme.button.danger} size="sm" leftIcon={<TrashIcon />} onClick={() => setDeleteTarget(customer)} fullWidth>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Modal isOpen={!!editTarget} onClose={closeEdit} title="Edit Customer" size="lg">
        {loadingEdit || lookups.loading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : (
          <CustomerForm initialValues={editingDraft || {}} lookups={lookups} onSubmit={handleEditSubmit} onCancel={closeEdit} submitting={mutating} />
        )}
      </Modal>

      <Modal isOpen={!!passwordTarget} onClose={closePasswordModal} title="Change Password" size="sm">
        <div className="space-y-4">
          <p className={`text-sm ${theme.text.body}`}>
            Set a new password for <span className={`font-medium ${theme.text.heading}`}>{passwordTarget?.name}</span>. This immediately signs them out
            of every device.
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
        title="Delete Customer"
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
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        title="Delete Customers"
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
          Are you sure you want to delete <span className={`font-medium ${theme.text.heading}`}>{selectedIds.length}</span> customer{selectedIds.length === 1 ? '' : 's'}? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default CustomersPage;
