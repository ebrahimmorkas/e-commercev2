import { RadioGroup } from '../../../../components/common/Radio';
import InputField from '../../../../components/common/InputField';
import DatePicker from '../../../../components/common/DatePicker';
import { DISCOUNT_FLOW_OPTIONS } from '../constants';
import theme from '../theme/theme';

const pad = (n) => String(n).padStart(2, '0');
// Formats using local calendar fields, not toISOString() - a UTC conversion
// of local midnight can roll over to the previous day in timezones ahead of UTC.
const toDateInputValue = (date) => (date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '');

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {string[]} props.allowedFeatureTypes - companyMaster.allowedDiscountFeatureTypes (empty = all allowed)
 */
const TimingStep = ({ draft, onChange, allowedFeatureTypes = [] }) => {
  const set = (patch) => onChange({ ...draft, ...patch });

  const flowOptions =
    allowedFeatureTypes.length > 0
      ? DISCOUNT_FLOW_OPTIONS.filter((opt) => allowedFeatureTypes.includes(opt.featureType))
      : DISCOUNT_FLOW_OPTIONS;

  const isOngoing = draft.discountFlow === 'ONGOING';
  const isMinQty = draft.discountFlow === 'MIN_QTY';
  const isCoupon = draft.discountFlow === 'COUPON';

  // Specific-days/hours restriction is only valid for Min-Qty/Coupon
  // discounts (see discountService.validateSpecificDaysAndHours) - clear it
  // when switching away so RulesStep never carries stale, now-invalid state.
  const handleFlowChange = (val) => {
    const stillEligible = val === 'MIN_QTY' || val === 'COUPON';
    set({
      discountFlow: val,
      ...(stillEligible ? {} : { isDiscountOpenForSpecificDays: false, isDiscountOpenForSpecificHours: false }),
    });
  };

  return (
    <div className="space-y-5">
      <RadioGroup
        label="Discount Flow"
        name="discountFlow"
        options={flowOptions}
        value={draft.discountFlow}
        onChange={handleFlowChange}
        required
      />

      {isMinQty && (
        <InputField
          label="Minimum Quantity"
          name="minimumQuantity"
          type="number"
          min={1}
          placeholder="e.g. 3"
          value={draft.minimumQuantity}
          onChange={(e) => set({ minimumQuantity: e.target.value })}
          required
        />
      )}

      {isCoupon && (
        <InputField
          label="Coupon Code"
          name="couponCode"
          placeholder="e.g. WELCOME20"
          value={draft.couponCode}
          onChange={(e) => set({ couponCode: e.target.value.toUpperCase() })}
          required
        />
      )}

      {!isOngoing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePicker
            label="Start Date"
            name="startDate"
            value={draft.startDate}
            onChange={(date) => set({ startDate: toDateInputValue(date) })}
            required
          />
          <DatePicker
            label="End Date"
            name="endDate"
            value={draft.endDate}
            onChange={(date) => set({ endDate: toDateInputValue(date) })}
            required
          />
        </div>
      )}

      {!isMinQty && (
        <div>
          <InputField
            label="Minimum Cart Value For This Discount (₹)"
            name="discountValidAboveAmount"
            type="number"
            min={0}
            placeholder="0 = no minimum"
            value={draft.discountValidAboveAmount}
            onChange={(e) => set({ discountValidAboveAmount: e.target.value })}
            showError={false}
          />
          <p className={`mt-1 text-xs ${theme.text.muted}`}>Cart subtotal must reach this amount for the discount to apply.</p>
        </div>
      )}

      {isOngoing && (
        <p className={`text-sm ${theme.text.muted}`}>
          Ongoing discounts have no start or end date - they stay active until you set the status to Inactive.
        </p>
      )}
    </div>
  );
};

export default TimingStep;
