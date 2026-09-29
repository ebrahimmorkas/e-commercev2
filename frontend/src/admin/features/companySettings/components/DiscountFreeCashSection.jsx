import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import theme from '../theme/theme';

const RECIPIENT_OPTIONS = [
  { value: 'TARGETED', label: 'Only targeted customers' },
  { value: 'ALL', label: 'All customers' },
];

/**
 * One block of email settings (Discount or Free Cash): who gets the emails
 * when the offer isn't user-targeted, and how many days before its end date
 * the "Expiring Soon" reminder goes out. Mirrors backend
 * services/promotionEmailService.js + expiryReminderService.js.
 */
const EmailSettingsBlock = ({ title, description, recipientsField, daysField, draft, onChange }) => (
  <div className="border border-gray-200 rounded-lg p-4 space-y-4">
    <div>
      <h3 className={`text-sm font-semibold ${theme.text.heading}`}>{title}</h3>
      <p className={`mt-1 text-xs ${theme.text.muted}`}>{description}</p>
    </div>

    <div>
      <Dropdown
        label="Who gets these emails"
        name={recipientsField}
        options={RECIPIENT_OPTIONS}
        value={draft[recipientsField]}
        onChange={(val) => onChange({ [recipientsField]: val || 'TARGETED' })}
      />
      <p className={`mt-1 text-xs ${theme.text.muted}`}>
        Offers given to specific customers or user groups always email just those customers. For offers given to
        everyone (or to products/categories), &quot;All customers&quot; emails every active customer, and &quot;Only
        targeted customers&quot; sends nothing.
      </p>
    </div>

    <div>
      <InputField
        type="number"
        label="Send the &quot;Expiring Soon&quot; reminder (days before the end date)"
        name={daysField}
        min={1}
        max={60}
        value={draft[daysField]}
        onChange={(e) => onChange({ [daysField]: e.target.value })}
      />
      <p className={`mt-1 text-xs ${theme.text.muted}`}>Between 1 and 60 days. The reminder is sent once.</p>
    </div>
  </div>
);

/**
 * "Discount and Free Cash" tab: email settings for both modules. Each email
 * also needs its own switch turned on for the account and a template
 * (Email Templates page, or the platform default).
 *
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 */
const DiscountFreeCashSection = ({ draft, onChange }) => (
  <div className="space-y-5">
    <EmailSettingsBlock
      title="Discount emails"
      description="Discount Available (sent when you tick &quot;Notify customers by email&quot;) and Discount Expiring Soon."
      recipientsField="discountEmailRecipients"
      daysField="discountExpiryReminderDays"
      draft={draft}
      onChange={onChange}
    />
    <EmailSettingsBlock
      title="Free Cash emails"
      description="Free Cash Credited (sent when you tick &quot;Notify customers by email&quot;) and Free Cash Expiring Soon. Used, Refunded, Revoked and Expired emails always go to the customer they're about."
      recipientsField="freeCashEmailRecipients"
      daysField="freeCashExpiryReminderDays"
      draft={draft}
      onChange={onChange}
    />
  </div>
);

export default DiscountFreeCashSection;
