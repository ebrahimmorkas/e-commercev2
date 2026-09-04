import Switch from '../../../../components/common/Switch';
import Dropdown from '../../../../components/common/DropDown';
import InputField from '../../../../components/common/InputField';
import { DAY_OPTIONS, PAYMENT_METHOD_OPTIONS } from '../constants';
import theme from '../theme/theme';

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 */
const RulesStep = ({ draft, onChange }) => {
  const set = (patch) => onChange({ ...draft, ...patch });

  // Backend rule (discountService.validateSpecificDaysAndHours): specific
  // days/hours restriction only applies to Minimum-Quantity or Coupon-Code discounts.
  const eligibleForSpecificDays = draft.discountFlow === 'MIN_QTY' || draft.discountFlow === 'COUPON';

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Switch
          label="Restrict to specific days"
          description={eligibleForSpecificDays ? 'Only available for Minimum-Quantity and Coupon-Code discounts' : 'Only available for Minimum-Quantity and Coupon-Code discounts - switch the Discount Flow on the previous step first'}
          checked={draft.isDiscountOpenForSpecificDays}
          disabled={!eligibleForSpecificDays}
          onChange={(e) => set({ isDiscountOpenForSpecificDays: e.target.checked, ...(e.target.checked ? {} : { isDiscountOpenForSpecificHours: false }) })}
          color={theme.switch.color}
        />

        {draft.isDiscountOpenForSpecificDays && eligibleForSpecificDays && (
          <div className="pl-1 space-y-4">
            <Dropdown
              label="Active Days"
              name="specificDays"
              options={DAY_OPTIONS}
              value={draft.specificDays}
              onChange={(val) => set({ specificDays: val })}
              multiple
              required
            />

            <Switch
              label="Also restrict to specific hours"
              checked={draft.isDiscountOpenForSpecificHours}
              onChange={(e) => set({ isDiscountOpenForSpecificHours: e.target.checked })}
              color={theme.switch.color}
            />

            {draft.isDiscountOpenForSpecificHours && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Start Time"
                  name="specificHoursStartTime"
                  type="time"
                  value={draft.specificHoursStartTime}
                  onChange={(e) => set({ specificHoursStartTime: e.target.value })}
                  required
                />
                <InputField
                  label="End Time"
                  name="specificHoursEndTime"
                  type="time"
                  value={draft.specificHoursEndTime}
                  onChange={(e) => set({ specificHoursEndTime: e.target.value })}
                  required
                />
              </div>
            )}

            <InputField
              label="Timezone"
              name="timezone"
              value={draft.timezone}
              onChange={(e) => set({ timezone: e.target.value })}
            />
          </div>
        )}
      </div>

      <div className="space-y-3 pt-2 border-t border-gray-100">
        <Switch
          label="Restrict to specific payment methods"
          checked={draft.isDiscountBasedOnPaymentMethods}
          onChange={(e) => set({ isDiscountBasedOnPaymentMethods: e.target.checked })}
          color={theme.switch.color}
        />
        {draft.isDiscountBasedOnPaymentMethods && (
          <Dropdown
            label="Eligible Payment Methods"
            name="discountOnPaymentMethods"
            options={PAYMENT_METHOD_OPTIONS}
            value={draft.discountOnPaymentMethods}
            onChange={(val) => set({ discountOnPaymentMethods: val })}
            multiple
            required
          />
        )}
      </div>

      <div className="space-y-4 pt-2 border-t border-gray-100">
        <p className={`text-sm font-medium ${theme.text.heading}`}>Usage Limits</p>

        <InputField
          label="Max number of distinct users who can use this discount"
          name="numberOfUsersCanUseDiscount"
          type="number"
          min={1}
          placeholder="Leave blank for unlimited"
          value={draft.numberOfUsersCanUseDiscount}
          onChange={(e) => set({ numberOfUsersCanUseDiscount: e.target.value })}
        />

        <Switch
          label="Allow the same discount to be combined with other discounts"
          checked={draft.isMultipleDiscountUsageOn}
          onChange={(e) => set({ isMultipleDiscountUsageOn: e.target.checked })}
          color={theme.switch.color}
        />

        <Switch
          label="Reusable by the same user"
          description="Allow one user to use this discount more than once"
          checked={draft.isDiscountReusable}
          onChange={(e) => set({ isDiscountReusable: e.target.checked })}
          color={theme.switch.color}
        />
        {draft.isDiscountReusable && (
          <InputField
            label="Times a single user can reuse this discount"
            name="discountReusableNumber"
            type="number"
            min={1}
            value={draft.discountReusableNumber}
            onChange={(e) => set({ discountReusableNumber: e.target.value })}
            required
          />
        )}

        <Switch
          label="First order only"
          description="Only valid on a customer's very first order"
          checked={draft.firstOrderOnly}
          onChange={(e) => set({ firstOrderOnly: e.target.checked })}
          color={theme.switch.color}
        />
      </div>
    </div>
  );
};

export default RulesStep;
