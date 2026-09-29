import Checkbox from '../../../../components/common/Checkbox';
import InputField from '../../../../components/common/InputField';
import theme from '../theme/theme';
import { isInvoiceOfferedFor } from '../utils/templateContent';

/**
 * "What to send with this email": CC/BCC, the Company Settings attachments
 * and images this template uses, and (Order templates) the invoice. Each part
 * shows only while its feature is on (options = contentOptions from the list
 * endpoint). Files themselves are uploaded in Company Settings > Email.
 *
 * @param {Object} props.content - state from initialContentState
 * @param {(patch: Object) => void} props.onChange
 * @param {Object|null} props.options
 * @param {string} props.module
 * @param {string} props.error
 */
const TemplateContentFields = ({ content, onChange, options, module, error = '' }) => {
  if (!options) return null;
  const showCc = options.isCcAndBccOn;
  const showAttachments = options.attachments?.isOn;
  const showImages = options.images?.isOn;
  const showInvoice = isInvoiceOfferedFor(options, module);
  if (!showCc && !showAttachments && !showImages && !showInvoice) return null;

  const toggleId = (field, id) => {
    const list = content[field];
    onChange({ [field]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };

  const attachmentMax = options.attachments?.maxCount;
  const attachmentCount = content.attachmentIds.length + (showInvoice && content.attachInvoice ? 1 : 0);
  const attachmentsFull = attachmentMax != null && attachmentCount >= attachmentMax;
  const imageMax = options.images?.maxCount;
  const imagesFull = imageMax != null && content.imageIds.length >= imageMax;

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-5">
      <div>
        <h3 className={`text-sm font-semibold ${theme.text.heading}`}>What to send with this email</h3>
        <p className={`mt-1 text-xs ${theme.text.muted}`}>
          Attachments and images are uploaded in Company Settings &gt; Email - here you choose which ones this email uses.
        </p>
      </div>

      {showCc && (
        <div className="space-y-3">
          <p className={`text-sm font-medium ${theme.text.heading}`}>CC / BCC</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox
              label="Include the CC list from Company Settings"
              checked={content.includeCompanyCcList}
              onChange={(e) => onChange({ includeCompanyCcList: e.target.checked })}
            />
            <Checkbox
              label="Include the BCC list from Company Settings"
              checked={content.includeCompanyBccList}
              onChange={(e) => onChange({ includeCompanyBccList: e.target.checked })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Extra CC for this email"
              name="templateCcList"
              placeholder="name1@example.com, name2@example.com"
              value={content.ccText}
              onChange={(e) => onChange({ ccText: e.target.value })}
            />
            <InputField
              label="Extra BCC for this email"
              name="templateBccList"
              placeholder="name1@example.com, name2@example.com"
              value={content.bccText}
              onChange={(e) => onChange({ bccText: e.target.value })}
            />
          </div>
        </div>
      )}

      {(showAttachments || showInvoice) && (
        <div className="space-y-2">
          <p className={`text-sm font-medium ${theme.text.heading}`}>
            Attachments
            {attachmentMax != null && (
              <span className={`ml-2 text-xs font-normal ${theme.text.muted}`}>
                {attachmentCount} of {attachmentMax} selected{showInvoice ? ' (the invoice counts as one)' : ''}
              </span>
            )}
          </p>
          {showInvoice && (
            <Checkbox
              label="Attach the order's invoice (PDF)"
              description="Sent with the email when the order has an issued invoice."
              checked={content.attachInvoice}
              onChange={(e) => onChange({ attachInvoice: e.target.checked })}
              disabled={!content.attachInvoice && attachmentsFull}
            />
          )}
          {showAttachments &&
            (options.attachments.items.length === 0 ? (
              <p className={`text-sm ${theme.text.muted}`}>No attachments in Company Settings yet.</p>
            ) : (
              options.attachments.items.map((item) => {
                const checked = content.attachmentIds.includes(item._id);
                return (
                  <Checkbox
                    key={item._id}
                    label={item.displayName}
                    checked={checked}
                    onChange={() => toggleId('attachmentIds', item._id)}
                    disabled={!checked && attachmentsFull}
                  />
                );
              })
            ))}
        </div>
      )}

      {showImages && (
        <div className="space-y-2">
          <p className={`text-sm font-medium ${theme.text.heading}`}>
            Images
            {imageMax != null && (
              <span className={`ml-2 text-xs font-normal ${theme.text.muted}`}>
                {content.imageIds.length} of {imageMax} selected
              </span>
            )}
          </p>
          <p className={`text-xs ${theme.text.muted}`}>
            Tick an image to use it in this email, then place it in the HTML body with its insert button (it shows as
            {' '}<code className="px-1 bg-gray-100 rounded">{'{{image:name}}'}</code>).
          </p>
          {options.images.items.length === 0 ? (
            <p className={`text-sm ${theme.text.muted}`}>No images in Company Settings yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options.images.items.map((img) => {
                const checked = content.imageIds.includes(img._id);
                return (
                  <div key={img._id} className="flex items-center gap-3 border border-gray-100 rounded-lg p-2">
                    <img src={img.url} alt={img.name} className="w-10 h-10 object-contain rounded bg-gray-50 shrink-0" />
                    <Checkbox
                      label={img.name}
                      checked={checked}
                      onChange={() => toggleId('imageIds', img._id)}
                      disabled={!checked && imagesFull}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className={`text-sm ${theme.text.error}`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default TemplateContentFields;
