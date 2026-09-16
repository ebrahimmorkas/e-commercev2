import Switch from '../../../../components/common/Switch';
import InputField from '../../../../components/common/InputField';
import theme from '../theme/theme';

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 */
const FreeCashSection = ({ draft, onChange }) => {
  const set = (patch) => onChange(patch);

  return (
    <div className="space-y-3">
      <Switch
        label="Show Free Cash"
        description="Vendor's own show/hide toggle - sits below the platform's Free Cash entitlement for this account."
        checked={draft.isFreeCashFeatureOn}
        onChange={(e) => set({ isFreeCashFeatureOn: e.target.checked })}
        color={theme.switch.color}
      />

      {draft.isFreeCashFeatureOn && (
        <div className="border border-gray-200 rounded-lg p-3 space-y-3">
          <Switch
            label="Allow Free Cash Stacking"
            description="A new Free Cash grant doesn't expire any Free Cash a user is already holding."
            checked={draft.isFreeCashStackingAllowed}
            onChange={(e) => set({ isFreeCashStackingAllowed: e.target.checked })}
            color={theme.switch.color}
          />
          {draft.isFreeCashStackingAllowed && (
            <Switch
              label="Allow Using Multiple Free Cash Grants per Order"
              checked={draft.isMultipleFreeCashUsageAllowed}
              onChange={(e) => set({ isMultipleFreeCashUsageAllowed: e.target.checked })}
              color={theme.switch.color}
            />
          )}
          <Switch
            label="Store Remaining Free Cash Amount for Reuse"
            description="A leftover balance stays usable across multiple orders instead of being forfeited after first use."
            checked={draft.isStoringRemainingFreeCashAmountAllowed}
            onChange={(e) => set({ isStoringRemainingFreeCashAmountAllowed: e.target.checked })}
            color={theme.switch.color}
          />

          <div className="pt-2 border-t border-gray-100">
            <Switch
              label="Refund Free Cash on Order Return"
              checked={draft.returnFreeCashOnOrderReturn}
              onChange={(e) => set({
                returnFreeCashOnOrderReturn: e.target.checked,
                refundWholeFreeCashAmount: e.target.checked ? draft.refundWholeFreeCashAmount : false,
                amountToRefund: e.target.checked ? draft.amountToRefund : '',
              })}
              color={theme.switch.color}
            />
            {draft.returnFreeCashOnOrderReturn && (
              <div className="mt-3 space-y-3">
                <Switch
                  label="Refund the Whole Amount"
                  checked={draft.refundWholeFreeCashAmount}
                  onChange={(e) => set({
                    refundWholeFreeCashAmount: e.target.checked,
                    amountToRefund: e.target.checked ? '' : draft.amountToRefund,
                  })}
                  color={theme.switch.color}
                />
                {!draft.refundWholeFreeCashAmount && (
                  <InputField
                    type="number"
                    label="Refund Percentage"
                    placeholder="0-100"
                    min={0}
                    max={100}
                    value={draft.amountToRefund}
                    onChange={(e) => set({ amountToRefund: e.target.value })}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FreeCashSection;
