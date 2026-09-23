import { useRef, useState } from 'react';
import theme from '../../Home/theme/theme';

const MAX_TYPED_QUANTITY = 100000;

/**
 * Add to Cart control shared by the product card, list row, detail page and
 * cart page. Renders a plain "Add to Cart" button while the item isn't in the
 * cart yet; once it is (quantity > 0), swaps to − [quantity] + so the shopper
 * can adjust or remove it without leaving the page.
 *
 * The quantity is a text field: the shopper can type the exact amount, saved
 * on Enter or when the field loses focus (so typing "12" never saves "1"
 * first). Typing 0 removes the item; leaving it empty puts the old quantity
 * back. Stock is enforced by the backend - see App.jsx handleSetItemQuantity,
 * which falls back to the available stock with a message.
 *
 * @param {Object} props
 * @param {number} props.quantity - Current quantity of this item in the cart (0 = not added yet).
 * @param {boolean} props.inStock
 * @param {number} [props.maxQuantity] - Stock ceiling; "+" disables at this quantity.
 * @param {'md'|'lg'} [props.size]
 * @param {Function} props.onAdd
 * @param {Function} props.onIncrement
 * @param {Function} props.onDecrement
 * @param {(quantity: number) => void} [props.onSetQuantity] - Typed quantity; without it the field is read-only.
 */
const QuantityStepper = ({
  quantity,
  inStock,
  maxQuantity = Infinity,
  size = 'md',
  onAdd,
  onIncrement,
  onDecrement,
  onSetQuantity,
}) => {
  // What the shopper is typing - null while the field isn't being edited, so
  // the field otherwise always shows the cart's real quantity.
  const [draft, setDraft] = useState(null);
  // Set by Escape so the blur that follows discards the draft instead of saving it.
  const cancelRef = useRef(false);

  const heightClass = theme.card.buttonHeight[size] ?? theme.card.buttonHeight.md;
  // Product cards open the product on click - controls inside must not.
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn?.();
  };

  const commitDraft = () => {
    const text = cancelRef.current ? '' : (draft ?? '').trim();
    cancelRef.current = false;
    setDraft(null);
    if (!text) return; // empty -> keep the current quantity
    const next = Math.min(Number.parseInt(text, 10), MAX_TYPED_QUANTITY);
    if (Number.isNaN(next) || next === quantity) return;
    onSetQuantity?.(next);
  };

  if (!inStock) {
    return (
      <button type="button" disabled className={`w-full ${heightClass} ${theme.card.outOfStockLayout} ${theme.card.outOfStock}`}>
        Out of Stock
      </button>
    );
  }

  if (quantity > 0) {
    return (
      <div className={`${theme.card.stepperLayout} ${theme.card.button}`} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={stop(onDecrement)}
          aria-label="Decrease quantity"
          className={`${theme.card.stepperButtonLayout} ${theme.card.stepperButtonLeft}`}
        >
          −
        </button>
        {onSetQuantity ? (
          <input
            type="text"
            inputMode="numeric"
            aria-label="Quantity"
            maxLength={6}
            value={draft ?? String(quantity)}
            onFocus={(e) => {
              setDraft(String(quantity));
              e.target.select();
            }}
            // Digits only - no signs, decimals or letters.
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                cancelRef.current = true;
                e.currentTarget.blur();
              }
            }}
            onBlur={commitDraft}
            className={theme.card.stepperInputLayout}
          />
        ) : (
          <span className={theme.card.stepperCountLayout}>{quantity}</span>
        )}
        <button
          type="button"
          onClick={stop(onIncrement)}
          disabled={quantity >= maxQuantity}
          aria-label="Increase quantity"
          className={`${theme.card.stepperButtonLayout} ${theme.card.stepperButtonRight}`}
        >
          +
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={stop(onAdd)}
      className={`w-full ${heightClass} ${theme.card.buttonLayout} ${theme.card.button}`}
    >
      <span className={theme.card.buttonShine} />
      Add to Cart
    </button>
  );
};

export default QuantityStepper;
