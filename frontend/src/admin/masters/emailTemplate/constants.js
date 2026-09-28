/**
 * Modules a template can be tagged with / assigned to. Mirrors
 * backend/constants/emailModuleConstants.js (EMAIL_MODULES) - add a new entry
 * here whenever the backend adds one.
 */
export const EMAIL_MODULE_OPTIONS = [{ value: 'order', label: 'Order' }];

// The only module whose templates can be split by order step
// (isDifferentEmailTemplatesForOrderStepsOn).
export const ORDER_MODULE = 'order';

export const EMAIL_MODULE_LABELS = EMAIL_MODULE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

export const getModuleLabel = (module) => EMAIL_MODULE_LABELS[module] || module;
