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

  // "Max number of users" and "First order only" exclude each other (first
  // order only already means one order in total).
  // While First order only is on, the limit is ignored (never sent), so an
  // older discount that has both can still be switched off/saved.
  const hasCustomerLimit = !draft.firstOrderOnly && String(draft.numberOfUsersCanUseDiscount ?? '').trim() !== '';

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
              <>
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
                <p className={`text-xs ${theme.text.muted}`}>
                  Open from the start time until just before the end time, in the timezone set on the Timing step. An end time
                  earlier than the start time runs overnight (e.g. 22:00 - 02:00 on Friday is open until 01:59 on Saturday).
                </p>
              </>
            )}
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
          <p className={`text-xs rounded-lg border px-3 py-2 ${theme.alert.warning.background} ${theme.alert.warning.border} ${theme.alert.warning.text}`}>
            Customers can't use payment-method discounts yet - checkout doesn't ask for the payment method before the order is placed,
            so these discounts are never offered in the cart.
          </p>
        )}
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

        <div>
          <InputField
            label="Max number of distinct users who can use this discount"
            name="numberOfUsersCanUseDiscount"
            type="number"
            min={1}
            placeholder={draft.firstOrderOnly ? 'Not used with First order only' : 'Leave blank for unlimited'}
            value={draft.firstOrderOnly ? '' : draft.numberOfUsersCanUseDiscount}
            disabled={draft.firstOrderOnly}
            onChange={(e) => set({ numberOfUsersCanUseDiscount: e.target.value })}
            showError={false}
          />
          {draft.firstOrderOnly && (
            <p className={`mt-1 text-xs ${theme.text.muted}`}>Turn off &quot;First order only&quot; to set a customer limit.</p>
          )}
        </div>

        <Switch
          label="Allow the same discount to be combined with other discounts"
          checked={draft.isMultipleDiscountUsageOn}
          onChange={(e) => set({ isMultipleDiscountUsageOn: e.target.checked })}
          color={theme.switch.color}
        />

        <Switch
          label="Reusable by the same user"
          description={draft.firstOrderOnly ? 'Not available for a first-order-only discount' : 'Allow one user to use this discount more than once'}
          checked={draft.isDiscountReusable}
          disabled={draft.firstOrderOnly}
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
          description={
            hasCustomerLimit
              ? 'Not available while a max number of users is set - clear that field first'
              : 'Only one order can ever use this discount - the first customer to place an order with it claims it (released again if that order is cancelled or fully returned)'
          }
          checked={draft.firstOrderOnly}
          disabled={hasCustomerLimit}
          onChange={(e) => set({ firstOrderOnly: e.target.checked, ...(e.target.checked ? { isDiscountReusable: false, numberOfUsersCanUseDiscount: '' } : {}) })}
          color={theme.switch.color}
        />
      </div>
    </div>
  );
};

export default RulesStep;
