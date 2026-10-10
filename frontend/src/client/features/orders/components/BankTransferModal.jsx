import Modal from '../../../../components/common/Modal/Modal';
import theme from '../../Home/theme/theme';
import { useCurrency } from '../../../currency/useCurrency';

const ACCOUNT_TYPES = { SAVINGS: 'Savings', CURRENT: 'Current' };

// wa.me wants digits only, country code included ("+91 98765 43210" -> "919876543210").
const whatsappDigits = (number) => String(number || '').replace(/\D/g, '');

const BankRow = ({ label, value }) =>
  value ? (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="font-medium text-slate-900 text-right break-all">{value}</dd>
    </div>
  ) : null;

/**
 * Shown after an order is placed with "Pay online": the store's QR code on the
 * left and its bank details on the right (whichever the store has filled in,
 * all from Company Settings), then a WhatsApp link that tells the store the
 * payment has been made.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Object} props.online - { scannerUrl, bank, whatsappNumber, companyName } from /payments/options.
 * @param {Object} props.order - The placed order ({ orderNumber, grandTotal }).
 * @param {string} [props.customerName]
 * @param {string} [props.doneLabel] - Text of the close button.
 * @param {Function} props.onDone - Close (checkout goes on to the order).
 */
const BankTransferModal = ({ isOpen, online, order, customerName = '', doneLabel = 'View my order', onDone }) => {
  const { formatMoney } = useCurrency();
  if (!online || !order) return null;

  const { scannerUrl, bank, gpayNumber, whatsappNumber, companyName } = online;
  const amount = formatMoney(order.grandTotal);
  const digits = whatsappDigits(whatsappNumber);

  const message = [
    `Hello${companyName ? ` ${companyName}` : ''},`,
    `I have made the payment of ${amount} for order ${order.orderNumber}.`,
    customerName ? `Name: ${customerName}` : null,
    'Please confirm.',
  ]
    .filter(Boolean)
    .join('\n');
  const whatsappHref = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDone}
      title={`Pay ${amount} for order ${order.orderNumber}`}
      size="lg"
      closeOnOverlayClick={false}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            {doneLabel}
          </button>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2 rounded-lg text-sm font-semibold text-center text-white bg-emerald-600 hover:bg-emerald-700 transition-colors duration-150"
            >
              I have paid - send details on WhatsApp
            </a>
          )}
        </div>
      }
    >
      <p className="text-sm text-slate-600 mb-4">
        Your order is placed. Pay the amount using the QR code or bank details below, then tell us on WhatsApp so we can confirm it.
      </p>

      <div className={`grid gap-6 ${(scannerUrl || gpayNumber) && bank ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        {(scannerUrl || gpayNumber) && (
          <div className="flex flex-col items-center">
            {scannerUrl && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Scan to pay</h3>
                <img src={scannerUrl} alt="Payment QR code" className="w-full max-w-60 rounded-lg border border-slate-200 bg-white object-contain" />
              </>
            )}
            {gpayNumber && (
              <div className={`text-center ${scannerUrl ? 'mt-4' : ''}`}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">GPay number</h3>
                <p className="text-base font-semibold text-slate-900 break-all">{gpayNumber}</p>
              </div>
            )}
          </div>
        )}

        {bank && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Bank details</h3>
            <dl className="divide-y divide-slate-100">
              <BankRow label="Account holder" value={bank.accountHolderName} />
              <BankRow label="Bank" value={bank.bankName} />
              <BankRow label="Account number" value={bank.accountNumber} />
              <BankRow label="IFSC" value={bank.ifscCode} />
              <BankRow label="Branch" value={bank.branchName} />
              <BankRow label="SWIFT" value={bank.swiftCode} />
              <BankRow label="Account type" value={ACCOUNT_TYPES[bank.accountType] || bank.accountType} />
            </dl>
          </div>
        )}
      </div>

      {!whatsappHref && (
        <p className={`mt-4 text-xs ${theme.section.subheading}`}>
          After paying, please contact the store with your order number {order.orderNumber}.
        </p>
      )}
    </Modal>
  );
};

export default BankTransferModal;
