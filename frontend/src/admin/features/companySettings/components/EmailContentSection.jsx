import { useState } from 'react';
import FileUpload from '../../../../components/common/FileUpload';
import InputField from '../../../../components/common/InputField';
import Button from '../../../../components/common/Buttons';
import Alert from '../../../../components/common/Alert';
import theme from '../theme/theme';

const IMAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,39}$/;

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const extensionOf = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

// "Price List (2026).png" -> "price-list-2026"
const suggestImageName = (fileName = '') =>
  fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 40);

// "Up to 3 files, 5 MB each. Allowed: pdf, docx."
const describeLimits = (limits, noun) => {
  const parts = [];
  if (limits.maxCount != null) parts.push(`Up to ${limits.maxCount} ${noun}${limits.maxCount === 1 ? '' : 's'}`);
  if (limits.maxSizeMB != null) parts.push(`${limits.maxSizeMB} MB each`);
  const allowed = (limits.allowedExtensions || []).join(', ');
  return `${parts.join(', ')}${parts.length ? '. ' : ''}${allowed ? `Allowed: ${allowed}.` : 'Any file type.'}`;
};

// Client-side mirror of the server's checks - the server re-checks everything.
const checkFile = (file, limits) => {
  const extension = extensionOf(file.name);
  const allowed = (limits.allowedExtensions || []).map((e) => String(e).toLowerCase());
  if (allowed.length > 0 && !allowed.includes(extension)) {
    return `.${extension || '?'} files are not allowed. Allowed: ${allowed.join(', ')}.`;
  }
  if (limits.maxSizeMB != null && file.size > limits.maxSizeMB * 1024 * 1024) {
    return `The file is larger than ${limits.maxSizeMB} MB.`;
  }
  return '';
};

const acceptFor = (limits) => (limits.allowedExtensions || []).map((e) => `.${String(e).replace(/^\./, '')}`).join(',');

/**
 * Files the vendor keeps ready to attach to emails. Uploading here doesn't
 * attach them to anything yet - each email/template will choose whether to
 * include them.
 */
