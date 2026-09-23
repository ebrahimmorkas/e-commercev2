import InputField from '../../../../components/common/InputField';
import TextArea from '../../../../components/common/TextArea';
import Switch from '../../../../components/common/Switch';
import theme from '../theme/theme';
import { useStoreCurrency } from '../../../currency/useStoreCurrency';

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 */
const BasicDetailsStep = ({ draft, onChange }) => {
  // Amounts are entered in the store currency (Company Settings).
  const { symbol } = useStoreCurrency();
  const set = (patch) => onChange({ ...draft, ...patch });

  return (
    <div className="space-y-5">
      <InputField
        label="Free Cash Name"
        name="freeCashName"
        placeholder="e.g. Welcome Bonus"
        value={draft.freeCashName}
        onChange={(e) => set({ freeCashName: e.target.value })}
        required
        maxLength={150}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField
          label={`Free Cash Amount (${symbol})`}
          name="freeCashAmount"
          type="number"
          min={0}
          placeholder="e.g. 100"
          value={draft.freeCashAmount}
          onChange={(e) => set({ freeCashAmount: e.target.value })}
          required
        />
        <InputField
          label={`Max Usage Per Order (${symbol})`}
          name="maxCashUsagePerOrder"
          type="number"
          min={0}
          placeholder="Optional - no limit if left blank"
          value={draft.maxCashUsagePerOrder}
          onChange={(e) => set({ maxCashUsagePerOrder: e.target.value })}
        />
      </div>
      <p className={`-mt-3 text-xs ${theme.text.muted}`}>
        Leave "Max Usage Per Order" blank to allow the full granted amount to be used on a single order.
      </p>

      <InputField
        label={`Valid Above Amount (${symbol})`}
        name="validAbove"
        type="number"
        min={0}
        placeholder="e.g. 500"
        value={draft.validAbove}
        onChange={(e) => set({ validAbove: e.target.value })}
        helperText="Minimum cart value required before this Free Cash can be applied."
      />

      <Switch
        label="Can be used with other discounts"
        description="Allow this Free Cash to be applied on the same order as a discount. Each one's own minimum-amount requirement is checked against the cart total remaining after the other is applied."
        checked={draft.canBeUsedWithOtherDiscounts}
        onChange={(e) => set({ canBeUsedWithOtherDiscounts: e.target.checked })}
        color={theme.switch.color}
      />

      <TextArea
        label="Remarks"
        name="remarks"
        placeholder="Optional"
        value={draft.remarks}
        onChange={(e) => set({ remarks: e.target.value })}
        rows={2}
      />
    </div>
  );
};

export default BasicDetailsStep;
