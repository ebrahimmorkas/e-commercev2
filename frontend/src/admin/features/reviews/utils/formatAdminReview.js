import { MODERATION_LABELS } from '../constants';
import theme from '../theme/theme';

export const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** { label, variant } for the review's state badge. */
export const getStatusBadge = (review) => {
  if (review.isDeleted) return { label: 'Deleted', variant: theme.badge.deleted };
  return {
    label: MODERATION_LABELS[review.moderationStatus] || review.moderationStatus,
    variant: theme.badge.moderation[review.moderationStatus] || 'gray',
  };
};

export const canApprove = (review) => !review.isDeleted && (review.moderationStatus === 'PENDING' || review.moderationStatus === 'REJECTED');
export const canReject = (review) => !review.isDeleted && review.moderationStatus === 'PENDING';

/** "Blue / Large" from the purchased variant/size, or ''. */
export const purchasedOptions = (review) => [review.variantName, review.sizeName].filter(Boolean).join(' / ');
