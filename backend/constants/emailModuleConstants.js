// Fixed set of module keys that email-template tagging (CompanySettings.
// emailTemplateAssignments), EmailTemplateMaster.module, and
// DefaultEmailTemplateMaster.module all key off. Keeping this as a shared
// enum (rather than a free string) means a vendor's tag and the platform's
// default templates can never silently mismatch on a typo. Add a new key
// here whenever another feature is wired up to send templated email.
const EMAIL_MODULES = {
    ORDER: 'order'
};

const VALID_EMAIL_MODULES = Object.values(EMAIL_MODULES);

module.exports = {
    EMAIL_MODULES,
    VALID_EMAIL_MODULES
};
