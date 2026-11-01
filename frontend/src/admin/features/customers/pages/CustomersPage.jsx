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
import Pagination from '../../../../components/common/Pagination';
import Dropdown from '../../../../components/common/DropDown';
import { useCustomers } from '../hooks/useCustomers';
import { useCustomerLookups } from '../hooks/useCustomerLookups';
import { useAssignedModules } from '../../../modules/hooks/useAssignedModules';
import CustomerForm from '../components/CustomerForm';
import DeliveryAgentsReadOnlyList from '../components/DeliveryAgentsReadOnlyList';
import CustomerFilterModal from '../components/CustomerFilterModal';
import CustomerFilterChips from '../components/CustomerFilterChips';
import CustomerActivityModal from '../components/CustomerActivityModal';
import { CUSTOMER_SORT_OPTIONS, CUSTOMER_PAGE_SIZES, formatDateTime } from '../utils/customerListFilters';
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

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4z" />
  </svg>
);

const pageSizeOptions = CUSTOMER_PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }));

// The Orders / Reviews count - a button that opens that customer's list.
const CountButton = ({ count, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-w-8 rounded-md px-2 py-1 text-sm font-semibold tabular-nums text-blue-600 hover:bg-blue-50 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    aria-label={`View ${count} ${label}`}
    title={`View ${label}`}
  >
    {(count ?? 0).toLocaleString('en-IN')}
  </button>
);

const LastLogin = ({ value }) =>
  value ? (
    <span className={`whitespace-nowrap text-sm ${theme.text.body}`}>{formatDateTime(value)}</span>
  ) : (
    <Badge variant="gray" size="sm">Never</Badge>
  );

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

const validateNewPassword = (value) => {
  if (!value || value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > 128) return 'Password must not exceed 128 characters';
  if (!PASSWORD_PATTERN.test(value)) return 'Password must contain at least one uppercase letter, one lowercase letter and one number';
  return '';
};

const MailIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

// Who the Send Email module can email: active customers (not staff roles) with an address.
const isEmailable = (customer) => customer.status === 'A' && customer.role === 'user' && !!customer.email;
const toRecipient = (customer) => ({ _id: customer._id, name: customer.name, email: customer.email });

/**
 * @param {Function} props.onAddUser - navigates to the separate Add User
 * module (App.jsx wires this to its own top-level page, not a view swap
 * inside this one - see the ADD_USER ModuleMaster entry).
 * @param {(customers: {_id, name, email}[]) => void} props.onSendEmail - opens
 * the Send Email module with these customers in the To field.
 */
const CustomersPage = ({ onAddUser, onSendEmail }) => {
  const {
    customers, pagination, totalCustomers, page, setPage, pageSize, setPageSize,
    searchText, setSearchText, sort, setSort, filters, setFilters, clearFilters, activeFilterCount,
    loading, initialLoading, error, mutating,
    fetchCustomerById, editCustomer, changeCustomerPassword, removeCustomer, toggleStatus,
    bulkToggleStatus, bulkRemoveCustomers,
  } = useCustomers();
  const lookups = useCustomerLookups();
  const { companyMaster } = lookups;
  const { assignedCodes } = useAssignedModules(true);
  // Send Email only while its module is assigned - the server only reports it
  // when the master email switch and isSendEmailModuleOn are both on. Unknown
  // (still loading / failed) counts as not available.
  const canSendEmail = !!onSendEmail && !!assignedCodes && assignedCodes.has('SEND_EMAIL');

  const [editTarget, setEditTarget] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // { customer, type: 'orders'|'reviews' } - the Orders / Reviews count the admin clicked.
  const [activityTarget, setActivityTarget] = useState(null);
  // 'customers' | 'agents' - agents are only listed when the store has delivery agents switched on.
  const [listView, setListView] = useState('customers');
  const showAgentsSwitch = !!companyMaster?.isOrderStatusUpdationAllowedByDeliveryAgents;
  const isAgentsView = showAgentsSwitch && listView === 'agents';

  // Search, sort, filters and paging all change which rows are on screen, and a
  // bulk action must never reach rows the admin can no longer see - so each
  // one clears the selection.
  const handleSearchChange = (value) => {
    setSearchText(value);
    setSelectedIds([]);
  };
  const handlePageChange = (nextPage) => {
    setPage(nextPage);
    setSelectedIds([]);
  };
  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setSelectedIds([]);
  };
  const handleSortChange = (value) => {
    setSort(value);
    setSelectedIds([]);
  };
  const handleFiltersChange = (nextFilters) => {
    setFilters(nextFilters);
    setSelectedIds([]);
  };
  const handleApplyFilters = (nextFilters) => {
    handleFiltersChange(nextFilters);
    setFilterOpen(false);
  };
  const handleClearFilters = () => {
    clearFilters();
    setSelectedIds([]);
  };
  const handleResetAll = () => {
    handleSearchChange('');
    handleClearFilters();
  };

  const openActivity = (customer, type) => setActivityTarget({ customer: { _id: customer._id, name: customer.name }, type });

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
  const emailEligibleCustomers = useMemo(() => selectedCustomers.filter(isEmailable), [selectedCustomers]);

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
      key: 'sendEmail',
      label: `Send Email (${emailEligibleCustomers.length})`,
      icon: <MailIcon />,
      variant: theme.button.secondary,
      onClick: () => {
        onSendEmail(emailEligibleCustomers.map(toRecipient));
        setSelectedIds([]);
      },
      disabled: mutating,
      // Inactive customers and ones without an email address can't be emailed.
      hidden: !canSendEmail || emailEligibleCustomers.length === 0,
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
        key: 'orderCount',
        label: 'Orders',
        align: 'center',
        render: (row) => <CountButton count={row.orderCount} label="orders" onClick={() => openActivity(row, 'orders')} />,
      },
      {
        key: 'reviewCount',
        label: 'Reviews',
        align: 'center',
        render: (row) => <CountButton count={row.reviewCount} label="reviews" onClick={() => openActivity(row, 'reviews')} />,
      },
      {
        key: 'createdAt',
        label: 'Joined At',
        render: (row) => <span className={`whitespace-nowrap text-sm ${theme.text.body}`}>{formatDateTime(row.createdAt) || '—'}</span>,
      },
      {
        key: 'lastLoginAt',
        label: 'Last Login',
        render: (row) => <LastLogin value={row.lastLoginAt} />,
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

  const isSearching = searchText.trim() !== '';
  const isNarrowed = isSearching || activeFilterCount > 0;
  let noMatchesDescription = 'No customers match the selected filters. Try removing one.';
  let noMatchesAction = (
    <Button variant={theme.button.secondary} onClick={handleClearFilters}>
      Clear filters
    </Button>
  );
  if (isSearching && activeFilterCount > 0) {
    noMatchesDescription = `Nothing matches "${searchText.trim()}" with the selected filters.`;
    noMatchesAction = (
      <Button variant={theme.button.secondary} onClick={handleResetAll}>
        Clear search &amp; filters
      </Button>
    );
  } else if (isSearching) {
    noMatchesDescription = `Nothing matches "${searchText.trim()}". Try a different name, username, email or phone number.`;
    noMatchesAction = (
      <Button variant={theme.button.secondary} onClick={() => handleSearchChange('')}>
        Clear search
      </Button>
    );
  }
  const noMatchesState = <EmptyState size="sm" title="No matching customers" description={noMatchesDescription} action={noMatchesAction} />;

  const actions = [
    { label: 'Edit', icon: <PencilIcon />, variant: theme.button.secondary, onClick: openEdit },
    ...(isChangePasswordAllowed
      ? [{ label: 'Change Password', icon: <KeyIcon />, variant: theme.button.outline, onClick: setPasswordTarget }]
      : []),
    ...(canSendEmail
      ? [{ label: 'Send Email', icon: <MailIcon />, variant: theme.button.secondary, onClick: (row) => onSendEmail([toRecipient(row)]), show: isEmailable }]
      : []),
    { label: 'Delete', icon: <TrashIcon />, variant: theme.button.danger, onClick: setDeleteTarget },
  ];

  return (
    <div className="max-w-8xl mx-auto p-4 sm:p-6">
      <Card
        title={<span className="font-bold">Customers</span>}
        subtitle="Manage your storefront's registered customers"
        headerActions={
          isAddUserAllowed && !isAgentsView && (
            <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={onAddUser}>
              Add User
            </Button>
          )
        }
      >
        {showAgentsSwitch && (
          <div className="flex gap-2 mb-4">
            <Button variant={listView === 'customers' ? theme.button.primary : theme.button.ghost} size="sm" onClick={() => setListView('customers')}>
              Customers
            </Button>
            <Button
              variant={listView === 'agents' ? theme.button.primary : theme.button.ghost}
              size="sm"
              onClick={() => {
                setListView('agents');
                setSelectedIds([]);
              }}
            >
              Delivery Agents
            </Button>
          </div>
        )}

        {error && (
          <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>{error}</p>
        )}

        {isAgentsView ? (
          <DeliveryAgentsReadOnlyList />
        ) : initialLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : totalCustomers === 0 && !isNarrowed && customers.length === 0 ? (
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
            {/* Toolbar: search, then Filters + Sort (they drop below the search on smaller screens) */}
            <div className="mb-4 flex flex-col lg:flex-row lg:items-start gap-3">
              <SearchInput
                value={searchText}
                onChange={handleSearchChange}
                placeholder="Search name, username, email or phone…"
                ariaLabel="Search customers"
                matchCount={pagination?.total ?? 0}
                totalCount={totalCustomers}
                itemLabel="customers"
                className="mb-0! flex-1 min-w-0"
              />
              <div className="flex items-center gap-2">
                <Button
                  variant={activeFilterCount > 0 ? theme.button.primary : theme.button.secondary}
                  leftIcon={<FilterIcon />}
                  onClick={() => setFilterOpen(true)}
                  className="whitespace-nowrap"
                >
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white text-blue-700 text-xs font-semibold">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
                <div className="flex-1 lg:flex-none lg:w-64">
                  <Dropdown options={CUSTOMER_SORT_OPTIONS} value={sort} onChange={handleSortChange} placeholder="Sort by" aria-label="Sort customers" />
                </div>
              </div>
            </div>

            <CustomerFilterChips filters={filters} onChange={handleFiltersChange} onClearAll={handleClearFilters} />
            {activeFilterCount > 0 && !isSearching && pagination && (
              <p className={`-mt-2 mb-4 text-sm ${theme.text.muted}`} aria-live="polite">
                {pagination.total.toLocaleString('en-IN')} of {totalCustomers.toLocaleString('en-IN')} customers match
              </p>
            )}

            {/* Desktop / tablet: full data table */}
            <div className="hidden md:block">
              <BulkActionBar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} actions={bulkActions} />
              <div className={`transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`} aria-busy={loading}>
                <Table
                  columns={columns}
                  data={customers}
                  emptyComponent={loading ? null : noMatchesState}
                  keyField="_id"
                  actions={selectedIds.length > 0 ? [] : actions}
                  selectable
                  selectedKeys={selectedIds}
                  onSelectionChange={setSelectedIds}
                />
              </div>
            </div>

            {/* Mobile: card list - an 8-column table never reads well this narrow */}
            <div className={`md:hidden space-y-3 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              {!loading && customers.length === 0 && noMatchesState}
              {customers.map((customer) => (
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
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-sm">
                    <div className="flex items-center gap-1">
                      <span className={theme.text.muted}>Orders</span>
                      <CountButton count={customer.orderCount} label="orders" onClick={() => openActivity(customer, 'orders')} />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={theme.text.muted}>Reviews</span>
                      <CountButton count={customer.reviewCount} label="reviews" onClick={() => openActivity(customer, 'reviews')} />
                    </div>
                    <div className="col-span-2">
                      <span className={theme.text.muted}>Joined </span>
                      <span className={theme.text.body}>{formatDateTime(customer.createdAt) || '—'}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <span className={theme.text.muted}>Last login</span>
                      <LastLogin value={customer.lastLoginAt} />
                    </div>
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
                    {canSendEmail && isEmailable(customer) && (
                      <Button variant={theme.button.secondary} size="sm" leftIcon={<MailIcon />} onClick={() => onSendEmail([toRecipient(customer)])} fullWidth>
                        Email
                      </Button>
                    )}
                    <Button variant={theme.button.danger} size="sm" leftIcon={<TrashIcon />} onClick={() => setDeleteTarget(customer)} fullWidth>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer: range + page size on the left, pages on the right. Shown even on a single
                page so the page size can still be changed. */}
            {pagination && pagination.total > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  <p className={`text-sm ${theme.text.muted}`}>
                    {((page - 1) * pagination.limit + 1).toLocaleString('en-IN')}–
                    {Math.min(page * pagination.limit, pagination.total).toLocaleString('en-IN')} of {pagination.total.toLocaleString('en-IN')} customers
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm whitespace-nowrap ${theme.text.body}`}>Show</span>
                    <div className="w-24">
                      <Dropdown
                        options={pageSizeOptions}
                        value={String(pageSize)}
                        onChange={handlePageSizeChange}
                        size="sm"
                        disabled={loading}
                        aria-label="Customers per page"
                      />
                    </div>
                    <span className={`text-sm whitespace-nowrap ${theme.text.body}`}>per page</span>
                  </div>
                </div>
                {pagination.totalPages > 1 && (
                  <Pagination currentPage={page} totalPages={pagination.totalPages} onPageChange={handlePageChange} disabled={loading} size="sm" />
                )}
              </div>
            )}
          </>
        )}
      </Card>

      {filterOpen && <CustomerFilterModal onClose={() => setFilterOpen(false)} filters={filters} onApply={handleApplyFilters} />}

      <CustomerActivityModal target={activityTarget} onClose={() => setActivityTarget(null)} />

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
