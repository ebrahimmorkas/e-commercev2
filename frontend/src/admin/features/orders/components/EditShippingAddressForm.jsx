import { useEffect, useMemo, useState } from 'react';
import Button from '../../../../components/common/Buttons';
import Dropdown from '../../../../components/common/DropDown';
import TextArea from '../../../../components/common/TextArea';
import Spinner from '../../../../components/common/Spinner';
import { RadioGroup } from '../../../../components/common/Radio';
import theme from '../theme/theme';

const MODE_OPTIONS = [
  { value: 'saved', label: "Switch to one of the customer's saved addresses" },
  { value: 'new', label: 'Enter a new address' },
];

const nameOf = (field, key) => (field && typeof field === 'object' ? field[key] : '');

const describeAddress = (address) =>
  [
    address.address_name,
    [address.building, address.address_in_words].filter(Boolean).join(', '),
    [nameOf(address.city_id, 'city_name'), nameOf(address.state_id, 'state_name')].filter(Boolean).join(', '),
    address.pincode,
  ]
    .filter(Boolean)
    .join(' - ');

/**
 * Inline form for changing where an order is delivered after it was placed:
 * either switch to one of the customer's saved addresses, or type a new
 * address in an open field. A typed address is stored on the order only - it
 * is never added to the customer's own address book (backend
 * orderService.updateOrderShippingAddress).
 *
 * @param {Object} order - The order being edited.
 * @param {Function} loadAddresses - () => Promise<Array> the customer's saved addresses.
 * @param {Function} onSubmit - ({ addressId } | { addressText }) => Promise<boolean>
 * @param {Function} onCancel
 * @param {boolean} submitting
 */
const EditShippingAddressForm = ({ order, loadAddresses, onSubmit, onCancel, submitting }) => {
  const canPickSaved = !order.isWalkInCustomer;
  const [mode, setMode] = useState(canPickSaved ? 'saved' : 'new');
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(canPickSaved);
  const [selectedId, setSelectedId] = useState(order.shippingAddressId ? String(order.shippingAddressId) : '');
  const [text, setText] = useState(order.adminEnteredAddress || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canPickSaved) return undefined;
    let cancelled = false;
    loadAddresses()
      .then((list) => {
        if (!cancelled) setAddresses(list);
      })
      .catch(() => {
        if (!cancelled) setAddresses([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canPickSaved, loadAddresses]);

  const addressOptions = useMemo(
    () => addresses.map((a) => ({ value: String(a._id), label: describeAddress(a) })),
    [addresses]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'saved') {
      if (!selectedId) {
        setError('Select one of the saved addresses.');
        return;
      }
      setError('');
      await onSubmit({ addressId: selectedId });
      return;
    }
    const trimmed = text.trim();
    if (trimmed.length < 5) {
      setError('Enter the full delivery address (at least 5 characters).');
      return;
    }
    setError('');
    await onSubmit({ addressText: trimmed });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {canPickSaved && (
        <RadioGroup
          label="Delivery address"
          name="shipping-address-mode"
          options={MODE_OPTIONS}
          value={mode}
          onChange={(value) => {
            setMode(value);
            setError('');
          }}
        />
      )}

      {mode === 'saved' ? (
        loading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : addressOptions.length === 0 ? (
          <p className="text-sm text-gray-500">This customer has no saved addresses. Enter a new address instead.</p>
        ) : (
          <Dropdown
            label="Saved address"
            options={addressOptions}
            value={selectedId}
            onChange={(value) => setSelectedId(value)}
            placeholder="Select an address"
            error={error}
          />
        )
      ) : (
        <div>
          <TextArea
            label="New delivery address"
            placeholder="Flat / building, street, area, city, state, pincode"
            rows={4}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitting}
          />
          {/* TextArea only shows its own per-keystroke validation errors, so the submit-time one is shown here. */}
          {error && (
            <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400">
        This only changes where this order is delivered. It is not saved to the customer&apos;s address book, and the shipping price and tax are not recalculated.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant={theme.button.primary} loading={submitting} disabled={mode === 'saved' && !loading && addressOptions.length === 0}>
          Update address
        </Button>
      </div>
    </form>
  );
};

export default EditShippingAddressForm;
