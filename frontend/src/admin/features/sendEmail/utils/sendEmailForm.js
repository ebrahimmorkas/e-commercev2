/**
 * Compose-form state and checks for the Send Email module - mirror the
 * backend rules in services/sentEmailService.js (which re-checks everything).
 */

export const IMAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,39}$/;
const IMAGE_TOKEN = /\{\{\s*image:([a-z0-9_-]+)\s*\}\}/gi;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emptyCompose = () => ({
  allCustomers: false,
  customers: [], // [{ _id, name, email }]
  groupIds: [],
  externalText: '',
  subject: '',
  htmlBody: '',
  textBody: '',
  includeCompanyCcList: true,
  includeCompanyBccList: true,
  ccText: '',
  bccText: '',
  attachmentIds: [],
  imageIds: [],
  uploadAttachments: [], // File[]
  uploadImages: [], // [{ file: File, name: string }]
});

export const toEmailList = (text) =>
  String(text || '')
    .split(/[,;\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** The {{image:name}} names used in a body. */
export const imageNamesIn = (html) => {
  const names = new Set();
  String(html || '').replace(IMAGE_TOKEN, (match, name) => {
    names.add(name.toLowerCase());
    return match;
  });
  return [...names];
};

// "Summer Sale (2026).png" -> "summer-sale-2026"
export const suggestImageName = (fileName = '') =>
  fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 40);

const extensionOf = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

/** Checks one file against a limits block ({ maxSizeMB, allowedExtensions }). Returns '' when fine. */
export const checkFileAgainst = (file, limits) => {
  const allowed = (limits?.allowedExtensions || []).map((e) => String(e).toLowerCase());
  const extension = extensionOf(file.name);
  if (allowed.length > 0 && !allowed.includes(extension)) return `${file.name}: .${extension || '?'} files are not allowed.`;
  if (limits?.maxSizeMB != null && file.size > limits.maxSizeMB * 1024 * 1024) return `${file.name} is larger than ${limits.maxSizeMB} MB.`;
  return '';
};

/** Every problem the form can catch before sending. Returns an error message or ''. */
export const validateCompose = (compose, options) => {
  const access = options?.access || {};
  const external = toEmailList(compose.externalText);
  if (!compose.allCustomers && compose.customers.length === 0 && compose.groupIds.length === 0 && external.length === 0) {
    return 'Please choose who to send the email to.';
  }
  const badEmail = [...external, ...toEmailList(compose.ccText), ...toEmailList(compose.bccText)].find((e) => !EMAIL_PATTERN.test(e));
  if (badEmail) return `"${badEmail}" is not a valid email address.`;
  if (!compose.subject.trim()) return 'Please enter a subject.';
  if (!compose.htmlBody.trim()) return 'Please write the email.';

  const attachmentTotal = compose.attachmentIds.length + compose.uploadAttachments.length;
  if (access.attachments?.maxCount != null && attachmentTotal > access.attachments.maxCount) {
    return `An email can have at most ${access.attachments.maxCount} attachment(s).`;
  }
  const imageTotal = compose.imageIds.length + compose.uploadImages.length;
  if (access.images?.maxCount != null && imageTotal > access.images.maxCount) {
    return `An email can have at most ${access.images.maxCount} image(s).`;
  }
  const badName = compose.uploadImages.find((img) => !IMAGE_NAME_PATTERN.test(img.name));
  if (badName) return `Image name "${badName.name || '(empty)'}" may only use 2-40 lowercase letters, numbers, - and _.`;

  const libraryNames = (options?.libraryImages || []).filter((img) => compose.imageIds.includes(img._id)).map((img) => img.name);
  const allNames = [...libraryNames, ...compose.uploadImages.map((img) => img.name)];
  if (new Set(allNames).size !== allNames.length) return 'Two images have the same name. Please give each image its own name.';
  const missing = imageNamesIn(compose.htmlBody).filter((n) => !allNames.includes(n));
  if (missing.length) {
    return `The body uses ${missing.map((n) => `{{image:${n}}}`).join(', ')} - tick or upload an image with that name, or remove it from the body.`;
  }
  return '';
};

/** { fields, files } for sendEmailApi.sendEmail. */
export const buildSendPayload = (compose, options) => {
  const access = options?.access || {};
  const fields = {
    subject: compose.subject.trim(),
    htmlBody: compose.htmlBody,
    textBody: compose.textBody || '',
    allCustomers: compose.allCustomers,
    customerIds: compose.allCustomers ? [] : compose.customers.map((c) => c._id),
    groupIds: compose.allCustomers ? [] : compose.groupIds,
    externalEmails: toEmailList(compose.externalText),
  };
  if (access.isCcAndBccOn) {
    fields.includeCompanyCcList = compose.includeCompanyCcList;
    fields.includeCompanyBccList = compose.includeCompanyBccList;
    fields.ccList = toEmailList(compose.ccText);
    fields.bccList = toEmailList(compose.bccText);
  }
  const files = {};
  if (access.attachments?.isOn) {
    fields.attachmentIds = compose.attachmentIds;
    files.attachments = compose.uploadAttachments;
  }
  if (access.images?.isOn) {
    fields.imageIds = compose.imageIds;
    fields.uploadImageNames = compose.uploadImages.map((img) => img.name);
    files.images = compose.uploadImages.map((img) => img.file);
  }
  return { fields, files };
};

/** "Asha, Bilal and 3 more" style summary of who the email goes to. */
export const describeRecipients = (compose, options) => {
  const parts = [];
  if (compose.allCustomers) parts.push(`all customers (${options?.customerCount ?? 0})`);
  else {
    if (compose.customers.length) parts.push(`${compose.customers.length} customer(s)`);
    const groups = (options?.groups || []).filter((g) => compose.groupIds.includes(g._id));
    if (groups.length) parts.push(`group(s) ${groups.map((g) => g.groupName).join(', ')}`);
  }
  const external = toEmailList(compose.externalText).length;
  if (external) parts.push(`${external} typed address(es)`);
  return parts.join(' + ');
};
