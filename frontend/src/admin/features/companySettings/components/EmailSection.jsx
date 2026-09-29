import { useState } from 'react';
import InputField from '../../../../components/common/InputField';
import Switch from '../../../../components/common/Switch';
import EmailContentSection from './EmailContentSection';
import EmailAccountSection from './EmailAccountSection';
import { useEmailAccount } from '../hooks/useEmailAccount';
import { toEmailList, invalidEmails } from '../utils/companySettingsDraft';
import theme from '../theme/theme';

/**
 * A list of email addresses, typed as free text (commas, semicolons, spaces
 * or new lines between them) and written to the draft's array field on every
 * change - so Save always sends what the box shows. Invalid addresses are
 * shown right under the box (the page's Save refuses them too).
 */
const EmailListField = ({ label, value, onCommit }) => {
  const [text, setText] = useState((value || []).join(', '));
  const [shown, setShown] = useState(value);

  // The saved list changed from outside (loaded / saved) - show it.
  if (shown !== value) {
    setShown(value);
    if (toEmailList(text).join(',') !== (value || []).join(',')) setText((value || []).join(', '));
  }

  const invalid = invalidEmails(toEmailList(text));

  return (
    <InputField
      label={label}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onCommit(toEmailList(e.target.value));
      }}
      onBlur={() => setText(toEmailList(text).join(', '))}
      placeholder="name1@example.com, name2@example.com"
      error={invalid.length ? `Not a valid email address: ${invalid.join(', ')}` : ''}
    />
  );
};

/**
 * The vendor's own email account (every email is sent through it - it also
 * decides the From name/address), the always-cc'd/bcc'd address lists used by emailService.js,
 * whether the platform default template is sent when no template is
 * assigned, and the vendor's email attachments / images.
 *
 * CC/BCC, attachments and images each show only while that feature is on for
 * the account (WebsiteMaster AND CompanyMaster - settings.emailFeatureAccess).
 * Before the settings exist there's no emailFeatureAccess yet, so CC/BCC
 * falls back to the CompanyMaster flag alone.
 *
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {Object|null} props.access - settings.emailFeatureAccess
 * @param {Object|null} props.companyMaster
 * @param {boolean} props.exists - company settings have been created
 * @param {Object} props.emailContent - useEmailContent() result
 */
const EmailSection = ({ draft, onChange, access = null, companyMaster = null, exists = false, emailContent }) => {
  const set = (patch) => onChange(patch);
  const isCcAndBccOn = access ? access.isCcAndBccOn : companyMaster?.isCcAndBccFeatureOn !== false;
  const emailAccount = useEmailAccount(exists);

  return (
    <div className="space-y-5">
      <EmailAccountSection emailAccount={emailAccount} exists={exists} />

      {isCcAndBccOn && (
        <>
          <div>
            <EmailListField
              label="CC List"
              value={draft.ccList}
              onCommit={(list) => set({ ccList: list })}
            />
            <p className={`mt-1 text-xs ${theme.text.muted}`}>Separate addresses with commas. Added as CC on every email whose template includes the company CC list.</p>
          </div>

          <div>
            <EmailListField
              label="BCC List"
              value={draft.bccList}
              onCommit={(list) => set({ bccList: list })}
            />
            <p className={`mt-1 text-xs ${theme.text.muted}`}>Separate addresses with commas. Added as BCC on every email whose template includes the company BCC list.</p>
          </div>
        </>
      )}

      <Switch
        label="Use the default email template"
        description="When no email template of yours is assigned to a module (for example Order), the platform's default email is sent instead. Turn this off to send no email in that case."
        checked={draft.useDefaultEmailTemplate}
        onChange={(e) => set({ useDefaultEmailTemplate: e.target.checked })}
        color={theme.switch.color}
      />

      <Switch
        label="Email the invoice when an order is placed"
        description="Sends the customer their invoice PDF by email right after they order (a fixed email, separate from your templates). Needs email sending and attachments to be allowed for your account, with PDF among the allowed attachment types. Customers without an email address are skipped."
        checked={draft.emailInvoiceOnOrderPlaced}
        onChange={(e) => set({ emailInvoiceOnOrderPlaced: e.target.checked })}
        color={theme.switch.color}
      />

      {emailContent && <EmailContentSection access={access} exists={exists} content={emailContent} />}
    </div>
  );
};

export default EmailSection;
