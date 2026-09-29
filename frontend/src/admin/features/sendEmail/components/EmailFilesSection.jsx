import { useState } from 'react';
import Checkbox from '../../../../components/common/Checkbox';
import InputField from '../../../../components/common/InputField';
import FileUpload from '../../../../components/common/FileUpload';
import Button from '../../../../components/common/Buttons';
import { checkFileAgainst, suggestImageName } from '../utils/sendEmailForm';
import theme from '../theme/theme';

const formatSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round((bytes || 0) / 1024))} KB`);
const acceptFor = (limits) => (limits?.allowedExtensions || []).map((e) => `.${String(e).replace(/^\./, '')}`).join(',');

/**
 * CC/BCC, attachments and images for one email. Company Settings library
 * files are ticked; extra files can be uploaded just for this email. Counts
 * cover both together (the Send Email limits). Each part shows only while
 * its feature is on.
 *
 * @param {Object} props.compose
 * @param {(patch: Object) => void} props.onChange
 * @param {Object} props.options - from GET /send-email/options
 */
const EmailFilesSection = ({ compose, onChange, options }) => {
  const access = options.access || {};
  const [fileError, setFileError] = useState('');
  const [attachmentUploaderKey, setAttachmentUploaderKey] = useState(0);
  const [imageUploaderKey, setImageUploaderKey] = useState(0);

  const attachmentsLimit = access.attachments || {};
  const imagesLimit = access.images || {};
  const attachmentCount = compose.attachmentIds.length + compose.uploadAttachments.length;
  const imageCount = compose.imageIds.length + compose.uploadImages.length;
  const attachmentsFull = attachmentsLimit.maxCount != null && attachmentCount >= attachmentsLimit.maxCount;
  const imagesFull = imagesLimit.maxCount != null && imageCount >= imagesLimit.maxCount;

  const toggle = (field, id) => {
    const list = compose[field];
    onChange({ [field]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };

  const addAttachments = (files) => {
    const room = attachmentsLimit.maxCount != null ? attachmentsLimit.maxCount - attachmentCount : files.length;
    const problems = files.map((f) => checkFileAgainst(f, attachmentsLimit)).filter(Boolean);
    if (problems.length) {
      setFileError(problems[0]);
      return;
    }
    if (files.length > room) {
      setFileError(`Only ${Math.max(room, 0)} more attachment(s) fit on this email.`);
      return;
    }
    setFileError('');
    onChange({ uploadAttachments: [...compose.uploadAttachments, ...files] });
    setAttachmentUploaderKey((k) => k + 1);
  };

  const addImages = (files) => {
    const room = imagesLimit.maxCount != null ? imagesLimit.maxCount - imageCount : files.length;
    const problems = files.map((f) => checkFileAgainst(f, imagesLimit)).filter(Boolean);
    if (problems.length) {
      setFileError(problems[0]);
      return;
    }
    if (files.length > room) {
      setFileError(`Only ${Math.max(room, 0)} more image(s) fit on this email.`);
      return;
    }
    setFileError('');
    onChange({ uploadImages: [...compose.uploadImages, ...files.map((file) => ({ file, name: suggestImageName(file.name) }))] });
    setImageUploaderKey((k) => k + 1);
  };

  const renameUploadImage = (index, name) => {
    onChange({ uploadImages: compose.uploadImages.map((img, i) => (i === index ? { ...img, name: name.toLowerCase() } : img)) });
  };

  if (!access.isCcAndBccOn && !attachmentsLimit.isOn && !imagesLimit.isOn) return null;

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-5">
      <h3 className={`text-sm font-semibold ${theme.text.heading}`}>CC, BCC, attachments and images</h3>

      {access.isCcAndBccOn && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox
              label="Include the CC list from Company Settings"
              checked={compose.includeCompanyCcList}
              onChange={(e) => onChange({ includeCompanyCcList: e.target.checked })}
            />
            <Checkbox
              label="Include the BCC list from Company Settings"
              checked={compose.includeCompanyBccList}
              onChange={(e) => onChange({ includeCompanyBccList: e.target.checked })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Extra CC" name="ccList" placeholder="name@example.com" value={compose.ccText} onChange={(e) => onChange({ ccText: e.target.value })} />
            <InputField label="Extra BCC" name="bccList" placeholder="name@example.com" value={compose.bccText} onChange={(e) => onChange({ bccText: e.target.value })} />
          </div>
          <p className={`text-xs ${theme.text.muted}`}>CC and BCC are added to every recipient&apos;s email.</p>
        </div>
      )}

      {attachmentsLimit.isOn && (
        <div className="space-y-2">
          <p className={`text-sm font-medium ${theme.text.heading}`}>
            Attachments
            {attachmentsLimit.maxCount != null && (
              <span className={`ml-2 text-xs font-normal ${theme.text.muted}`}>
                {attachmentCount} of {attachmentsLimit.maxCount} · {attachmentsLimit.maxSizeMB} MB each
              </span>
            )}
          </p>
          {(options.libraryAttachments || []).map((item) => {
            const checked = compose.attachmentIds.includes(item._id);
            return (
              <Checkbox
                key={item._id}
                label={`${item.displayName} (Company Settings)`}
                checked={checked}
                onChange={() => toggle('attachmentIds', item._id)}
                disabled={!checked && attachmentsFull}
              />
            );
          })}
          {compose.uploadAttachments.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 text-sm border border-gray-100 rounded px-3 py-1.5">
              <span className="truncate">{file.name} · {formatSize(file.size)}</span>
              <Button variant={theme.button.ghost} size="xs" onClick={() => onChange({ uploadAttachments: compose.uploadAttachments.filter((_, i) => i !== index) })}>
                Remove
              </Button>
            </div>
          ))}
          {!attachmentsFull && (
            <FileUpload
              key={attachmentUploaderKey}
              label="Upload for this email only"
              accept={acceptFor(attachmentsLimit)}
              multiple
              onFilesSelected={(files) => files.length && addAttachments(files)}
              helperText={`Deleted ${options.access?.fileRetentionDays || 90} days after sending (the history entry stays).`}
            />
          )}
        </div>
      )}

      {imagesLimit.isOn && (
        <div className="space-y-2">
          <p className={`text-sm font-medium ${theme.text.heading}`}>
            Images inside the email
            {imagesLimit.maxCount != null && (
              <span className={`ml-2 text-xs font-normal ${theme.text.muted}`}>
                {imageCount} of {imagesLimit.maxCount} · {imagesLimit.maxSizeMB} MB each
              </span>
            )}
          </p>
          <p className={`text-xs ${theme.text.muted}`}>Tick or upload an image, then place it in the body with its insert button ({'{{image:name}}'}).</p>
          {(options.libraryImages || []).map((img) => {
            const checked = compose.imageIds.includes(img._id);
            return (
              <div key={img._id} className="flex items-center gap-3">
                <img src={img.url} alt={img.name} className="w-8 h-8 object-contain rounded bg-gray-50" />
                <Checkbox
                  label={`${img.name} (Company Settings)`}
                  checked={checked}
                  onChange={() => toggle('imageIds', img._id)}
                  disabled={!checked && imagesFull}
                />
              </div>
            );
          })}
          {compose.uploadImages.map((img, index) => (
            <div key={`${img.file.name}-${index}`} className="flex items-end gap-3 border border-gray-100 rounded px-3 py-2">
              <div className="flex-1">
                <InputField
                  label={`Name for ${img.file.name}`}
                  name={`uploadImageName${index}`}
                  value={img.name}
                  onChange={(e) => renameUploadImage(index, e.target.value)}
                  maxLength={40}
                />
              </div>
              <Button variant={theme.button.ghost} size="xs" onClick={() => onChange({ uploadImages: compose.uploadImages.filter((_, i) => i !== index) })}>
                Remove
              </Button>
            </div>
          ))}
          {!imagesFull && (
            <FileUpload
              key={imageUploaderKey}
              label="Upload an image for this email only"
              accept={acceptFor(imagesLimit) || 'image/*'}
              multiple
              onFilesSelected={(files) => files.length && addImages(files)}
            />
          )}
        </div>
      )}

      {fileError && <p className={`text-sm ${theme.text.error}`}>{fileError}</p>}
    </div>
  );
};

export default EmailFilesSection;
