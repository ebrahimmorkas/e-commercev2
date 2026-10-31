import { useMemo } from 'react';
import Badge from '../../../../components/common/Badge';
import {
  STATUS_FILTER_OPTIONS,
  ORDERS_FILTER_OPTIONS,
  REVIEWS_FILTER_OPTIONS,
  LOGIN_FILTER_OPTIONS,
  optionLabel,
  formatDateKey,
} from '../utils/customerListFilters';
import theme from '../theme/theme';

/**
 * One removable chip per applied filter, plus "Clear all", shown under the
 * Customers toolbar so the admin always sees why rows are missing.
 *
 * @param {Object} props
 * @param {Object} props.filters - applied filters (see EMPTY_CUSTOMER_FILTERS)
 * @param {Function} props.onChange - (nextFilters) => void, with one filter removed
 * @param {Function} props.onClearAll
 */
const CustomerFilterChips = ({ filters, onChange, onClearAll }) => {
  const chips = useMemo(() => {
    const list = [];
    if (filters.status) list.push({ key: 'status', label: `Status: ${optionLabel(STATUS_FILTER_OPTIONS, filters.status)}`, remove: { status: '' } });
    if (filters.orders) list.push({ key: 'orders', label: optionLabel(ORDERS_FILTER_OPTIONS, filters.orders), remove: { orders: '' } });
    if (filters.reviews) list.push({ key: 'reviews', label: optionLabel(REVIEWS_FILTER_OPTIONS, filters.reviews), remove: { reviews: '' } });
    if (filters.login) list.push({ key: 'login', label: optionLabel(LOGIN_FILTER_OPTIONS, filters.login), remove: { login: '' } });

    if (filters.joinedFrom || filters.joinedTo) {
      let range = `${formatDateKey(filters.joinedFrom)} – ${formatDateKey(filters.joinedTo)}`;
      if (!filters.joinedTo) range = `on or after ${formatDateKey(filters.joinedFrom)}`;
      if (!filters.joinedFrom) range = `on or before ${formatDateKey(filters.joinedTo)}`;
      list.push({ key: 'joined', label: `Joined ${range}`, remove: { joinedFrom: '', joinedTo: '' } });
    }
    return list;
  }, [filters]);

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="blue"
          size="lg"
          shape="pill"
          onRemove={() => onChange({ ...filters, ...chip.remove })}
          removeLabel={`Remove ${chip.key} filter`}
        >
          {chip.label}
        </Badge>
      ))}
      {chips.length > 1 && (
        <button type="button" onClick={onClearAll} className={`text-sm underline cursor-pointer ${theme.text.body} hover:text-gray-900`}>
          Clear all
        </button>
      )}
    </div>
  );
};

export default CustomerFilterChips;
