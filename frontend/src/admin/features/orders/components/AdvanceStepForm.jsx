import { useState } from 'react';
import Button from '../../../../components/common/Buttons';
import theme from '../theme/theme';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

// What each kind of move does besides changing the status - shown under the dropdown.
const ACTION_HINTS = {
  PAYMENT_AT_DELIVERY:
    'Use this when the customer pays the delivery agent. The payment is marked as done when the delivery agent step change happens.',
  REJECT: 'The stock goes back, and the commission and invoice are voided. The order can be restarted later.',
  REFUND: 'Records that the payment was given back to the customer. The order can be restarted later.',
  RESTART: 'Takes the stock again (refused if a product is short), and issues a new invoice.',
};

/**
 * @param {Array<{ code: string, name: string, type: string }>} stepOptions - what the order can do right now (GET /orders/admin/:id/steps): the next step, and Payment at Delivery / Reject / Refund / Restart when allowed
 * @param {Function} onSubmit - (targetStepCode, remarks) => Promise<boolean>
 * @param {Function} onCancel
 * @param {boolean} submitting
 */
const AdvanceStepForm = ({ stepOptions, onSubmit, onCancel, submitting }) => {
  const [targetStepCode, setTargetStepCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const selectedOption = stepOptions.find((step) => step.code === targetStepCode);
  const hint = selectedOption ? ACTION_HINTS[selectedOption.type] : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetStepCode) return;
    const success = await onSubmit(targetStepCode, remarks.trim());
    if (success) {
      setTargetStepCode('');
      setRemarks('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <select
          value={targetStepCode}
          onChange={(e) => setTargetStepCode(e.target.value)}
          className={inputClass}
          required
          disabled={submitting}
        >
          <option value="" disabled>
            Select status
          </option>
          {stepOptions.map((step) => (
            <option key={step.code} value={step.code}>
              {step.name}
            </option>
          ))}
        </select>
        {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      </div>
      <textarea
        placeholder="Remarks (optional)"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        className={`${inputClass} min-h-16 resize-none`}
        maxLength={500}
        disabled={submitting}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant={theme.button.primary} loading={submitting}>
          Update status
        </Button>
      </div>
    </form>
  );
};

export default AdvanceStepForm;
