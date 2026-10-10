import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Tabs from '../../../../components/common/Tabs';
import Table from '../../../../components/common/tables';
import Badge from '../../../../components/common/Badge';
import Button from '../../../../components/common/Buttons';
import Modal from '../../../../components/common/Modal';
import Dropdown from '../../../../components/common/DropDown';
import Spinner from '../../../../components/common/Spinner';
import EmptyState from '../../../../components/common/EmptyState';
import SearchInput from '../../../../components/common/SearchInput';
import Pagination from '../../../../components/common/Pagination';
import BulkActionBar from '../../../../components/common/BulkActionBar';
import { useInventory } from '../hooks/useInventory';
import StockAdjustForm from '../components/StockAdjustForm';
import StockHistory from '../components/StockHistory';
import { STOCK_OPERATIONS, STOCK_LEVEL_LABELS, SORT_OPTIONS, MAX_BULK_ADJUST_ITEMS } from '../constants';
import theme from '../theme/theme';

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const MinusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
);
const HistoryIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CLOSED_ADJUST = { open: false, operation: STOCK_OPERATIONS.INCREASE, items: [] };

/**
 * Inventory module: the stock of every product size (product > variant >
 * size), with increase / deduct for one size or many at once, and the
 * history of every change. Sizes at or below the low stock quantity are
 * marked "Low stock"; sizes at 0 "Out of stock".
 */
