import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Badge from '../../../../components/common/Badge';
import Button from '../../../../components/common/Buttons';
import Modal from '../../../../components/common/Modal';
import Dropdown from '../../../../components/common/DropDown';
import InputField from '../../../../components/common/InputField';
import Spinner from '../../../../components/common/Spinner';
import EmptyState from '../../../../components/common/EmptyState';
import SearchInput from '../../../../components/common/SearchInput';
import Pagination from '../../../../components/common/Pagination';
import { useStoreCurrency } from '../../../currency/useStoreCurrency';
import { useFreeCashUsage } from '../hooks/useFreeCashUsage';
import CustomerFreeCashHistory from '../components/CustomerFreeCashHistory';
import { CUSTOMER_STATUS_OPTIONS, SORT_OPTIONS } from '../constants';
import theme from '../theme/theme';

const HistoryIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// A money amount: 0 or more, at most 2 decimals. Blank is allowed (that end of the range is open).
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const amountError = (text) => (text.trim() === '' || AMOUNT_PATTERN.test(text.trim()) ? '' : 'Enter an amount like 100 or 99.50');

/**
 * Free Cash Usage module (read-only): every customer with the Free Cash they
 * can spend right now, a filter on that amount (from / to), and each
 * customer's full Free Cash history.
 */
