import { useRef, useState } from 'react';
import Autocomplete from '../../../../components/common/Autocomplete';
import Checkbox from '../../../../components/common/Checkbox';
import Dropdown from '../../../../components/common/DropDown';
import TextArea from '../../../../components/common/TextArea';
import Button from '../../../../components/common/Buttons';
import { searchCustomers } from '../api/sendEmailApi';
import theme from '../theme/theme';

const SEARCH_DELAY_MS = 300;

/**
 * Who the email goes to: all customers, or picked customers and/or user
 * groups - plus typed addresses. Addresses of people outside the store are
 * only accepted when the account allows it (access.canEmailOutOfStore);
 * typed addresses of store customers are always fine.
 *
 * @param {Object} props.compose
 * @param {(patch: Object) => void} props.onChange
 * @param {Object} props.options - from GET /send-email/options
 */
const RecipientsSection = ({ compose, onChange, options }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  const handleQueryChange = (text) => {
    setQuery(text);
    clearTimeout(timerRef.current);
    if (!text.trim()) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const customers = await searchCustomers(text);
        setSuggestions(Array.isArray(customers) ? customers : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DELAY_MS);
  };

  const handleSelect = (option) => {
    const customer = suggestions.find((c) => c._id === option.value);
    if (customer && !compose.customers.some((c) => c._id === customer._id)) {
      onChange({ customers: [...compose.customers, customer] });
    }
    setQuery('');
    setSuggestions([]);
  };

  const groupOptions = (options.groups || []).map((g) => ({ value: g._id, label: `${g.groupName} (${g.membersCount})` }));

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <h3 className={`text-sm font-semibold ${theme.text.heading}`}>To</h3>
      <p className={`text-xs ${theme.text.muted}`}>Each person gets their own separate email - nobody sees the other recipients.</p>

      <Checkbox
        label={`All customers (${options.customerCount ?? 0})`}
        checked={compose.allCustomers}
        onChange={(e) => onChange({ allCustomers: e.target.checked })}
      />

      {!compose.allCustomers && (
        <>
          <div>
            <Autocomplete
              label="Customers"
              placeholder="Search by name, email or phone"
              value={query}
              onChange={handleQueryChange}
              onSelect={handleSelect}
              options={suggestions.map((c) => ({ value: c._id, label: `${c.name || 'No name'} - ${c.email}` }))}
              filterFn={() => true}
              loading={searching}
              noOptionsText="No customers found"
            />
            {compose.customers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {compose.customers.map((c) => (
                  <span key={c._id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-800 text-sm">
                    {c.name || c.email}
                    <Button
                      variant={theme.button.ghost}
                      size="xs"
                      aria-label={`Remove ${c.name || c.email}`}
                      onClick={() => onChange({ customers: compose.customers.filter((x) => x._id !== c._id) })}
                    >
                      ×
                    </Button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {groupOptions.length > 0 && (
            <Dropdown
              label="User groups"
              name="groupIds"
              options={groupOptions}
              value={compose.groupIds}
              onChange={(val) => onChange({ groupIds: val || [] })}
              placeholder="Pick groups"
              multiple
              searchable
            />
          )}
        </>
      )}

      <div>
        <TextArea
          label="Other email addresses"
          name="externalEmails"
          placeholder="name1@example.com, name2@example.com"
          value={compose.externalText}
          onChange={(e) => onChange({ externalText: e.target.value })}
          rows={2}
        />
        <p className={`mt-1 text-xs ${theme.text.muted}`}>
          {options.access?.canEmailOutOfStore
            ? 'Separate addresses with commas. Anyone can be emailed, including people who are not customers of your store.'
            : 'Separate addresses with commas. Only addresses of your store customers are accepted.'}
        </p>
      </div>
    </div>
  );
};

export default RecipientsSection;