const AttachmentsBlock = ({ limits, attachments, busy, onAdd, onRemove }) => {
  const [file, setFile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [uploaderKey, setUploaderKey] = useState(0);
  const isFull = limits.maxCount != null && attachments.length >= limits.maxCount;

  const handleSelect = (files) => {
    const picked = files[0] || null;
    setFile(picked);
    setError(picked ? checkFile(picked, limits) : '');
  };

  const handleUpload = async () => {
    if (!file || error) return;
    const success = await onAdd(file, displayName.trim());
    if (success) {
      setFile(null);
      setDisplayName('');
      setUploaderKey((k) => k + 1);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Attachments</h3>
        <p className={`mt-1 text-xs ${theme.text.muted}`}>
          Files you can attach to your emails - documents, spreadsheets, images or videos. They are only sent with an
          email when that email is set to include them. {describeLimits(limits, 'file')}
        </p>
      </div>

      {attachments.length > 0 ? (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {attachments.map((item) => (
            <li key={item._id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate block">
                  {item.displayName || item.originalName}
                </a>
                <p className={`text-xs ${theme.text.muted}`}>
                  {extensionOf(item.originalName).toUpperCase()} · {formatSize(item.size)}
                  {item.displayName && item.displayName !== item.originalName ? ` · uploaded as ${item.originalName}` : ''}
                </p>
              </div>
              <Button variant={theme.button.ghost} size="sm" onClick={() => onRemove(item._id)} disabled={busy}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`text-sm ${theme.text.muted}`}>No attachments yet.</p>
      )}

      {isFull ? (
        <p className={`text-sm ${theme.text.muted}`}>You have reached the number of attachments allowed. Remove one to add another.</p>
      ) : (
        <div className="space-y-3">
          <FileUpload
            key={uploaderKey}
            label="Add an attachment"
            accept={acceptFor(limits)}
            maxSize={limits.maxSizeMB != null ? limits.maxSizeMB * 1024 * 1024 : undefined}
            onFilesSelected={handleSelect}
            disabled={busy}
            error={error}
          />
          <InputField
            label="Name customers see (optional)"
            name="attachmentDisplayName"
            placeholder={file ? file.name : 'e.g. Price List 2026.pdf'}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={150}
          />
          <div className="flex justify-end">
            <Button variant={theme.button.primary} onClick={handleUpload} loading={busy} disabled={!file || !!error}>
              Upload attachment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Images shown inside an email's body. Each has a short name a template uses
 * to place it, e.g. {{image:logo}}.
 */
const ImagesBlock = ({ limits, images, busy, onAdd, onRemove }) => {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [uploaderKey, setUploaderKey] = useState(0);
  const isFull = limits.maxCount != null && images.length >= limits.maxCount;

  const nameError = name && !IMAGE_NAME_PATTERN.test(name)
    ? 'Use 2-40 lowercase letters, numbers, - or _, starting with a letter or number.'
    : images.some((img) => img.name === name)
      ? 'Another image already uses this name.'
      : '';

  const handleSelect = (files) => {
    const picked = files[0] || null;
    setFile(picked);
    setError(picked ? checkFile(picked, limits) : '');
    if (picked && !name) setName(suggestImageName(picked.name));
  };

  const handleUpload = async () => {
    if (!file || error || !name || nameError) return;
    const success = await onAdd(file, name);
    if (success) {
      setFile(null);
      setName('');
      setUploaderKey((k) => k + 1);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Images inside emails</h3>
        <p className={`mt-1 text-xs ${theme.text.muted}`}>
          Images you can place inside the text of your emails, such as your logo or a banner. Each image has a short
          name that a template uses to show it. {describeLimits(limits, 'image')}
        </p>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {images.map((img) => (
            <div key={img._id} className="flex items-center gap-3 border border-gray-100 rounded-lg p-2">
              <img src={img.url} alt={img.name} className="w-14 h-14 object-contain rounded bg-gray-50 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${theme.text.heading} truncate`}>{img.name}</p>
                <p className={`text-xs ${theme.text.muted}`}>
                  Use <code className="px-1 bg-gray-100 rounded">{`{{image:${img.name}}}`}</code> · {formatSize(img.size)}
                </p>
              </div>
              <Button variant={theme.button.ghost} size="sm" onClick={() => onRemove(img._id)} disabled={busy}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className={`text-sm ${theme.text.muted}`}>No images yet.</p>
      )}

      {isFull ? (
        <p className={`text-sm ${theme.text.muted}`}>You have reached the number of images allowed. Remove one to add another.</p>
      ) : (
        <div className="space-y-3">
          <FileUpload
            key={uploaderKey}
            label="Add an image"
            accept={acceptFor(limits) || 'image/*'}
            maxSize={limits.maxSizeMB != null ? limits.maxSizeMB * 1024 * 1024 : undefined}
            onFilesSelected={handleSelect}
            disabled={busy}
            error={error}
          />
          <InputField
            label="Image name"
            name="emailImageName"
            placeholder="e.g. logo"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            maxLength={40}
            required
          />
          {nameError && <p className={`-mt-2 text-sm ${theme.text.error}`}>{nameError}</p>}
          <div className="flex justify-end">
            <Button
              variant={theme.button.primary}
              onClick={handleUpload}
              loading={busy}
              disabled={!file || !!error || !name || !!nameError}
            >
              Upload image
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * The attachments + images part of the Email tab. Shown only for the parts
 * this account has (access = settings.emailFeatureAccess), and only once the
 * company settings exist (the files are stored on them).
 *
 * @param {Object} props.access - { attachments, images, canSendAttachments, emailProvider }
 * @param {boolean} props.exists - company settings have been created
 * @param {Object} props.content - useEmailContent() result
 */
const EmailContentSection = ({ access, exists, content }) => {
  const showAttachments = !!access?.attachments?.isOn;
  const showImages = !!access?.images?.isOn;
  if (!showAttachments && !showImages) return null;

  if (!exists) {
    return (
      <Alert variant="info">Save your company settings first - then you can add email attachments and images here.</Alert>
    );
  }

  return (
    <div className="space-y-5">
      {access.canSendAttachments === false && (
        <Alert variant="warning">
          Your email service ({String(access.emailProvider).toUpperCase()}) can&apos;t send attachments or images inside
          emails. You can still upload them here, but they won&apos;t be sent until a different email service is used.
        </Alert>
      )}
      {showAttachments && (
        <AttachmentsBlock
          limits={access.attachments}
          attachments={content.attachments}
          busy={content.busy}
          onAdd={content.addAttachment}
          onRemove={content.removeAttachment}
        />
      )}
      {showImages && (
        <ImagesBlock
          limits={access.images}
          images={content.images}
          busy={content.busy}
          onAdd={content.addImage}
          onRemove={content.removeImage}
        />
      )}
    </div>
  );
};

export default EmailContentSection;
