import { useState } from 'react';
import Dropdown from '../../../../components/common/DropDown';
import InputField from '../../../../components/common/InputField';
import TextArea from '../../../../components/common/TextArea';
import HtmlEditor from '../../../../components/common/HtmlEditor';
import Button from '../../../../components/common/Buttons';
import Modal from '../../../../components/common/Modal';
import RecipientsSection from './RecipientsSection';
import EmailFilesSection from './EmailFilesSection';
import { emptyCompose, validateCompose, buildSendPayload, describeRecipients } from '../utils/sendEmailForm';
import theme from '../theme/theme';

/**
 * Compose screen of the Send Email module.
 *
 * @param {Object} props.options - from GET /send-email/options
 * @param {(fields, files) => Promise<boolean>} props.onSend
 * @param {boolean} props.sending
 * @param {Array<{_id, name, email}>|null} props.initialCustomers - pre-filled To (from the Customers page)
 */
const ComposeEmailForm = ({ options, onSend, sending, initialCustomers = null }) => {
  const [compose, setCompose] = useState(() => ({ ...emptyCompose(), customers: initialCustomers || [] }));
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const patch = (changes) => {
    setCompose((prev) => ({ ...prev, ...changes }));
    setError('');
  };

  // Copies a template's subject and body in (then freely editable).
  const startFromTemplate = (id) => {
    setTemplateId(id || '');
    const template = (options.templates || []).find((t) => t._id === id);
    if (template) patch({ subject: template.subject || '', htmlBody: template.htmlBody || '', textBody: template.textBody || '' });
  };

  const insertIntoSubject = (key) => patch({ subject: `${compose.subject}{{${key}}}` });

  // Ticked library images + uploaded images, placeable as {{image:name}}.
  const imageVariables = [
    ...(options.libraryImages || []).filter((img) => compose.imageIds.includes(img._id)).map((img) => img.name),
    ...compose.uploadImages.map((img) => img.name).filter(Boolean),
  ].map((name) => ({ key: `image:${name}`, description: `Shows the image "${name}" here` }));

  const handleReview = () => {
    const problem = validateCompose(compose, options);
    if (problem) {
      setError(problem);
      return;
    }
    setConfirmOpen(true);
  };

  const handleSend = async () => {
    const { fields, files } = buildSendPayload(compose, options);
    const success = await onSend(fields, files);
    setConfirmOpen(false);
    if (success) {
      setCompose(emptyCompose());
      setTemplateId('');
    }
  };

  return (
    <div className="space-y-5">
      <RecipientsSection compose={compose} onChange={patch} options={options} />

      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Message</h3>

        {(options.templates || []).length > 0 && (
          <Dropdown
            label="Start from a template (optional)"
            name="templateId"
            options={options.templates.map((t) => ({ value: t._id, label: t.templateName }))}
            value={templateId}
            onChange={startFromTemplate}
            placeholder="Write from scratch"
            clearable
            helperText="Copies the template's subject and body here - you can still change them."
          />
        )}

        <div>
          <InputField
            label="Subject"
            name="subject"
            value={compose.subject}
            onChange={(e) => patch({ subject: e.target.value })}
            maxLength={200}
            required
          />
          <div className="flex flex-wrap items-center gap-1 mt-2">
            <span className={`text-xs mr-1 ${theme.text.muted}`}>Insert variable:</span>
            {(options.variables || []).map((variable) => (
              <Button key={variable.key} type="button" variant="outline" size="xs" title={variable.description} onClick={() => insertIntoSubject(variable.key)}>
                {`{{${variable.key}}}`}
              </Button>
            ))}
          </div>
        </div>

        <HtmlEditor
          label="Body"
          name="htmlBody"
          value={compose.htmlBody}
          onChange={(html) => patch({ htmlBody: html })}
          variables={[...(options.variables || []), ...imageVariables]}
          placeholder="<p>Hello {{customerName}},</p>"
          helperText="Variables are filled in for each recipient ({{customerName}} is blank for addresses that aren't store customers)."
          required
        />

        <TextArea
          label="Plain text version (optional)"
          name="textBody"
          value={compose.textBody}
          onChange={(e) => patch({ textBody: e.target.value })}
          rows={3}
        />
      </div>

      <EmailFilesSection compose={compose} onChange={patch} options={options} />

      {error && (
        <p className={`text-sm ${theme.text.error}`} role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button variant={theme.button.primary} onClick={handleReview} loading={sending}>
          Send email
        </Button>
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => !sending && setConfirmOpen(false)}
        title="Send this email?"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={() => setConfirmOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button variant={theme.button.primary} onClick={handleSend} loading={sending}>
              Send
            </Button>
          </>
        }
      >
        <p className={`text-sm ${theme.text.body}`}>
          &quot;{compose.subject}&quot; will be sent to {describeRecipients(compose, options)}, each as a separate email.
          It is sent in the background - you can follow it in the History tab.
        </p>
      </Modal>
    </div>
  );
};

export default ComposeEmailForm;
