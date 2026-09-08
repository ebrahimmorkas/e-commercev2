import { useState } from 'react';
import theme from '../../Home/theme/theme';
import Spinner from '../../../../components/common/Spinner/Spinner';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';
import AddressPicker from '../../address/components/AddressPicker';
import { placeOrder } from '../api/ordersApi';

const formatMoney = (amount) => `₹${(amount ?? 0).toLocaleString('en-IN')}`;

/**
 * Address selection + order placement. POSTs to /api/orders/place-order,
 * which re-validates/re-prices the cart server-side one final time (see
 * orderService.js's createOrderFromCart) - eligibleSubtotal/grandTotal shown
 * here are only an estimate from the cart itself, not guaranteed to match
 * exactly what the placed order comes back with.
 *
 * @param {Array} lineItems
 * @param {number} subtotal
 * @param {boolean} cartLoading
 * @param {Function} onBack - Back to cart.
 * @param {Function} onPlaced - Called with the new order's _id on success.
 */
const CheckoutPage = ({ lineItems = [], subtotal = 0, cartLoading, onBack, onPlaced }) => {
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      setError('Please select a shipping address.');
      return;
    }
    setError('');
    setPlacing(true);
    try {
      const result = await placeOrder({ shippingAddressId: selectedAddressId });
      onPlaced(result.order._id);
    } catch (err) {
      setError(err.message || 'Could not place order');
    } finally {
      setPlacing(false);
    }
  };

  if (cartLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" label="Loading checkout" />
      </div>
    );
  }

  if (lineItems.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <EmptyState
          title="Your cart is empty"
          description="Add something to your cart before checking out."
          action={
            <button
              type="button"
              onClick={onBack}
              className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${theme.hero.cta}`}
            >
              Back to Cart
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer mb-4 sm:mb-6"
      >
        ← Back to cart
      </button>

      <h1 className={`text-xl sm:text-2xl font-bold ${theme.section.heading}`}>Checkout</h1>

      {error && (
        <div className="mt-4 px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        <div className={`md:col-span-2 rounded-xl border p-4 sm:p-5 ${theme.card.background} ${theme.card.border}`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">Shipping address</h2>
          <AddressPicker selectedId={selectedAddressId} onSelect={setSelectedAddressId} />
        </div>

        <div className={`h-fit rounded-xl border p-4 sm:p-5 ${theme.card.background} ${theme.card.border}`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Order Summary</h2>
          <div className="mt-4 flex justify-between text-sm text-slate-600">
            <span>Items ({lineItems.reduce((sum, item) => sum + item.quantity, 0)})</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="mt-2 pt-3 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
            <span>Estimated total</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Final taxes/discounts are calculated when the order is placed.</p>
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={placing}
            className={`mt-5 w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors duration-150 disabled:opacity-60 ${theme.card.button}`}
          >
            {placing ? 'Placing order...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
