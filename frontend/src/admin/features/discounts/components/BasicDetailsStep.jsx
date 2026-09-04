import InputField from '../../../../components/common/InputField';
import TextArea from '../../../../components/common/TextArea';
import { RadioGroup } from '../../../../components/common/Radio';
import Switch from '../../../../components/common/Switch';
import { DISCOUNT_TYPE_OPTIONS } from '../constants';
import theme from '../theme/theme';

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {string[]} props.allowedDiscountTypes - companyMaster.allowedDiscountTypes (empty = all allowed)
 */
const BasicDetailsStep = ({ draft, onChange, allowedDiscountTypes = [] }) => {
  const set = (patch) => onChange({ ...draft, ...patch });

  const discountTypeOptions =
    allowedDiscountTypes.length > 0
      ? DISCOUNT_TYPE_OPTIONS.filter((opt) => allowedDiscountTypes.includes(opt.value))
      : DISCOUNT_TYPE_OPTIONS;

  return (
    <div className="space-y-5">
      <InputField
        label="Discount Name"
        name="name"
        placeholder="e.g. Diwali Sale"
        value={draft.name}
        onChange={(e) => set({ name: e.target.value })}
        required
        maxLength={200}
      />

      <TextArea
        label="Description"
        name="description"
        placeholder="Shown to customers wherever this discount is advertised"
        value={draft.description}
        onChange={(e) => set({ description: e.target.value })}
        rows={2}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextArea
          label="Remarks"
          name="remarks"
          placeholder="Optional"
          value={draft.remarks}
          onChange={(e) => set({ remarks: e.target.value })}
          rows={2}
        />
        <TextArea
          label="Internal Notes"
          name="internalNotes"
          placeholder="Admin-only, never shown to customers"
          value={draft.internalNotes}
          onChange={(e) => set({ internalNotes: e.target.value })}
          rows={2}
        />
      </div>

      <RadioGroup
        label="Discount Type"
        name="discountType"
        options={discountTypeOptions}
        value={draft.discountType}
        onChange={(val) => set({ discountType: val })}
        direction="horizontal"
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField
          label={draft.discountType === 'PERCENTAGE' ? 'Discount Value (%)' : 'Discount Value (₹)'}
          name="discountValue"
          type="number"
          min={0}
          max={draft.discountType === 'PERCENTAGE' ? 100 : undefined}
          placeholder={draft.discountType === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 500'}
          value={draft.discountValue}
          onChange={(e) => set({ discountValue: e.target.value })}
          required
        />
        <InputField
          label="Precedence"
          name="precedence"
          type="number"
          min={0}
          value={draft.precedence}
          onChange={(e) => set({ precedence: e.target.value })}
        />
      </div>
      <p className={`-mt-3 text-xs ${theme.text.muted}`}>
        Precedence decides ordering when multiple discounts could apply to the same order - higher runs first.
      </p>

      <Switch
        label="Auto-apply"
        description="Apply automatically at checkout without the customer entering anything"
        checked={draft.autoApply}
        onChange={(e) => set({ autoApply: e.target.checked })}
        color={theme.switch.color}
      />
    </div>
  );
};

export default BasicDetailsStep;
