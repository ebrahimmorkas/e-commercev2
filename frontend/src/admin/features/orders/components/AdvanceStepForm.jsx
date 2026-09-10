import { useState } from 'react';
import Button from '../../../../components/common/Buttons';
import theme from '../theme/theme';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

/**
 * @param {Array<{ code: string, name: string, sequence: number }>} stepOptions - this order's workflow steps (GET /orders/admin/:id/steps)
 * @param {string} currentStepCode
 * @param {Function} onSubmit - (targetStepCode, remarks) => Promise<boolean>
 * @param {Function} onCancel
 * @param {boolean} submitting
 */
const AdvanceStepForm = ({ stepOptions, currentStepCode, onSubmit, onCancel, submitting }) => {
  const [targetStepCode, setTargetStepCode] = useState('');
  const [remarks, setRemarks] = useState('');

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
            <option key={step.code} value={step.code} disabled={step.code === currentStepCode}>
              {step.name} {step.code === currentStepCode ? '(current)' : ''}
            </option>
          ))}
        </select>
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
