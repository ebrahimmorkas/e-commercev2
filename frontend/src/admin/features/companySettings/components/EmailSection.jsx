import { useState } from 'react';
import InputField from '../../../../components/common/InputField';
import Switch from '../../../../components/common/Switch';
import EmailContentSection from './EmailContentSection';
import theme from '../theme/theme';

const toEmailList = (text) =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * A comma-separated list of email addresses, editable as free text and
 * committed to the draft's array field on blur.
 */
const EmailListField = ({ label, value, onCommit }) => {
  const [text, setText] = useState((value || []).join(', '));

  return (
    <InputField
      label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(toEmailList(text))}
      placeholder="name1@example.com, name2@example.com"
    />
  );
};

/**
 * senderEmail + always-cc'd/bcc'd address lists used by emailService.js,
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

  return (
    <div className="space-y-5">
      <div>
        <InputField
          type="email"
          label="Sender Email"
          name="senderEmail"
          placeholder="Falls back to the admin email when left blank"
          value={draft.senderEmail}
          onChange={(e) => set({ senderEmail: e.target.value })}
        />
        <p className={`mt-1 text-xs ${theme.text.muted}`}>Used as the "From" address when the system sends email.</p>
      </div>

      {isCcAndBccOn && (
        <>
          <div>
            <EmailListField
              label="CC List"
              value={draft.ccList}
              onCommit={(list) => set({ ccList: list })}
            />
            <p className={`mt-1 text-xs ${theme.text.muted}`}>Comma-separated. Always cc'd on every system email.</p>
          </div>

          <div>
            <EmailListField
              label="BCC List"
              value={draft.bccList}
              onCommit={(list) => set({ bccList: list })}
            />
            <p className={`mt-1 text-xs ${theme.text.muted}`}>Comma-separated. Always bcc'd on every system email.</p>
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
