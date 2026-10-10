import { useMemo } from 'react';
import Table from '../../../../components/common/tables';
import Badge from '../../../../components/common/Badge';
import Dropdown from '../../../../components/common/DropDown';
import SearchInput from '../../../../components/common/SearchInput';
import Pagination from '../../../../components/common/Pagination';
import EmptyState from '../../../../components/common/EmptyState';
import { useInventoryLogs } from '../hooks/useInventoryLogs';
import { LOG_TYPE_LABELS, LOG_TYPE_OPTIONS } from '../constants';
import theme from '../theme/theme';

const formatDateTime = (dateValue) => {
  if (!dateValue) return '—';
  return new Date(dateValue).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Stock history: the stock each size was created with, and every increase /
 * deduction made from Inventory. Used for the whole store (History tab) and
 * for one product size (the row's "History" action).
 *
 * @param {Object} props
 * @param {string} [props.sizeId] - Only this product size's history; hides the product columns and the search
 * @param {*} [props.refreshKey] - Change it to reload
 */
const StockHistory = ({ sizeId = '', refreshKey = 0 }) => {
  const { logs, pagination, error, loading, page, type, searchText, isFiltering, setSearchText, setPage, setType } =
    useInventoryLogs({ sizeId, refreshKey });
  const isSingleSize = !!sizeId;

  const columns = useMemo(
    () => [
      { key: 'createdAt', label: 'Date', render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.createdAt)}</span> },
      ...(isSingleSize
        ? []
        : [
            {
              key: 'productName',
              label: 'Product',
              render: (row) => (
                <div className="min-w-0">
                  <p className={`font-medium ${theme.text.heading}`}>{row.productName}</p>
                  <p className={`text-xs ${theme.text.muted}`}>
                    {row.variantName} · {row.sizeName}
                    {row.sku ? ` · ${row.sku}` : ''}
                  </p>
                </div>
              ),
            },
          ]),
      {
        key: 'type',
        label: 'Change',
        render: (row) => (
          <Badge variant={theme.logType[row.type]?.badge || 'gray'} size="sm">
            {LOG_TYPE_LABELS[row.type] || row.type}
          </Badge>
        ),
      },
      {
        key: 'quantity',
        label: 'Quantity',
        align: 'right',
        render: (row) => (
          <span className={`font-semibold tabular-nums ${theme.logType[row.type]?.number || ''}`}>
            {theme.logType[row.type]?.sign || ''}
            {row.quantity}
          </span>
        ),
      },
      {
        key: 'newStock',
        label: 'Stock',
        align: 'right',
        render: (row) => (
          <span className="tabular-nums whitespace-nowrap">
            {row.previousStock} → <span className={`font-semibold ${theme.text.heading}`}>{row.newStock}</span>
          </span>
        ),
      },
      { key: 'remark', label: 'Remark', render: (row) => <span className="break-words">{row.remark || '—'}</span> },
      { key: 'changedByName', label: 'Changed by', render: (row) => row.changedByName || '—' },
    ],
    [isSingleSize]
  );

  return (
    <div>
      {error && (
        <p
          className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-x-4">
        {!isSingleSize && (
          <div className="flex-1 min-w-[240px]">
            <SearchInput
              value={searchText}
              onChange={setSearchText}
              placeholder="Search product, variant, size, SKU, remark…"
              ariaLabel="Search stock history"
            />
          </div>
        )}
        <div className="w-full sm:w-56 mb-4">
          <Dropdown
            name="logType"
            placeholder="All changes"
            options={LOG_TYPE_OPTIONS}
            value={type}
            onChange={(value) => setType(value)}
            clearable
          />
        </div>
      </div>

      <div className={`transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`} aria-busy={loading}>
        <Table
          columns={columns}
          data={logs}
          keyField="_id"
          loading={loading && logs.length === 0}
          emptyComponent={
            <EmptyState
              size="sm"
              title={isFiltering ? 'No matching stock changes' : 'No stock history yet'}
              description={
                isFiltering
                  ? 'Try a different search or change type.'
                  : 'Stock entered for new products and every increase or deduction made here will be listed.'
              }
            />
          }
        />
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className={`text-sm ${theme.text.muted}`}>
            {((page - 1) * pagination.limit + 1).toLocaleString('en-IN')}–
            {Math.min(page * pagination.limit, pagination.total).toLocaleString('en-IN')} of{' '}
            {pagination.total.toLocaleString('en-IN')} changes
          </p>
          <Pagination currentPage={page} totalPages={pagination.totalPages} onPageChange={setPage} disabled={loading} size="sm" />
        </div>
      )}
    </div>
  );
};

export default StockHistory;
