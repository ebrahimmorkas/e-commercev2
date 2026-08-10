import React, { useState, useMemo } from 'react';

/**
 * A highly reusable Table Component
 *
 * @param {Object} props - Component properties
 * @param {Array} props.columns - Column definitions
 *   Each column: {
 *     key: string,              // property on the row object (or a unique key if using `render`)
 *     label: string,            // header text
 *     render: (row, value) => ReactNode,  // optional custom cell renderer
 *     sortable: boolean,        // enable sorting on this column
 *     sortFn: (a, b) => number, // optional custom sort comparator
 *     align: 'left' | 'center' | 'right',
 *     width: string,            // e.g. '120px', '20%'
 *     className: string,        // extra classes for cells in this column
 *     headerClassName: string,  // extra classes for the header cell
 *   }
 * @param {Array} props.data - Array of row data objects
 * @param {string} props.keyField - Property to use as the unique row key (default 'id')
 * @param {Function} props.getRowKey - Alternative to keyField: (row, index) => key
 * @param {Array} props.actions - Array of row action definitions, rendered as buttons in an "Actions" column
 *   Each action: {
 *     label: string,
 *     icon: ReactNode,
 *     onClick: (row) => void,
 *     className: string,        // classes applied on top of the variant classes
 *     variant: 'primary' | 'secondary' | 'danger' | 'ghost' (default 'secondary'),
 *     show: (row) => boolean,   // conditionally show this action per-row
 *     disabled: (row) => boolean,
 *   }
 * @param {React.ComponentType} props.ActionButton - Optional custom button component to render each action instead
 *   of the built-in button. Receives props: { action, row, children, className, disabled, onClick }
 *   Pass your own Button component here to keep actions consistent with the rest of your app.
 * @param {boolean} props.selectable - Show row checkboxes for selection
 * @param {Array} props.selectedKeys - Controlled array of selected row keys
 * @param {Function} props.onSelectionChange - (selectedKeys: Array) => void
 * @param {boolean} props.loading - Show loading state
 * @param {ReactNode} props.loadingComponent - Custom loading content
 * @param {string} props.emptyMessage - Message shown when data is empty
 * @param {ReactNode} props.emptyComponent - Custom empty-state content
 * @param {boolean} props.striped - Zebra-stripe rows
 * @param {boolean} props.hoverable - Highlight row on hover
 * @param {boolean} props.bordered - Add borders around cells
 * @param {boolean} props.compact - Reduce cell padding
 * @param {number} props.pageSize - Rows per page (omit to disable pagination)
 * @param {string} props.className - Extra classes for the outer wrapper
 * @param {string} props.tableClassName - Extra classes for the <table> element
 * @param {Function} props.onRowClick - (row) => void
 * @param {string} props.caption - Optional table caption (visually hidden, for accessibility) or title
 */
