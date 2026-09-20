import { useState } from 'react';
import Button from '../../../../components/common/Buttons';
import InputField from '../../../../components/common/InputField';
import theme from '../theme/theme';

/**
 * Inline form for entering the shipping price of an order - used both to add
 * the first price to an order placed under manual (CUSTOM) shipping (backend
 * orderService.setOrderShippingPrice) and to edit an already-set one
 * (orderService.updateOrderShippingPrice).
 *
 * @param {number|string} [initialAmount] - Pre-filled amount (edit).
 * @param {string} [submitLabel]
 * @param {string} [hint]
 * @param {string} [currencySymbol]
 * @param {Function} onSubmit - (shippingAmount:number) => Promise<boolean>
 * @param {Function} onCancel
 * @param {boolean} submitting
 */
const AddShippingPriceForm = ({
  initialAmount = '',
  submitLabel = 'Save shipping price',
  hint = 'This is added to the order total and can\'t be changed afterwards.',
  currencySymbol = '',
  onSubmit,
  onCancel,
  submitting,
}) => {
  const [amount, setAmount] = useState(initialAmount === null || initialAmount === undefined ? '' : String(initialAmount));
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (amount === '' || !Number.isFinite(value) || value < 0) {
      setError('Enter a shipping price of 0 or more.');
      return;
    }
    setError('');
    await onSubmit(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <InputField
        type="number"
        label={currencySymbol ? `Shipping price (${currencySymbol})` : 'Shipping price'}
        placeholder="e.g. 49"
        min={0}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={error}
        disabled={submitting}
      />
      <p className="text-xs text-gray-400">{hint}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant={theme.button.primary} loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default AddShippingPriceForm;