const FreeCashUsagePage = () => {
  const {
    customers,
    pagination,
    summary,
    error,
    loading,
    initialLoading,
    page,
    customerStatus,
    sort,
    minAmount,
    maxAmount,
    searchText,
    isFiltered,
    setSearchText,
    setPage,
    setCustomerStatus,
    setSort,
    setAmountRange,
  } = useFreeCashUsage();
  const { formatMoney, symbol } = useStoreCurrency();

  // What is typed in the range boxes - only sent to the server on Apply.
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [rangeError, setRangeError] = useState('');
  const [historyTarget, setHistoryTarget] = useState(null);

  const isRangeApplied = minAmount !== '' || maxAmount !== '';

  const applyRange = (e) => {
    e.preventDefault();
    const from = fromText.trim();
    const to = toText.trim();
    if (amountError(from) || amountError(to)) {
      setRangeError('Enter amounts like 100 or 99.50 (no negative numbers).');
      return;
    }
    if (from !== '' && to !== '' && Number(from) > Number(to)) {
      setRangeError('"From" cannot be more than "To".');
      return;
    }
    setRangeError('');
    setAmountRange(from, to);
  };

  const clearRange = () => {
    setFromText('');
    setToText('');
    setRangeError('');
    setAmountRange('', '');
  };

  const clearAllFilters = () => {
    clearRange();
    setSearchText('');
    setCustomerStatus('ALL');
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Customer',
        render: (row) => (
          <span className={`font-medium ${theme.text.heading}`}>
            {row.name || '—'}
            {row.status === 'I' && (
              <Badge variant="gray" size="sm" className="ml-2">
                Inactive
              </Badge>
            )}
          </span>
        ),
      },
      { key: 'email', label: 'Email', render: (row) => row.email || '—' },
      {
        key: 'activeFreeCash',
        label: 'Active Free Cash',
        align: 'right',
        render: (row) => (
          <span className={`text-base font-semibold ${row.activeFreeCash > 0 ? theme.text.active : theme.text.muted}`}>
            {formatMoney(row.activeFreeCash)}
          </span>
        ),
      },
      { key: 'totalAssigned', label: 'Total Given', align: 'right', render: (row) => formatMoney(row.totalAssigned) },
      { key: 'totalUsed', label: 'Total Used', align: 'right', render: (row) => formatMoney(row.totalUsed) },
    ],
    [formatMoney]
  );

  const actions = [
    { label: 'History', icon: <HistoryIcon />, variant: theme.button.secondary, onClick: setHistoryTarget },
  ];

  const tiles = [
    { key: 'customers', label: 'Customers', value: (summary?.totalCustomers ?? 0).toLocaleString('en-IN'), style: theme.tile.neutral },
    {
      key: 'withActive',
      label: 'Customers with active Free Cash',
      value: (summary?.customersWithActiveFreeCash ?? 0).toLocaleString('en-IN'),
      style: theme.tile.active,
    },
    {
      key: 'totalActive',
      label: 'Total active Free Cash',
      value: formatMoney(summary?.totalActiveFreeCash ?? 0),
      style: theme.tile.active,
    },
  ];

  return (
    <div className="max-w-8xl mx-auto p-6">
      <Card
        title={<span className="font-bold">Free Cash Usage</span>}
        subtitle="See how much Free Cash each customer can use right now, and the full history of their Free Cash"
      >
        {error && (
          <p
            className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}
          >
            {error}
          </p>
        )}

        {initialLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {tiles.map((tile) => (
                <div key={tile.key} className={`rounded-lg border px-4 py-3 ${tile.style}`}>
                  <span className="block text-xs font-medium uppercase tracking-wide">{tile.label}</span>
                  <span className="block text-2xl font-bold tabular-nums">{tile.value}</span>
                </div>
              ))}
            </div>

            <p className={`mb-4 text-sm ${theme.text.body}`}>
              <span className={`font-semibold ${theme.text.heading}`}>Active Free Cash</span> is what the customer can
              use on an order right now: Free Cash that is not used up, not revoked and not expired. Free Cash given to
              all users or to categories is added to a customer the first time they open their cart, so it appears here
              from then on.
            </p>

            <div className="flex flex-wrap items-start gap-x-4">
              <div className="flex-1 min-w-[240px]">
                <SearchInput
                  value={searchText}
                  onChange={setSearchText}
                  placeholder="Search customer name, email, phone…"
                  ariaLabel="Search customers"
                />
              </div>
              <div className="w-full sm:w-52 mb-4">
                <Dropdown
                  name="customerStatus"
                  options={CUSTOMER_STATUS_OPTIONS}
                  value={customerStatus}
                  onChange={(value) => setCustomerStatus(value)}
                />
              </div>
              <div className="w-full sm:w-64 mb-4">
                <Dropdown name="freeCashUsageSort" options={SORT_OPTIONS} value={sort} onChange={(value) => setSort(value)} />
              </div>
            </div>

            <form onSubmit={applyRange} noValidate className="mb-4 rounded-lg border border-gray-200 px-4 py-3">
              <p className={`text-sm font-medium ${theme.text.heading}`}>
                Filter by Active Free Cash{symbol ? ` (${symbol})` : ''}
              </p>
              <p className={`mb-3 text-xs ${theme.text.body}`}>
                Enter the same amount in both boxes for customers with exactly that much (e.g. 100 and 100), or a range
                (e.g. 100 to 200). Leave a box empty for &quot;any&quot;.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-44">
                  <InputField
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    label="From"
                    name="freeCashFrom"
                    placeholder="e.g. 100"
                    maxLength={12}
                    value={fromText}
                    onChange={(e) => setFromText(e.target.value)}
                    showError={false}
                  />
                </div>
                <div className="w-full sm:w-44">
                  <InputField
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    label="To"
                    name="freeCashTo"
                    placeholder="e.g. 200"
                    maxLength={12}
                    value={toText}
                    onChange={(e) => setToText(e.target.value)}
                    showError={false}
                  />
                </div>
                <Button type="submit" variant={theme.button.primary}>
                  Apply
                </Button>
                {(isRangeApplied || fromText !== '' || toText !== '') && (
                  <Button type="button" variant={theme.button.ghost} onClick={clearRange}>
                    Clear
                  </Button>
                )}
              </div>
              {rangeError && <p className={`mt-2 text-sm ${theme.text.error}`}>{rangeError}</p>}
              {!rangeError && isRangeApplied && (
                <p className={`mt-2 text-sm ${theme.text.body}`}>
                  Showing customers with active Free Cash{' '}
                  {minAmount !== '' && maxAmount !== '' && Number(minAmount) === Number(maxAmount)
                    ? `of exactly ${formatMoney(Number(minAmount))}`
                    : `${minAmount !== '' ? `from ${formatMoney(Number(minAmount))}` : ''}${
                        minAmount !== '' && maxAmount !== '' ? ' ' : ''
                      }${maxAmount !== '' ? `up to ${formatMoney(Number(maxAmount))}` : ''}`}
                  .
                </p>
              )}
            </form>

            <div className={`transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`} aria-busy={loading}>
              <Table
                columns={columns}
                data={customers}
                keyField="_id"
                actions={actions}
                emptyComponent={
                  loading ? null : isFiltered ? (
                    <EmptyState
                      size="sm"
                      title="No matching customers"
                      description="No customer matches this search or Free Cash range."
                      action={
                        <Button variant={theme.button.secondary} onClick={clearAllFilters}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState size="sm" title="No customers yet" description="Customers who sign up on your store will be listed here." />
                  )
                }
              />
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className={`text-sm ${theme.text.muted}`}>
                  {((page - 1) * pagination.limit + 1).toLocaleString('en-IN')}–
                  {Math.min(page * pagination.limit, pagination.total).toLocaleString('en-IN')} of{' '}
                  {pagination.total.toLocaleString('en-IN')} customers
                </p>
                <Pagination currentPage={page} totalPages={pagination.totalPages} onPageChange={setPage} disabled={loading} size="sm" />
              </div>
            )}
          </>
        )}
      </Card>

      <Modal isOpen={!!historyTarget} onClose={() => setHistoryTarget(null)} title="Free Cash History" size="xl">
        {historyTarget && <CustomerFreeCashHistory userId={historyTarget._id} formatMoney={formatMoney} />}
      </Modal>
    </div>
  );
};

export default FreeCashUsagePage;
