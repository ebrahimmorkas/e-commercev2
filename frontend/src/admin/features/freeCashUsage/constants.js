// Mirrors backend/constants/freeCashUsageConstants.js.

export const EVENT_LABELS = {
  ASSIGNED: 'Assigned',
  USED: 'Used',
  REFUNDED: 'Refunded',
  REVOKED: 'Revoked',
  RESTORED: 'Given back',
  EXPIRED: 'Expired',
};

export const GRANT_STATE_LABELS = {
  ACTIVE: 'Active',
  NOT_STARTED: 'Not started yet',
  USED_UP: 'Used up',
  REVOKED: 'Revoked',
  EXPIRED: 'Expired',
  CAMPAIGN_INACTIVE: 'Free Cash inactive',
  CAMPAIGN_DELETED: 'Free Cash deleted',
};

export const CUSTOMER_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All customers' },
  { value: 'A', label: 'Active customers' },
  { value: 'I', label: 'Inactive customers' },
];

export const SORT_OPTIONS = [
  { value: 'NAME', label: 'Customer name (A to Z)' },
  { value: 'ACTIVE_HIGH_TO_LOW', label: 'Active Free Cash: high to low' },
  { value: 'ACTIVE_LOW_TO_HIGH', label: 'Active Free Cash: low to high' },
];

export const FREE_CASH_USAGE_PAGE_SIZE = 20;
