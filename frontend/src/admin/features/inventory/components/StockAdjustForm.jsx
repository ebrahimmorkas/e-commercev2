import { useState } from 'react';
import InputField from '../../../../components/common/InputField';
import TextArea from '../../../../components/common/TextArea';
import Button from '../../../../components/common/Buttons';
import { STOCK_OPERATIONS, MAX_ADJUST_QUANTITY, MAX_REMARK_LENGTH } from '../constants';
import theme from '../theme/theme';

// A whole number, at least 1 - "5", not "5.5", "-5", "5abc" or "".
const parseQuantity = (text) => {
  const trimmed = String(text).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const quantity = Number(trimmed);
  return Number.isSafeInteger(quantity) ? quantity : null;
};

/**
 * The body of the Increase / Deduct stock modal - used for one product size
 * (the row action) and for many at once (the checkbox selection), where the
 * same quantity is applied to every selected size.
 *
 * @param {Object} props
 * @param {'INCREASE'|'DEDUCT'} props.operation
 * @param {Object[]} props.items - The Inventory row(s) being adjusted
 * @param {(change: { quantity: number, remark: string }) => void} props.onSubmit
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const StockAdjustForm = ({ operation, items = [], onSubmit, onCancel, submitting = false }) => {
  const [quantityText, setQuantityText] = useState('');
  const [remark, setRemark] = useState('');
  const [quantityError, setQuantityError] = useState('');

  const isIncrease = operation === STOCK_OPERATIONS.INCREASE;
  const isBulk = items.length > 1;
  const single = isBulk ? null : items[0];
  const quantity = parseQuantity(quantityText);

  const validateQuantity = (text) => {
    const value = parseQuantity(text);
    if (String(text).trim() === '') return 'Enter a quantity';
    if (value === null) return 'Enter a whole number, e.g. 5 (no decimals, signs or letters)';
    if (value < 1) return 'Quantity must be at least 1';
    if (value > MAX_ADJUST_QUANTITY) return `Quantity cannot be more than ${MAX_ADJUST_QUANTITY.toLocaleString('en-IN')} at a time`;
    if (!isIncrease && single && value > single.stock) {
      return `Only ${single.stock} in stock - you cannot deduct more than that`;
    }
    return '';
  };

  const handleQuantityChange = (e) => {
    setQuantityText(e.target.value);
    if (quantityError) setQuantityError(validateQuantity(e.target.value));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const error = validateQuantity(quantityText);
    setQuantityError(error);
    if (error) return;
    onSubmit({ quantity, remark: remark.trim() });
  };

  // Sizes in the selection that don't have enough stock for this deduction.
  const shortItems = !isIncrease && isBulk && quantity ? items.filter((item) => item.stock < quantity) : [];
  const isQuantityUsable = quantity !== null && quantity >= 1 && !validateQuantity(quantityText);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {single ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className={`font-medium ${theme.text.heading}`}>{single.productName}</p>
          <p className={`text-sm ${theme.text.body}`}>
            {single.variantName} · {single.sizeName}
            {single.sku ? ` · SKU ${single.sku}` : ''}
          </p>
          <p className={`mt-1 text-sm ${theme.text.body}`}>
            Current stock: <span className={`font-semibold ${theme.text.heading}`}>{single.stock}</span>
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className={`font-medium ${theme.text.heading}`}>{items.length} items selected</p>
          <ul className={`mt-1 max-h-32 overflow-y-auto text-sm ${theme.text.body} space-y-0.5`}>
            {items.map((item) => (
              <li key={item._id} className="flex justify-between gap-3">
                <span className="truncate">
                  {item.productName} · {item.variantName} · {item.sizeName}
                </span>
                <span className="tabular-nums shrink-0">{item.stock} in stock</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <InputField
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          label={
            isIncrease
              ? `Quantity to ADD${isBulk ? ' to each selected item' : ''}`
              : `Quantity to DEDUCT${isBulk ? ' from each selected item' : ''}`
          }
          name="quantity"
          placeholder="e.g. 10"
          maxLength={7}
          value={quantityText}
          onChange={handleQuantityChange}
          error={quantityError}
          disabled={submitting}
        />
        <p className={`mt-1 text-xs ${theme.text.muted}`}>
          {isIncrease
            ? 'This number will be ADDED to the current stock - it does not replace it.'
            : 'This number will be DEDUCTED from the current stock - it does not replace it.'}
        </p>
      </div>

      {isQuantityUsable && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${theme.preview[operation]}`} aria-live="polite">
          {single ? (
            <>
              <span className="font-semibold">{quantity}</span> will be {isIncrease ? 'added to' : 'deducted from'} the
              stock: {single.stock} {isIncrease ? '+' : '−'} {quantity} ={' '}
              <span className="font-semibold">{isIncrease ? single.stock + quantity : single.stock - quantity}</span>
            </>
          ) : (
            <>
              <span className="font-semibold">{quantity}</span> will be {isIncrease ? 'added to' : 'deducted from'} the
              stock of <span className="font-semibold">each</span> of the {items.length} selected items.
              {shortItems.length > 0 && (
                <span className="block mt-1">
                  {shortItems.length} of them {shortItems.length === 1 ? 'has' : 'have'} less than {quantity} in stock
                  and will be skipped.
                </span>
              )}
            </>
          )}
        </div>
      )}

      <TextArea
        label="Remark (optional)"
        name="remark"
        placeholder={isIncrease ? 'e.g. New stock received from supplier' : 'e.g. Damaged pieces removed'}
        rows={3}
        maxLength={MAX_REMARK_LENGTH}
        showCharCount
        value={remark}
        onChange={(e) => setRemark(e.target.value)}
        disabled={submitting}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant={isIncrease ? theme.button.primary : theme.button.danger} loading={submitting}>
          {isIncrease ? 'Increase Stock' : 'Deduct Stock'}
        </Button>
      </div>
    </form>
  );
};

export default StockAdjustForm;
