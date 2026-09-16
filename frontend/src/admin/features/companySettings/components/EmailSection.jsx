import { useState } from 'react';
import InputField from '../../../../components/common/InputField';
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
 * senderEmail + always-cc'd/bcc'd address lists used by emailService.js.
 *
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 */
const EmailSection = ({ draft, onChange }) => {
  const set = (patch) => onChange(patch);

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
    </div>
  );
};

export default EmailSection;
