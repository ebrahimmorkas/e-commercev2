import Dropdown from '../../../../components/common/DropDown';
import Badge from '../../../../components/common/Badge';
import { GIVE_FREE_CASH_TO_CONFIG, STATUS_OPTIONS } from '../constants';
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
  const giveFreeCashToLabel = GIVE_FREE_CASH_TO_CONFIG[draft.giveFreeCashTo]?.label || draft.giveFreeCashTo;

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
        <p className={`text-sm font-medium mb-2 ${theme.text.heading}`}>{draft.freeCashName || 'Untitled Free Cash'}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant={theme.badge.default} size="sm">₹{draft.freeCashAmount || 0}</Badge>
          {draft.canBeUsedWithOtherDiscounts && <Badge variant="blue" size="sm">Stacks with discounts</Badge>}
          {isEdit && <Badge variant={draft.status === 'A' ? theme.badge.active : theme.badge.inactive} size="sm">{draft.status === 'A' ? 'Active' : 'Inactive'}</Badge>}
        </div>

        <Row label="Given To" value={giveFreeCashToLabel} />
        <Row label="Start Date" value={draft.startDate || '—'} />
        <Row label="End Date" value={draft.endDate || '—'} />
        <Row label="Valid Above" value={`₹${draft.validAbove || 0}`} />
        <Row label="Max Usage Per Order" value={draft.maxCashUsagePerOrder !== '' ? `₹${draft.maxCashUsagePerOrder}` : 'No limit'} />
        {draft.giveFreeCashTo === 'GROUPS' && <Row label="User Groups" value={draft.userGroupIds.length} />}
        {(draft.giveFreeCashTo === 'ONLY_MAIN_CATEGORY' || draft.giveFreeCashTo === 'MAIN_CATEGORY_AND_SUB_CATEGORY') && (
          <Row label="Main Categories" value={draft.mainCategoryIds.length} />
        )}
        {draft.giveFreeCashTo === 'MAIN_CATEGORY_AND_SUB_CATEGORY' && <Row label="Sub Categories" value={draft.subCategoryIds.length || 'All'} />}
      </div>

      <p className={`text-xs ${theme.text.muted}`}>
        Review the details above, then submit. For "Specific Users" or "User Group(s)", matching users are granted this Free Cash immediately on
        save.
      </p>
    </div>
  );
};

export default ReviewStep;
