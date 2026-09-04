import Dropdown from '../../../../components/common/DropDown';
import Badge from '../../../../components/common/Badge';
import { GIVE_DISCOUNT_TO_CONFIG, DISCOUNT_FLOW_OPTIONS, STATUS_OPTIONS } from '../constants';
import theme from '../theme/theme';

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-gray-100 last:border-0">
    <span className={theme.text.muted}>{label}</span>
    <span className={`text-right font-medium ${theme.text.heading}`}>{value}</span>
  </div>
);

/**
 * @param {Object} props.draft
 * @param {boolean} props.isEdit
 */
const ReviewStep = ({ draft, onChange, isEdit = false }) => {
  const set = (patch) => onChange({ ...draft, ...patch });
  const flow = DISCOUNT_FLOW_OPTIONS.find((f) => f.value === draft.discountFlow);
  const giveDiscountToLabel = GIVE_DISCOUNT_TO_CONFIG[draft.giveDiscountTo]?.label || draft.giveDiscountTo;

  return (
    <div className="space-y-5">
      {isEdit && (
        <Dropdown
          label="Status"
          name="status"
          options={STATUS_OPTIONS}
          value={draft.status}
          onChange={(val) => set({ status: val })}
          required
        />
      )}

      <div className="rounded-xl border border-gray-200 p-4">
        <p className={`text-sm font-medium mb-2 ${theme.text.heading}`}>{draft.name || 'Untitled discount'}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant={theme.badge.default} size="sm">
            {draft.discountType === 'PERCENTAGE' ? `${draft.discountValue || 0}% off` : `₹${draft.discountValue || 0} off`}
          </Badge>
          <Badge variant={theme.badge[draft.discountFlow === 'MIN_QTY' ? 'minQty' : draft.discountFlow.toLowerCase()] || 'gray'} size="sm">
            {flow?.label}
          </Badge>
          {draft.autoApply && <Badge variant="blue" size="sm">Auto-apply</Badge>}
          {isEdit && <Badge variant={draft.status === 'A' ? theme.badge.active : theme.badge.inactive} size="sm">{draft.status === 'A' ? 'Active' : 'Inactive'}</Badge>}
        </div>

        <Row label="Applies To" value={giveDiscountToLabel} />
        {draft.discountFlow !== 'ONGOING' && <Row label="Start Date" value={draft.startDate || '—'} />}
        {draft.discountFlow !== 'ONGOING' && <Row label="End Date" value={draft.endDate || '—'} />}
        {draft.discountFlow === 'MIN_QTY' && <Row label="Minimum Quantity" value={draft.minimumQuantity || '—'} />}
        {draft.discountFlow === 'COUPON' && <Row label="Coupon Code" value={draft.couponCode || '—'} />}
        {draft.discountFlow !== 'MIN_QTY' && <Row label="Minimum Cart Value" value={`₹${draft.discountValidAboveAmount || 0}`} />}
        <Row label="Precedence" value={draft.precedence} />
        {draft.isDiscountOpenForSpecificDays && <Row label="Active Days" value={draft.specificDays.join(', ') || '—'} />}
        {draft.isDiscountOpenForSpecificHours && <Row label="Active Hours" value={`${draft.specificHoursStartTime} – ${draft.specificHoursEndTime}`} />}
        {draft.isDiscountBasedOnPaymentMethods && <Row label="Payment Methods" value={draft.discountOnPaymentMethods.join(', ') || '—'} />}
        {draft.numberOfUsersCanUseDiscount && <Row label="Max Users" value={draft.numberOfUsersCanUseDiscount} />}
        {draft.isDiscountReusable && <Row label="Reusable / User" value={draft.discountReusableNumber || '—'} />}
        {draft.firstOrderOnly && <Row label="First Order Only" value="Yes" />}
      </div>

      <p className={`text-xs ${theme.text.muted}`}>
        Review the details above, then submit. Fields left at their defaults (multi-use, reusable, payment-method restrictions, etc.) are saved
        as off / unrestricted.
      </p>
    </div>
  );
};

export default ReviewStep;
