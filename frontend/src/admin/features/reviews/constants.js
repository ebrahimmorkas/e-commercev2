// Must match backend constants/reviewConstants.js.
export const REVIEWS_REALTIME_MODULE = 'REVIEWS';
export const PAGE_SIZE = 20;
export const TITLE_MAX = 120;
export const COMMENT_MAX = 3000;
export const REJECTION_REASON_MAX = 500;

export const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'deleted', label: 'Deleted' },
];

export const SORT_OPTIONS = [
  { value: 'pendingFirst', label: 'Pending first' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Highest rating' },
  { value: 'lowest', label: 'Lowest rating' },
];

export const RATING_OPTIONS = [
  { value: '', label: 'Any rating' },
  { value: '5', label: '5 stars' },
  { value: '4', label: '4 stars' },
  { value: '3', label: '3 stars' },
  { value: '2', label: '2 stars' },
  { value: '1', label: '1 star' },
];

export const MODERATION_LABELS = {
  APPROVED: 'Approved',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
};

export const HISTORY_ACTION_LABELS = {
  CUSTOMER_EDIT: 'Edited by customer',
  ADMIN_EDIT: 'Edited by admin',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EDIT_REJECTED: 'Edit rejected (earlier version kept)',
  AUTO_APPROVED: 'Published automatically (approval switched off)',
  DELETED: 'Deleted',
};
