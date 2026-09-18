import React from 'react';
import Button from '../Buttons';

/**
 * Contextual action bar shown above a Table when rows are selected via its
 * checkbox column - the multi-select equivalent of the table's per-row
 * Actions column, which the page hides itself (by passing `actions={[]}` to
 * Table) whenever a selection is active.
 *
 * @param {Object} props
 * @param {number} props.selectedCount - Total number of currently selected rows
 * @param {Function} props.onClear - Clears the current selection
 * @param {Array} props.actions - Bulk action definitions:
 *   {
 *     key: string,
 *     label: string,             // include the count in the label, e.g. `Mark Active (2)`
 *     icon: ReactNode,
 *     variant: string,           // passed straight to Button
 *     onClick: () => void,
 *     loading: boolean,
 *     disabled: boolean,
 *     hidden: boolean,           // e.g. no eligible rows for this action, or feature not enabled for vendor
 *   }
 */
const BulkActionBar = ({ selectedCount = 0, onClear, actions = [] }) => {
  if (selectedCount === 0) return null;

  const visibleActions = actions.filter((action) => !action.hidden);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-lg border border-blue-200 bg-blue-50">
      <span className="text-sm font-medium text-blue-900">
        {selectedCount} selected
      </span>

      <button
        type="button"
        onClick={onClear}
        className="text-sm font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2 focus:outline-none cursor-pointer"
      >
        Clear
      </button>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {visibleActions.map((action) => (
          <Button
            key={action.key}
            size="sm"
            variant={action.variant || 'secondary'}
            leftIcon={action.icon}
            loading={action.loading}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default BulkActionBar;
