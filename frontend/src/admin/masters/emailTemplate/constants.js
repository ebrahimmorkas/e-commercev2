/**
 * Modules a template can be tagged with / assigned to. Mirrors
 * backend/constants/emailModuleConstants.js (EMAIL_MODULES) - add a new entry
 * here whenever the backend adds one.
 */
export const EMAIL_MODULE_OPTIONS = [
  { value: 'order', label: 'Order' },
  { value: 'deliveryAgentAssigned', label: 'Delivery Agent Assigned' },
  { value: 'deliveryAgentChanged', label: 'Delivery Agent Changed' },
  { value: 'deliveryAgentUnassigned', label: 'Delivery Agent Unassigned' },
  { value: 'deliveryDateChanged', label: 'Delivery Date Changed' },
  { value: 'courierAssigned', label: 'Courier Assigned' },
  { value: 'courierChanged', label: 'Courier Changed' },
  { value: 'courierRemoved', label: 'Courier Removed' },
];

// Only offered while the courier feature is on (backend COURIER_EMAIL_MODULES).
export const COURIER_MODULES = ['courierAssigned', 'courierChanged', 'courierRemoved'];

/** The module options to offer, given whether the courier feature is on. */
export const getModuleOptions = (isCourierFeatureOn) =>
  EMAIL_MODULE_OPTIONS.filter((option) => isCourierFeatureOn || !COURIER_MODULES.includes(option.value));

// The only module whose templates can be split by order step
// (isDifferentEmailTemplatesForOrderStepsOn).
export const ORDER_MODULE = 'order';

export const EMAIL_MODULE_LABELS = EMAIL_MODULE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

export const getModuleLabel = (module) => EMAIL_MODULE_LABELS[module] || module;
