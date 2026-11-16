import { useState } from 'react';
import { reportCheckoutIssue } from '../api/paymentApi';
import { CHECKOUT_ISSUE_REASONS } from '../checkoutIssueConstants';

/**
 * Shown at checkout instead of letting the order through when the store
 * can't take payment: Cash on Delivery is off and the bank details (QR / bank
 * transfer / GPay) could not be loaded or aren't set up. The customer can try
 * again, or report it - the report is emailed to the platform owner.
 *
 * @param {Object} props
 * @param {string} props.reason - CHECKOUT_ISSUE_REASONS
 * @param {string} [props.errorMessage] - What loading the options failed with.
 * @param {string} [props.cartTotal] - The total shown at checkout (formatted).
 * @param {number} [props.itemCount]
 * @param {boolean} [props.retrying]
 * @param {Function} props.onRetry
 */
const PaymentUnavailableNotice = ({ reason, errorMessage = '', cartTotal = '', itemCount = null, retrying = false, onRetry }) => {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok: boolean, message: string }

  const handleReport = async () => {
    setSending(true);
    setResult(null);
    try {
      await reportCheckoutIssue({
        reason,
        errorMessage: errorMessage ? errorMessage.slice(0, 500) : null,
        cartTotal: cartTotal ? String(cartTotal).slice(0, 50) : null,
        itemCount,
        pageUrl: window.location.href.slice(0, 500),
      });
      setResult({ ok: true, message: 'Thank you - the problem has been reported. Please try again later.' });
    } catch (err) {
      setResult({ ok: false, message: err?.message || 'Your report could not be sent right now. Please try again later.' });
    } finally {
      setSending(false);
    }
  };

  const title = reason === CHECKOUT_ISSUE_REASONS.OPTIONS_FAILED
    ? "We can't load the store's bank details right now"
    : "This store can't take payment right now";

  return (
    <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">
        Cash on Delivery isn't available for this store, and the bank details you would pay to couldn't be shown, so your
        order can't be placed yet. Nothing has been charged and your cart is saved.
      </p>
      <p className="mt-1">Please try again in a little while, or let us know so we can fix it.</p>

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying || sending}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-amber-400 bg-white text-amber-900 hover:bg-amber-100 cursor-pointer disabled:opacity-60"
        >
          {retrying ? 'Trying again...' : 'Try again'}
        </button>
        <button
          type="button"
          onClick={handleReport}
          disabled={sending || result?.ok}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 cursor-pointer disabled:opacity-60"
        >
          {sending ? 'Sending report...' : result?.ok ? 'Problem reported' : 'Report this problem'}
        </button>
      </div>

      {result && (
        <p className={`mt-2 text-xs ${result.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">
          {result.message}
        </p>
      )}
    </div>
  );
};

export default PaymentUnavailableNotice;