const InventoryPage = () => {
  const {
    items,
    pagination,
    summary,
    lowStock,
    error,
    loading,
    initialLoading,
    mutating,
    page,
    stockFilter,
    sort,
    searchText,
    isSearching,
    setSearchText,
    setPage,
    setStockFilter,
    setSort,
    adjustStock,
    bulkAdjustStock,
  } = useInventory();

  const [activeTab, setActiveTab] = useState('stock');
  const [selectedIds, setSelectedIds] = useState([]);
  const [adjustModal, setAdjustModal] = useState(CLOSED_ADJUST);
  const [historyTarget, setHistoryTarget] = useState(null);
  // Bumped after every adjustment so the History tab reloads.
  const [historyVersion, setHistoryVersion] = useState(0);

  // A bulk action must never reach rows the admin can no longer see, so the
  // selection is dropped whenever the visible rows change.
  const clearSelection = () => setSelectedIds([]);
  const handleSearchChange = (value) => {
    clearSelection();
    setSearchText(value);
  };
  const handlePageChange = (nextPage) => {
    clearSelection();
    setPage(nextPage);
  };
  const handleStockFilterChange = (value) => {
    clearSelection();
    setStockFilter(value);
  };
  const handleSortChange = (value) => {
    clearSelection();
    setSort(value);
  };

  const selectedItems = useMemo(() => items.filter((item) => selectedIds.includes(item._id)), [items, selectedIds]);
  const isOverBulkLimit = selectedItems.length > MAX_BULK_ADJUST_ITEMS;

  const openAdjust = (operation, targetItems) => setAdjustModal({ open: true, operation, items: targetItems });
  const closeAdjust = () => setAdjustModal(CLOSED_ADJUST);

  const handleAdjustSubmit = async (change) => {
    const { operation, items: targetItems } = adjustModal;
    const payload = { operation, ...change };
    const succeeded =
      targetItems.length === 1
        ? await adjustStock(targetItems[0], payload)
        : !!(await bulkAdjustStock(targetItems, payload));
    if (succeeded) {
      closeAdjust();
      clearSelection();
      setHistoryVersion((version) => version + 1);
    }
  };

  const bulkActions = [
    {
      key: 'increase',
      label: `Increase Stock (${selectedItems.length})`,
      icon: <PlusIcon />,
      variant: theme.button.primary,
      onClick: () => openAdjust(STOCK_OPERATIONS.INCREASE, selectedItems),
      disabled: mutating || isOverBulkLimit,
    },
    {
      key: 'deduct',
      label: `Deduct Stock (${selectedItems.length})`,
      icon: <MinusIcon />,
      variant: theme.button.danger,
      onClick: () => openAdjust(STOCK_OPERATIONS.DEDUCT, selectedItems),
      disabled: mutating || isOverBulkLimit,
    },
  ];

  const columns = useMemo(
    () => [
      {
        key: 'productName',
        label: 'Product',
        render: (row) => (
          <div className="flex items-center gap-3 min-w-0">
            {row.imageUrl ? (
              <img src={row.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 shrink-0" />
            )}
            <div className="min-w-0">
              <p className={`font-medium ${theme.text.heading}`}>{row.productName}</p>
              <p className={`text-xs ${theme.text.muted}`}>
                {row.productCode}
                {row.productStatus === 'I' || row.variantStatus === 'I' || row.sizeStatus === 'I' ? ' · Inactive' : ''}
              </p>
            </div>
          </div>
        ),
      },
      { key: 'variantName', label: 'Variant' },
      { key: 'sizeName', label: 'Size' },
      { key: 'sku', label: 'SKU', render: (row) => row.sku || '—' },
      {
        key: 'stock',
        label: 'Stock',
        align: 'right',
        render: (row) => (
          <span className={`text-base font-semibold tabular-nums ${theme.stockLevel[row.stockLevel]?.number || ''}`}>
            {row.stock}
          </span>
        ),
      },
      {
        key: 'stockLevel',
        label: 'Stock Level',
        align: 'center',
        render: (row) => (
          <Badge variant={theme.stockLevel[row.stockLevel]?.badge || 'gray'} size="sm" dot>
            {STOCK_LEVEL_LABELS[row.stockLevel] || row.stockLevel}
          </Badge>
        ),
      },
    ],
    []
  );

  const actions = [
    {
      // Icon only (+) - the modal it opens is titled "Increase Stock".
      label: '',
      icon: <PlusIcon />,
      variant: theme.button.secondary,
      onClick: (row) => openAdjust(STOCK_OPERATIONS.INCREASE, [row]),
      disabled: () => mutating,
    },
    {
      // Icon only (-) - the modal it opens is titled "Deduct Stock".
      label: '',
      icon: <MinusIcon />,
      variant: theme.button.secondary,
      onClick: (row) => openAdjust(STOCK_OPERATIONS.DEDUCT, [row]),
      disabled: (row) => mutating || row.stock <= 0,
    },
    { label: 'History', icon: <HistoryIcon />, variant: theme.button.ghost, onClick: setHistoryTarget },
  ];

  const tiles = [
    { key: 'ALL', label: 'All items', count: summary?.total },
    { key: 'IN_STOCK', label: 'In stock', count: summary?.inStock },
    { key: 'LOW_STOCK', label: 'Low stock', count: summary?.lowStock },
    { key: 'OUT_OF_STOCK', label: 'Out of stock', count: summary?.outOfStock },
  ];

  const isFiltered = isSearching || stockFilter !== 'ALL';
  const hasNoProducts = !initialLoading && !loading && !isFiltered && !error && (summary?.total ?? 0) === 0;

  const stockTab = initialLoading ? (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  ) : hasNoProducts ? (
    <EmptyState
      title="No stock to manage yet"
      description="Add products with variants and sizes first - each size will then be listed here with its stock."
    />
  ) : (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={() => handleStockFilterChange(tile.key)}
            aria-pressed={stockFilter === tile.key}
            className={`text-left rounded-lg border px-4 py-3 cursor-pointer transition-shadow ${theme.stockLevel[tile.key].tile} ${
              stockFilter === tile.key ? theme.tileActive : ''
            }`}
          >
            <span className="block text-xs font-medium uppercase tracking-wide">{tile.label}</span>
            <span className="block text-2xl font-bold tabular-nums">{(tile.count ?? 0).toLocaleString('en-IN')}</span>
          </button>
        ))}
      </div>

      {lowStock && (
        <p className={`mb-4 text-sm ${theme.text.body}`}>
          An item is marked <span className="font-semibold text-amber-600">Low stock</span> when its stock is{' '}
          <span className={`font-semibold ${theme.text.heading}`}>{lowStock.threshold}</span> or less
          {lowStock.isVendorThreshold
            ? ' - the quantity you set in Company Settings > Product. You are emailed when an item reaches it.'
            : lowStock.isAlertFeatureOn
              ? '. Switch on "Receive Low Stock Alert" in Company Settings > Product to set your own quantity and get an email.'
              : '.'}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-x-4">
        <div className="flex-1 min-w-[240px]">
          <SearchInput
            value={searchText}
            onChange={handleSearchChange}
            placeholder="Search product, code, variant, size, SKU, barcode…"
            ariaLabel="Search inventory"
          />
        </div>
        <div className="w-full sm:w-60 mb-4">
          <Dropdown name="inventorySort" options={SORT_OPTIONS} value={sort} onChange={(value) => handleSortChange(value)} />
        </div>
      </div>

      <BulkActionBar selectedCount={selectedIds.length} onClear={clearSelection} actions={bulkActions} />
      {isOverBulkLimit && (
        <p className={`mb-4 text-sm ${theme.text.error}`}>
          You can change at most {MAX_BULK_ADJUST_ITEMS} items at a time. Unselect some to continue.
        </p>
      )}

      <div className={`transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`} aria-busy={loading}>
        <Table
          columns={columns}
          data={items}
          keyField="_id"
          actions={selectedIds.length > 0 ? [] : actions}
          selectable
          selectedKeys={selectedIds}
          onSelectionChange={setSelectedIds}
          emptyComponent={
            loading ? null : (
              <EmptyState
                size="sm"
                title="No matching items"
                description="Nothing matches this search or stock level."
                action={
                  <Button
                    variant={theme.button.secondary}
                    onClick={() => {
                      handleSearchChange('');
                      handleStockFilterChange('ALL');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )
          }
        />
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className={`text-sm ${theme.text.muted}`}>
            {((page - 1) * pagination.limit + 1).toLocaleString('en-IN')}–
            {Math.min(page * pagination.limit, pagination.total).toLocaleString('en-IN')} of{' '}
            {pagination.total.toLocaleString('en-IN')} items
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
  );

  const isIncrease = adjustModal.operation === STOCK_OPERATIONS.INCREASE;

  return (
    <div className="max-w-8xl mx-auto p-6">
      <Card
        title={<span className="font-bold">Inventory</span>}
        subtitle="See and change the stock of every product size, and review every stock change"
      >
        {error && (
          <p
            className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}
          >
            {error}
          </p>
        )}

        <Tabs
          variant="pills"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'stock', label: 'Stock', content: stockTab },
            { key: 'history', label: 'History', content: <StockHistory refreshKey={historyVersion} /> },
          ]}
        />
      </Card>

      <Modal
        isOpen={adjustModal.open}
        onClose={closeAdjust}
        title={`${isIncrease ? 'Increase' : 'Deduct'} Stock${adjustModal.items.length > 1 ? ` - ${adjustModal.items.length} items` : ''}`}
        size="lg"
      >
        {adjustModal.open && (
          <StockAdjustForm
            operation={adjustModal.operation}
            items={adjustModal.items}
            onSubmit={handleAdjustSubmit}
            onCancel={closeAdjust}
            submitting={mutating}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        title="Stock History"
        size="xl"
      >
        {historyTarget && (
          <>
            <p className={`mb-4 text-sm ${theme.text.body}`}>
              <span className={`font-medium ${theme.text.heading}`}>{historyTarget.productName}</span> ·{' '}
              {historyTarget.variantName} · {historyTarget.sizeName}
              {historyTarget.sku ? ` · SKU ${historyTarget.sku}` : ''} · Current stock:{' '}
              <span className={`font-semibold ${theme.text.heading}`}>{historyTarget.stock}</span>
            </p>
            <StockHistory sizeId={historyTarget.sizeId} refreshKey={historyVersion} />
          </>
        )}
      </Modal>
    </div>
  );
};

export default InventoryPage;
