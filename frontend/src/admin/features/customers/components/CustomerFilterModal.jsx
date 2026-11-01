import { useState } from 'react';
import Modal from '../../../../components/common/Modal';
import Button from '../../../../components/common/Buttons';
import DatePicker from '../../../../components/common/DatePicker';
import {
  EMPTY_CUSTOMER_FILTERS,
  STATUS_FILTER_OPTIONS,
  ORDERS_FILTER_OPTIONS,
  REVIEWS_FILTER_OPTIONS,
  LOGIN_FILTER_OPTIONS,
  toDateKey,
  validateJoinedRange,
} from '../utils/customerListFilters';
import theme from '../theme/theme';

const FilterSection = ({ title, description, children }) => (
  <section className="space-y-3">
    <div>
      <h3 className={`text-sm font-semibold ${theme.text.heading}`}>{title}</h3>
      {description && <p className={`text-xs mt-0.5 ${theme.text.muted}`}>{description}</p>}
    </div>
    {children}
  </section>
);

const ChoiceGroup = ({ label, options, value, onChange }) => (
  <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
    {options.map((option) => {
      const selected = value === option.value;
      return (
        <button
          key={option.value || 'any'}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(option.value)}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
            selected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 text-blue-700' : `border-gray-200 bg-white hover:bg-gray-50 ${theme.text.heading}`
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

/**
 * Filter panel for the admin Customers list. Edits a local draft and only
 * hands it to `onApply` on "Apply", so the list doesn't refetch on every
 * click. Mount it only while open - the draft is seeded from `filters` on mount.
 *
 * @param {Object} props
 * @param {Function} props.onClose
 * @param {Object} props.filters - currently applied filters (see EMPTY_CUSTOMER_FILTERS)
 * @param {Function} props.onApply - (filters) => void
 */
const CustomerFilterModal = ({ onClose, filters, onApply }) => {
  const [draft, setDraft] = useState(() => ({ ...EMPTY_CUSTOMER_FILTERS, ...filters }));
  const patch = (changes) => setDraft((prev) => ({ ...prev, ...changes }));
  const dateError = validateJoinedRange(draft.joinedFrom, draft.joinedTo);
  const today = new Date();

  const handleApply = (e) => {
    e?.preventDefault();
    if (dateError) return;
    onApply(draft);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Filter customers"
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant={theme.button.ghost} onClick={() => setDraft(EMPTY_CUSTOMER_FILTERS)}>
            Reset all
          </Button>
          <div className="flex items-center gap-2">
            <Button variant={theme.button.secondary} onClick={onClose}>
              Cancel
            </Button>
            <Button variant={theme.button.primary} onClick={handleApply} disabled={!!dateError}>
              Apply filters
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleApply} className="space-y-6">
        <FilterSection title="Status">
          <ChoiceGroup label="Status" options={STATUS_FILTER_OPTIONS} value={draft.status} onChange={(status) => patch({ status })} />
        </FilterSection>

        <FilterSection title="Orders" description="Counts every order that isn't deleted, including cancelled ones.">
          <ChoiceGroup label="Orders" options={ORDERS_FILTER_OPTIONS} value={draft.orders} onChange={(orders) => patch({ orders })} />
        </FilterSection>

        <FilterSection title="Reviews" description="Counts every review, whatever its approval status.">
          <ChoiceGroup label="Reviews" options={REVIEWS_FILTER_OPTIONS} value={draft.reviews} onChange={(reviews) => patch({ reviews })} />
        </FilterSection>

        <FilterSection title="Last login" description="Customers added by an admin haven't logged in until they sign in themselves.">
          <ChoiceGroup label="Last login" options={LOGIN_FILTER_OPTIONS} value={draft.login} onChange={(login) => patch({ login })} />
        </FilterSection>

        <FilterSection title="Joined between" description="Leave one side empty for an open-ended range.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DatePicker
              label="From"
              placeholder="Any date"
              value={draft.joinedFrom || null}
              onChange={(date) => patch({ joinedFrom: toDateKey(date) })}
              maxDate={today}
              clearable
            />
            <DatePicker
              label="To"
              placeholder="Any date"
              value={draft.joinedTo || null}
              onChange={(date) => patch({ joinedTo: toDateKey(date) })}
              maxDate={today}
              clearable
            />
          </div>
          {dateError && <p className={`text-sm ${theme.text.error}`}>{dateError}</p>}
        </FilterSection>
      </form>
    </Modal>
  );
};

export default CustomerFilterModal;
