import theme from '../../Home/theme/theme';

/**
 * Add to Cart control shared by the product card and the detail page.
 * Renders a plain "Add to Cart" button while the item isn't in the cart yet;
 * once it is (quantity > 0), swaps to a −/+ stepper so the shopper can adjust
 * or remove it (decrementing to 0 removes it) without leaving the page.
 *
 * @param {Object} props
 * @param {number} props.quantity - Current quantity of this item in the cart (0 = not added yet).
 * @param {boolean} props.inStock
 * @param {number} [props.maxQuantity] - Stock ceiling; "+" disables at this quantity.
 * @param {'md'|'lg'} [props.size]
 * @param {Function} props.onAdd
 * @param {Function} props.onIncrement
 * @param {Function} props.onDecrement
 */
const QuantityStepper = ({
  quantity,
  inStock,
  maxQuantity = Infinity,
  size = 'md',
  onAdd,
  onIncrement,
  onDecrement,
}) => {
  const heightClass = theme.card.buttonHeight[size] ?? theme.card.buttonHeight.md;
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn?.();
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
      <div className={`${theme.card.stepperLayout} ${theme.card.button}`}>
        <button
          type="button"
          onClick={stop(onDecrement)}
          aria-label="Decrease quantity"
          className={`${theme.card.stepperButtonLayout} ${theme.card.stepperButtonLeft}`}
        >
          −
        </button>
        <span className={theme.card.stepperCountLayout}>{quantity}</span>
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
