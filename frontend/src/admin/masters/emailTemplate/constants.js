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
  { value: 'discountAvailable', label: 'Discount Available' },
  { value: 'discountExpiringSoon', label: 'Discount Expiring Soon' },
  { value: 'freeCashCredited', label: 'Free Cash Credited' },
  { value: 'freeCashUsed', label: 'Free Cash Used' },
  { value: 'freeCashRefunded', label: 'Free Cash Refunded' },
  { value: 'freeCashRevoked', label: 'Free Cash Revoked' },
  { value: 'freeCashExpired', label: 'Free Cash Expired' },
  { value: 'freeCashExpiringSoon', label: 'Free Cash Expiring Soon' },
];

/**
 * The module options to offer. unavailableModules comes from the backend
 * (modules whose feature - courier / discount / Free Cash - is off).
 */
export const getModuleOptions = (unavailableModules = []) =>
  EMAIL_MODULE_OPTIONS.filter((option) => !unavailableModules.includes(option.value));

// The only module whose templates can be split by order step
// (isDifferentEmailTemplatesForOrderStepsOn).
export const ORDER_MODULE = 'order';

export const EMAIL_MODULE_LABELS = EMAIL_MODULE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

export const getModuleLabel = (module) => EMAIL_MODULE_LABELS[module] || module;
