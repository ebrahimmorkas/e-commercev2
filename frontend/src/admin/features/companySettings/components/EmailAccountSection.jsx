import { useState } from 'react';
import Dropdown from '../../../../components/common/DropDown';
import InputField from '../../../../components/common/InputField';
import Button from '../../../../components/common/Buttons';
import Alert from '../../../../components/common/Alert';
import Modal from '../../../../components/common/Modal';
import theme from '../theme/theme';

// Ready-made server settings for common providers; "Other" leaves them editable.
const PRESETS = {
  gmail: { label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 465, security: 'SSL' },
  outlook: { label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, security: 'STARTTLS' },
  zoho: { label: 'Zoho Mail', host: 'smtp.zoho.com', port: 465, security: 'SSL' },
  other: { label: 'Other SMTP server', host: '', port: 587, security: 'STARTTLS' },
};
const PRESET_OPTIONS = Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label }));
const SECURITY_OPTIONS = [
  { value: 'SSL', label: 'SSL/TLS (usually port 465)' },
  { value: 'STARTTLS', label: 'STARTTLS (usually port 587)' },
  { value: 'NONE', label: 'None (not recommended)' },
];

const presetFor = (account) =>
  Object.keys(PRESETS).find((key) => key !== 'other' && PRESETS[key].host === account?.host) || (account ? 'other' : 'gmail');

const formFrom = (account) => {
  const preset = PRESETS[presetFor(account)];
  return {
    preset: presetFor(account),
    host: account?.host || preset.host,
    port: String(account?.port || preset.port),
    security: account?.security || preset.security,
    username: account?.username || '',
    password: '',
    fromEmail: account?.fromEmail || '',
    fromName: account?.fromName || '',
  };
};

/**
 * "Your email account": every email of this store is sent through it (there
 * is no platform fallback). Saved only after the email server accepted the
 * sign-in; the password is stored encrypted and never shown again.
 *
 * @param {Object} props.emailAccount - useEmailAccount() result
 * @param {boolean} props.exists - company settings have been created
 */