const Table = ({
  columns = [],
  data = [],
  keyField = 'id',
  getRowKey,
  actions = [],
  ActionButton,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  loading = false,
  loadingComponent = null,
  emptyMessage = 'No data available',
  emptyComponent = null,
  striped = true,
  hoverable = true,
  bordered = false,
  compact = false,
  pageSize = null,
  className = '',
  tableClassName = '',
  onRowClick,
  caption = '',
}) => {
  const [internalSelected, setInternalSelected] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [page, setPage] = useState(1);

  const isSelectionControlled = selectedKeys !== undefined;
  const currentSelected = isSelectionControlled ? selectedKeys : internalSelected;

  const resolveRowKey = (row, index) =>
    getRowKey ? getRowKey(row, index) : row[keyField] ?? index;

  // Default action variant styles, matching InputField's blue focus-ring language
  const actionVariants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-blue-500',
  };

  /**
   * Sorting
   */
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    const column = columns.find((col) => col.key === sortConfig.key);
    if (!column) return data;

    const sorted = [...data].sort((a, b) => {
      if (column.sortFn) return column.sortFn(a, b);

      const valA = a[column.key];
      const valB = b[column.key];

      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') return valA - valB;

      return String(valA).localeCompare(String(valB));
    });

    return sortConfig.direction === 'asc' ? sorted : sorted.reverse();
  }, [data, sortConfig, columns]);

  /**
   * Pagination
   */
  const totalPages = pageSize ? Math.max(1, Math.ceil(sortedData.length / pageSize)) : 1;
  const pagedData = pageSize
    ? sortedData.slice((page - 1) * pageSize, page * pageSize)
    : sortedData;

  const handleSort = (column) => {
    if (!column.sortable) return;
    setSortConfig((prev) => {
      if (prev.key !== column.key) return { key: column.key, direction: 'asc' };
      if (prev.direction === 'asc') return { key: column.key, direction: 'desc' };
      return { key: null, direction: 'asc' };
    });
  };

  /**
   * Selection
   */
  const updateSelection = (next) => {
    if (!isSelectionControlled) setInternalSelected(next);
    if (onSelectionChange) onSelectionChange(next);
  };

  const toggleRow = (key) => {
    const next = currentSelected.includes(key)
      ? currentSelected.filter((k) => k !== key)
      : [...currentSelected, key];
    updateSelection(next);
  };

  const allVisibleKeys = pagedData.map((row, i) => resolveRowKey(row, i));
  const allVisibleSelected =
    allVisibleKeys.length > 0 && allVisibleKeys.every((k) => currentSelected.includes(k));

  const toggleAll = () => {
    if (allVisibleSelected) {
      updateSelection(currentSelected.filter((k) => !allVisibleKeys.includes(k)));
    } else {
      updateSelection([...new Set([...currentSelected, ...allVisibleKeys])]);
    }
  };

  const cellPadding = compact ? 'px-3 py-1.5' : 'px-4 py-2.5';
  const borderClasses = bordered ? 'border border-gray-200' : '';

  /**
   * Renders a single action as either a custom ActionButton or the built-in default button
   */
  const renderAction = (action, row, index) => {
    if (action.show && !action.show(row)) return null;
    const isDisabled = action.disabled ? action.disabled(row) : false;

    const baseClasses =
      'inline-flex items-center gap-1 text-sm font-medium rounded-lg px-2.5 py-1.5 transition-all duration-200 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed';
    const variantClasses = actionVariants[action.variant] || actionVariants.secondary;
    const combinedClasses = `${baseClasses} ${variantClasses} ${action.className || ''}`;

    if (ActionButton) {
      // Pass the action's own props straight through, so ActionButton can be any
      // Button component that already understands variant/size/shape/leftIcon/etc.
      // Anything not recognized by your Button is simply ignored as an extra prop.
      const { label, icon, onClick, show, disabled: _disabled, ...restActionProps } = action;
      return (
        <ActionButton
          key={label || index}
          variant={action.variant}
          leftIcon={icon}
          disabled={isDisabled}
          onClick={(e) => {
            e?.stopPropagation?.();
            onClick(row);
          }}
          {...restActionProps}
        >
          {label}
        </ActionButton>
      );
    }

    return (
      <button
        key={action.label || index}
        type="button"
        disabled={isDisabled}
        className={combinedClasses}
        onClick={(e) => {
          e.stopPropagation();
          action.onClick(row);
        }}
      >
        {action.icon}
        {action.label}
      </button>
    );
  };

  const colSpan = columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0);

  return (
    <div className={`w-full overflow-x-auto rounded-lg border border-gray-200 ${className}`}>
      <table className={`min-w-full divide-y divide-gray-200 ${tableClassName}`}>
        {caption && <caption className="sr-only">{caption}</caption>}

        <thead className="bg-gray-50">
          <tr className="divide-x divide-gray-200">
            {selectable && (
              <th className={`${cellPadding} w-10`}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Select all rows"
                />
              </th>
            )}

            {columns.map((column) => (
              <th
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                onClick={() => handleSort(column)}
                className={`${cellPadding} text-${column.align || 'left'} text-xs font-semibold text-gray-600 uppercase tracking-wider ${borderClasses} ${
                  column.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''
                } ${column.headerClassName || ''}`}
              >
                <span className="inline-flex items-center gap-1">
                  {column.label}
                  {column.sortable && (
                    <span className="text-gray-400">
                      {sortConfig.key === column.key
                        ? sortConfig.direction === 'asc'
                          ? '▲'
                          : '▼'
                        : '↕'}
                    </span>
                  )}
                </span>
              </th>
            ))}

            {actions.length > 0 && (
              <th className={`${cellPadding} text-right text-xs font-semibold text-gray-600 uppercase tracking-wider`}>
                Actions
              </th>
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100 bg-white">
          {loading ? (
            <tr>
              <td colSpan={colSpan} className={`${cellPadding} text-center text-gray-500`}>
                {loadingComponent || 'Loading...'}
              </td>
            </tr>
          ) : pagedData.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className={`${cellPadding} text-center text-gray-500`}>
                {emptyComponent || emptyMessage}
              </td>
            </tr>
          ) : (
            pagedData.map((row, rowIndex) => {
              const rowKey = resolveRowKey(row, rowIndex);
              const isSelected = currentSelected.includes(rowKey);

              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`
                    divide-x divide-gray-100
                    ${striped && rowIndex % 2 === 1 ? 'bg-gray-50' : ''}
                    ${hoverable ? 'hover:bg-blue-50' : ''}
                    ${isSelected ? 'bg-blue-50' : ''}
                    ${onRowClick ? 'cursor-pointer' : ''}
                    transition-colors duration-150
                  `}
                >
                  {selectable && (
                    <td className={cellPadding} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(rowKey)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        aria-label={`Select row ${rowIndex + 1}`}
                      />
                    </td>
                  )}

                  {columns.map((column) => {
                    const value = row[column.key];
                    return (
                      <td
                        key={column.key}
                        className={`${cellPadding} text-sm text-gray-700 text-${column.align || 'left'} ${borderClasses} ${column.className || ''}`}
                      >
                        {column.render ? column.render(row, value) : value}
                      </td>
                    );
                  })}

                  {actions.length > 0 && (
                    <td className={`${cellPadding} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        {actions.map((action, i) => renderAction(action, row, i))}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {pageSize && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages} &middot; {sortedData.length} rows
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;