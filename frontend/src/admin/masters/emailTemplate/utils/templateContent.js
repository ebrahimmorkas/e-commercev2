/**
 * Helpers for a template's content choices (CC/BCC, Company Settings
 * attachments/images, invoice) - mirror the backend rules in
 * emailTemplateMasterService.resolveTemplateContentFields.
 */

const IMAGE_TOKEN = /\{\{\s*image:([a-z0-9_-]+)\s*\}\}/gi;

/** The {{image:name}} names used in an HTML body. */
export const findImageNames = (html) => {
  const names = new Set();
  String(html || '').replace(IMAGE_TOKEN, (match, name) => {
    names.add(name.toLowerCase());
    return match;
  });
  return [...names];
};

const toEmailList = (text) =>
  String(text || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** Form state for a template's content choices (new template = the defaults). */
export const initialContentState = (template = {}) => ({
  includeCompanyCcList: template.includeCompanyCcList !== false,
  includeCompanyBccList: template.includeCompanyBccList !== false,
  ccText: (template.ccList || []).join(', '),
  bccText: (template.bccList || []).join(', '),
  attachmentIds: template.attachmentIds || [],
  imageIds: template.imageIds || [],
  attachInvoice: template.attachInvoice === true,
});

/** The invoice option applies to Order templates while it's on for the account. */
export const isInvoiceOfferedFor = (options, module) => !!options?.isInvoiceOptionOn && module === 'order';

/**
 * API fields for the choices, only for the parts that are on (the backend
 * keeps whatever was saved for a part that's off).
 */
export const buildContentPayload = (content, options, module) => {
  const payload = {};
  if (options?.isCcAndBccOn) {
    payload.includeCompanyCcList = content.includeCompanyCcList;
    payload.includeCompanyBccList = content.includeCompanyBccList;
    payload.ccList = toEmailList(content.ccText);
    payload.bccList = toEmailList(content.bccText);
  }
  if (options?.attachments?.isOn) payload.attachmentIds = content.attachmentIds;
  if (options?.images?.isOn) payload.imageIds = content.imageIds;
  if (isInvoiceOfferedFor(options, module)) payload.attachInvoice = content.attachInvoice;
  return payload;
};

/**
 * Checks the choices against the limits and the body - the same rules the
 * backend enforces. Returns an error message, or ''.
 */
export const validateContent = (content, options, module, htmlBody) => {
  const invalidEmail = [...toEmailList(content.ccText), ...toEmailList(content.bccText)].find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (options?.isCcAndBccOn && invalidEmail) return `"${invalidEmail}" is not a valid email address.`;

  if (options?.attachments?.isOn) {
    const total = content.attachmentIds.length + (isInvoiceOfferedFor(options, module) && content.attachInvoice ? 1 : 0);
    const max = options.attachments.maxCount;
    if (max != null && total > max) return `You can send at most ${max} attachment(s) with an email, including the invoice.`;
  }
  if (options?.images?.isOn) {
    const selectedNames = new Set(options.images.items.filter((img) => content.imageIds.includes(img._id)).map((img) => img.name));
    const missing = findImageNames(htmlBody).filter((name) => !selectedNames.has(name));
    if (missing.length > 0) {
      return `The body uses ${missing.map((n) => `{{image:${n}}}`).join(', ')} - tick ${missing.length === 1 ? 'that image' : 'those images'} under "Images", or remove ${missing.length === 1 ? 'it' : 'them'} from the body.`;
    }
  }
  return '';
};
