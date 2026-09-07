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
  const heightClass = size === 'lg' ? 'py-2.5 px-8' : 'py-2';
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn?.();
  };

  if (!inStock) {
    return (
      <button
        type="button"
        disabled
        className={`w-full ${heightClass} rounded-lg text-sm font-medium bg-slate-200 text-slate-400 cursor-not-allowed`}
      >
        Out of Stock
      </button>
    );
  }

  if (quantity > 0) {
    return (
      <div className={`flex items-center justify-between rounded-lg ${theme.card.button}`}>
        <button
          type="button"
          onClick={stop(onDecrement)}
          aria-label="Decrease quantity"
          className="px-4 py-2 text-base font-semibold cursor-pointer hover:bg-black/10 rounded-l-lg"
        >
          −
        </button>
        <span className="text-sm font-semibold min-w-6 text-center">{quantity}</span>
        <button
          type="button"
          onClick={stop(onIncrement)}
          disabled={quantity >= maxQuantity}
          aria-label="Increase quantity"
          className="px-4 py-2 text-base font-semibold cursor-pointer hover:bg-black/10 rounded-r-lg disabled:opacity-40 disabled:cursor-not-allowed"
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
      className={`w-full ${heightClass} rounded-lg text-sm font-medium cursor-pointer transition-colors duration-150 ${theme.card.button}`}
    >
      Add to Cart
    </button>
  );
};

export default QuantityStepper;
