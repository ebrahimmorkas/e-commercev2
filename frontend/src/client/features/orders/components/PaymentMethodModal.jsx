import { useState } from 'react';
import Modal from '../../../../components/common/Modal/Modal';
import theme from '../../Home/theme/theme';

const METHODS = {
  COD: 'COD',
  ONLINE: 'ONLINE',
};

/**
 * "How would you like to pay?" - asked before the order is confirmed.
 * Cash on Delivery is only listed when the store has it on; Pay online (QR /
 * bank transfer) only when the store has filled in its payment details.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {boolean} props.codEnabled
 * @param {boolean} props.onlineEnabled
 * @param {boolean} props.placing - The order is being placed.
 * @param {string} [props.error]
 * @param {Function} props.onClose
 * @param {Function} props.onConfirm - Called with 'COD' or 'ONLINE'.
 */
const PaymentMethodModal = ({ isOpen, codEnabled, onlineEnabled, placing = false, error = '', onClose, onConfirm }) => {
  // Only one choice offered: it is already the answer.
  const only = codEnabled && !onlineEnabled ? METHODS.COD : onlineEnabled && !codEnabled ? METHODS.ONLINE : null;
  const [picked, setPicked] = useState(null);
  const method = only || picked;

  const option = (value, title, description) => (
    <label
      key={value}
      className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors duration-150 ${
        method === value ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <input
        type="radio"
        name="payment-method"
        value={value}
        checked={method === value}
        onChange={() => setPicked(value)}
        disabled={placing}
        className="mt-1 accent-amber-600"
      />
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500 mt-0.5">{description}</span>
      </span>
    </label>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={placing ? undefined : onClose}
      closeOnOverlayClick={!placing}
      closeOnEsc={!placing}
      title="Choose a payment method"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={placing}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(method)}
            disabled={!method || placing}
            className={`px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60 ${theme.card.button}`}
          >
            {placing ? 'Placing order...' : 'Confirm Order'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700" role="alert">
            {error}
          </div>
        )}
        {codEnabled && option(METHODS.COD, 'Cash on Delivery', 'Pay in cash when your order is delivered.')}
        {onlineEnabled && option(METHODS.ONLINE, 'Pay online (QR / bank transfer)', 'Scan the QR or transfer to our bank account, then tell us on WhatsApp.')}
      </div>
    </Modal>
  );
};

export { METHODS as PAYMENT_METHOD_CHOICES };
export default PaymentMethodModal;