const EmailAccountSection = ({ emailAccount, exists }) => {
  const { account, loaded, busy, save, sendTest, remove } = emailAccount;
  const [form, setForm] = useState(() => formFrom(account));
  const [formFor, setFormFor] = useState(account);
  const [editing, setEditing] = useState(!account);
  const [error, setError] = useState('');
  const [removeOpen, setRemoveOpen] = useState(false);

  // Reset the form whenever the saved account changes (loaded / saved / removed).
  if (formFor !== account) {
    setFormFor(account);
    setForm(formFrom(account));
    setEditing(!account);
  }

  const patch = (changes) => {
    setForm((prev) => ({ ...prev, ...changes }));
    setError('');
  };

  const choosePreset = (key) => {
    const preset = PRESETS[key] || PRESETS.other;
    patch({ preset: key, host: key === 'other' ? form.host : preset.host, port: String(preset.port), security: preset.security });
  };

  const handleSave = async () => {
    if (!form.host.trim() || !form.port || !form.username.trim()) {
      setError('Please fill in the server, port and username.');
      return;
    }
    if (!account?.hasPassword && !form.password) {
      setError('Please enter the password (for Gmail, the App Password).');
      return;
    }
    const saved = await save({
      host: form.host.trim(),
      port: Number(form.port),
      security: form.security,
      username: form.username.trim(),
      password: form.password || undefined,
      fromEmail: form.fromEmail.trim() || undefined,
      fromName: form.fromName.trim() || undefined,
    });
    if (saved) setEditing(false);
  };

  if (!exists) {
    return <Alert variant="info">Save your company settings first - then add the email account your store sends from.</Alert>;
  }
  if (!loaded) return null;

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Your email account</h3>
        <p className={`mt-1 text-xs ${theme.text.muted}`}>
          All of your store&apos;s emails (order updates, offers, emails you send yourself) are sent from this account.
          Without it, no emails are sent.
        </p>
      </div>

      {!account && (
        <Alert variant="warning">No email account is set up - your store is not sending any emails right now.</Alert>
      )}

      {account && !editing ? (
        <div className="space-y-3">
          <div className={`text-sm ${theme.text.body} space-y-1`}>
            <p>
              Sending from <span className={`font-medium ${theme.text.heading}`}>{account.fromName ? `${account.fromName} <${account.fromEmail || account.username}>` : account.fromEmail || account.username}</span>
            </p>
            <p className={`text-xs ${theme.text.muted}`}>
              {account.host}:{account.port} ({account.security}) · signed in as {account.username}
              {account.verifiedAt ? ` · checked ${new Date(account.verifiedAt).toLocaleString()}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={theme.button.secondary} size="sm" onClick={() => sendTest('')} loading={busy === 'test'} disabled={!!busy}>
              Send test email
            </Button>
            <Button variant={theme.button.secondary} size="sm" onClick={() => setEditing(true)} disabled={!!busy}>
              Change
            </Button>
            <Button variant={theme.button.ghost} size="sm" onClick={() => setRemoveOpen(true)} disabled={!!busy}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Dropdown label="Email provider" name="emailPreset" options={PRESET_OPTIONS} value={form.preset} onChange={(val) => choosePreset(val || 'other')} />

          {form.preset === 'gmail' && (
            <Alert variant="info" title="Gmail needs an App Password">
              Your normal Gmail password won&apos;t work. In your Google Account: turn on 2-Step Verification, then open{' '}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline">
                App passwords
              </a>
              , create one (for example named &quot;Store emails&quot;) and paste the 16-character code below. Gmail
              sends about 500 emails a day (Google Workspace about 2,000).
            </Alert>
          )}

          {form.preset === 'other' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InputField label="SMTP server" name="smtpHost" placeholder="smtp.example.com" value={form.host} onChange={(e) => patch({ host: e.target.value })} required />
              <InputField type="number" label="Port" name="smtpPort" min={1} max={65535} value={form.port} onChange={(e) => patch({ port: e.target.value })} required />
              <Dropdown label="Security" name="smtpSecurity" options={SECURITY_OPTIONS} value={form.security} onChange={(val) => patch({ security: val || 'STARTTLS' })} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label={form.preset === 'other' ? 'Username' : 'Email address'}
              name="smtpUsername"
              placeholder="you@yourstore.com"
              value={form.username}
              onChange={(e) => patch({ username: e.target.value })}
              required
            />
            <InputField
              type="password"
              label={form.preset === 'gmail' ? 'App Password' : 'Password'}
              name="smtpPassword"
              placeholder={account?.hasPassword ? 'Saved - leave empty to keep it' : ''}
              value={form.password}
              onChange={(e) => patch({ password: e.target.value })}
              autoComplete="new-password"
            />
            <InputField
              label="From name (optional)"
              name="fromName"
              placeholder="e.g. Acme Store"
              value={form.fromName}
              onChange={(e) => patch({ fromName: e.target.value })}
              maxLength={100}
            />
            <InputField
              type="email"
              label="From address (optional)"
              name="fromEmail"
              placeholder="Same as the email address"
              value={form.fromEmail}
              onChange={(e) => patch({ fromEmail: e.target.value })}
            />
          </div>
          <p className={`text-xs ${theme.text.muted}`}>
            Customers see the From name and address. Most providers (including Gmail) only allow the account&apos;s own
            address. Saving signs in to your email server first - the details are only saved if it works.
          </p>

          {error && <p className={`text-sm ${theme.text.error}`}>{error}</p>}

          <div className="flex justify-end gap-2">
            {account && (
              <Button variant={theme.button.ghost} onClick={() => {
                  setForm(formFrom(account));
                  setEditing(false);
                }} disabled={busy === 'save'}>
                Cancel
              </Button>
            )}
            <Button variant={theme.button.primary} onClick={handleSave} loading={busy === 'save'}>
              Check and save
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title="Remove email account?"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={() => setRemoveOpen(false)} disabled={busy === 'remove'}>
              Cancel
            </Button>
            <Button
              variant={theme.button.danger}
              loading={busy === 'remove'}
              onClick={async () => {
                if (await remove()) setRemoveOpen(false);
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className={`text-sm ${theme.text.body}`}>
          Your store will stop sending all emails (order updates, offers and everything else) until you add an email
          account again.
        </p>
      </Modal>
    </div>
  );
};

export default EmailAccountSection;
