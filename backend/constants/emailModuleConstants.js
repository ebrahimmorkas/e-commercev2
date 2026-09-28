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

// Human-readable names used in messages shown to the vendor (e.g. "The Order
// module is already assigned to ..."). Mirrors the frontend's
// EMAIL_MODULE_OPTIONS labels - add an entry alongside every new module key.
const EMAIL_MODULE_LABELS = {
    [EMAIL_MODULES.ORDER]: 'Order'
};

const getEmailModuleLabel = (module) => EMAIL_MODULE_LABELS[module] || module;

module.exports = {
    EMAIL_MODULES,
    VALID_EMAIL_MODULES,
    EMAIL_MODULE_LABELS,
    getEmailModuleLabel
};
