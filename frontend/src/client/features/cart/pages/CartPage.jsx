import { useState } from 'react';
import theme from '../../Home/theme/theme';
import Modal from '../../../../components/common/Modal/Modal';
import AddressPicker from '../../address/components/AddressPicker';
import QuantityStepper from '../../products/components/QuantityStepper';
import Spinner from '../../../../components/common/Spinner/Spinner';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';
import { useShippingEstimate } from '../hooks/useShippingEstimate';
import { formatShippingEstimate, shippingAmountForTotal } from '../utils/formatShipping';

const formatMoney = (amount) => `₹${(amount ?? 0).toLocaleString('en-IN')}`;

// item.sizeName is only the size's category (e.g. "Clothing Size") - the
// actual value the shopper picked (e.g. "S") lives separately in
// labelValue (LABEL-type sizes only; null for MEASURABLE-type).
const formatSize = (item) => (item.labelValue ? `${item.sizeName}: ${item.labelValue}` : item.sizeName);

// Stacks (name+details, then controls) on narrow screens where a single
// row can't fit product info + stepper + total + remove without wrapping
// text mid-word; reverts to one row from `sm` up.
const CartLineItem = ({ item, onIncrement, onDecrement, onRemove }) => (
  <div className={`flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b last:border-b-0 ${theme.card.border}`}>
    <div className="min-w-0 flex-1">
      <h3 className={`text-sm font-semibold truncate ${theme.card.name}`}>{item.productName}</h3>
      <p className="mt-0.5 text-xs text-slate-500 truncate">
        {item.variantName} · {formatSize(item)}
      </p>
      <p className={`mt-1 text-sm font-bold ${theme.card.price}`}>{formatMoney(item.unitPrice)}</p>
    </div>

    <div className="flex items-center justify-between sm:justify-end gap-3 sm:shrink-0">
      <div className="shrink-0">
        <QuantityStepper
          quantity={item.quantity}
          inStock
          onIncrement={() => onIncrement(item.sizeId)}
          onDecrement={() => onDecrement(item.sizeId)}
        />
      </div>

      <span className="w-14 shrink-0 text-right text-sm font-bold text-slate-900">
        {formatMoney(item.unitPrice * item.quantity)}
      </span>

      <button
        type="button"
        onClick={() => onRemove(item.sizeId)}
        aria-label={`Remove ${item.productName} from cart`}
        className="shrink-0 p-2 -m-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors duration-150"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </button>
    </div>
  </div>
);

/**
 * Storefront cart view: full line-item list with quantity/remove controls
 * and a subtotal summary. Backed by the real cart (see
 * features/cart/hooks/useCart.js) via props, same lifting pattern as
 * ProductDetailPage - App.jsx owns the one useCart() instance.
 *
 * @param {Object} props
 * @param {Array} props.lineItems - Flattened cart line items (see utils/shapeCart.js).
 * @param {number} props.subtotal
 * @param {boolean} props.loading
 * @param {string} [props.error]
 * @param {Function} props.onBack - Called to return to shopping.
 * @param {Function} props.onIncrementItem - Called with a sizeId.
 * @param {Function} props.onDecrementItem - Called with a sizeId.
 * @param {Function} props.onRemoveItem - Called with a sizeId.
 * @param {Function} [props.onCheckout] - Called when "Proceed to Checkout" is clicked.
 * @param {boolean} [props.isAuthenticated] - Saved addresses (and so changing the delivery address) need a login.
 * @param {string|null} [props.addressId] - Saved address the shipping estimate is priced against.
 * @param {Function} [props.onAddressChange] - Called with a saved address _id (or null).
 * @param {Function} [props.reload]
 */
const CartPage = ({
  lineItems = [],
  subtotal = 0,
  loading,
  error,
  onBack,
  onIncrementItem,
  onDecrementItem,
  onRemoveItem,
  onCheckout,
  isAuthenticated = false,
  addressId = null,
  onAddressChange,
  reload,
}) => {
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const itemCount = lineItems.reduce((sum, item) => sum + item.quantity, 0);
  const { estimate: shippingEstimate } = useShippingEstimate({
    addressId,
    refreshKey: `${itemCount}:${subtotal}`,
    skip: lineItems.length === 0,
  });
  const deliveringTo = shippingEstimate?.deliveringTo;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer mb-4 sm:mb-6"
      >
        ← Continue shopping
      </button>

      <h1 className={`text-xl sm:text-2xl font-bold ${theme.section.heading}`}>Your Cart</h1>
      {(deliveringTo?.label || isAuthenticated) && (
        <p className="mt-1 text-sm text-slate-500">
          {deliveringTo?.label && (
            <>
              Delivering to: <span className="font-medium text-slate-700">{deliveringTo.addressName ? `${deliveringTo.addressName} - ` : ''}{deliveringTo.label}</span>
            </>
          )}
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setAddressModalOpen(true)}
              className="ml-2 font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
            >
              {deliveringTo?.label ? 'Change' : 'Choose delivery address'}
            </button>
          )}
        </p>
      )}

      <Modal isOpen={addressModalOpen} onClose={() => setAddressModalOpen(false)} title="Delivery address" size="md">
        <AddressPicker selectedId={addressId} onSelect={onAddressChange} />
        <button
          type="button"
          onClick={() => setAddressModalOpen(false)}
          className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer bg-slate-900 hover:bg-amber-600 text-white transition-colors duration-150"
        >
          Done
        </button>
      </Modal>

      {loading && (
        <div className="flex justify-center py-24">
          <Spinner size="lg" label="Loading cart" />
        </div>
      )}

      {!loading && error && (
        <EmptyState
          title="Couldn't load your cart"
          description={error}
          action={
            <button
              type="button"
              onClick={reload}
              className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${theme.hero.cta}`}
            >
              Try Again
            </button>
          }
        />
      )}

      {!loading && !error && lineItems.length === 0 && (
        <EmptyState
          title="Your cart is empty"
          description="Add something you love and it'll show up here."
          action={
            <button
              type="button"
              onClick={onBack}
              className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${theme.hero.cta}`}
            >
              Start Shopping
            </button>
          }
        />
      )}

      {!loading && !error && lineItems.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className={`md:col-span-2 rounded-xl border px-3 sm:px-4 ${theme.card.background} ${theme.card.border}`}>
            {lineItems.map((item) => (
              <CartLineItem
                key={item.sizeId}
                item={item}
                onIncrement={onIncrementItem}
                onDecrement={onDecrementItem}
                onRemove={onRemoveItem}
              />
            ))}
          </div>

          <div className={`h-fit rounded-xl border p-4 sm:p-5 ${theme.card.background} ${theme.card.border}`}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Order Summary</h2>
            <div className="mt-4 flex justify-between text-sm text-slate-600">
              <span>Items ({itemCount})</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {shippingEstimate && (
              <div className="mt-2 flex justify-between text-sm text-slate-600">
                <span>Shipping</span>
                <span>{formatShippingEstimate(shippingEstimate, formatMoney)}</span>
              </div>
            )}
            {shippingEstimate?.isShippingPending && (
              <p className="mt-1 text-xs text-slate-500">Shipping price will be manually calculated by admin.</p>
            )}
            <div className="mt-2 pt-3 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
              <span>{shippingEstimate ? 'Estimated total' : 'Subtotal'}</span>
              <span>{formatMoney(subtotal + shippingAmountForTotal(shippingEstimate))}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Taxes and discounts calculated at checkout.</p>
            <button
              type="button"
              onClick={onCheckout}
              className={`mt-5 w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors duration-150 ${theme.card.button}`}
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
