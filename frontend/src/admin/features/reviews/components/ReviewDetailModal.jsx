import { useState } from 'react';
import Modal from '../../../../components/common/Modal';
import Button from '../../../../components/common/Buttons';
import Badge from '../../../../components/common/Badge';
import Spinner from '../../../../components/common/Spinner';
import { useToast } from '../../../../components/common/Toast';
import { useAdminReviewDetail } from '../hooks/useAdminReviewDetail';
import { updateAdminReview, approveReviews, rejectReviews, deleteReviews } from '../api/reviewAdminApi';
import { Stars } from './Stars';
import ReviewEditForm from './ReviewEditForm';
import ReviewActionModal from './ReviewActionModal';
import { HISTORY_ACTION_LABELS } from '../constants';
import { formatDateTime, getStatusBadge, canApprove, canReject, purchasedOptions } from '../utils/formatAdminReview';
import theme from '../theme/theme';

const ContentBlock = ({ label, content, tone = '', note = '' }) => (
  <div className={`rounded-lg border p-3 ${tone || `${theme.panel.border} ${theme.panel.background}`}`}>
    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
      <p className={`text-xs font-semibold uppercase tracking-wide ${theme.text.subheading}`}>{label}</p>
      {note && <p className={`text-xs ${theme.text.muted}`}>{note}</p>}
    </div>
    {content ? (
      <>
        <Stars value={content.rating} />
        {content.title && <p className={`mt-1 font-medium ${theme.text.heading}`}>{content.title}</p>}
        {content.comment && <p className={`mt-1 text-sm whitespace-pre-line break-words ${theme.text.body}`}>{content.comment}</p>}
        {!content.title && !content.comment && <p className={`mt-1 text-sm italic ${theme.text.muted}`}>Rating only</p>}
        {content.images?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {content.images.map((image) => (
              <a key={image._id || image.url} href={image.url} target="_blank" rel="noreferrer">
                <img src={image.url} alt="" className={`h-16 w-16 rounded-md object-cover border ${theme.panel.border}`} />
              </a>
            ))}
          </div>
        )}
      </>
    ) : (
      <p className={`text-sm italic ${theme.text.muted}`}>Not shown on the storefront.</p>
    )}
  </div>
);

const sameContent = (a, b) => {
  if (!a || !b) return false;
  const imageIds = (content) => (content.images || []).map((image) => image._id || image.url).join(',');
  return a.rating === b.rating && a.title === b.title && a.comment === b.comment && imageIds(a) === imageIds(b);
};

const HistoryList = ({ history }) => {
  if (!history?.length) return <p className={`text-sm ${theme.text.muted}`}>No changes since it was posted.</p>;
  return (
    <ol className="space-y-2">
      {history.map((entry) => (
        <li key={entry._id} className={`rounded-lg border p-3 text-sm ${theme.panel.border}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`font-medium ${theme.text.heading}`}>{HISTORY_ACTION_LABELS[entry.action] || entry.action}</span>
            <span className={`text-xs ${theme.text.muted}`}>{formatDateTime(entry.at)}</span>
          </div>
          <p className={`text-xs ${theme.text.subheading}`}>
            {entry.byRole === 'system' ? 'System' : entry.by?.name || (entry.byRole === 'user' ? 'Customer' : 'Admin')}
          </p>
          {entry.reason && <p className={`mt-1 ${theme.text.body}`}>Reason: {entry.reason}</p>}
          {entry.before && entry.after && (
            <details className="mt-2">
              <summary className={`cursor-pointer text-xs ${theme.text.subheading}`}>Show before / after</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <ContentBlock label="Before" content={entry.before} />
                <ContentBlock label="After" content={entry.after} />
              </div>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
};

/**
 * Everything about one review for the admin: what the customer wrote now,
 * what is live on the storefront, the original version, the history, and the
 * actions the vendor's switches allow (edit, approve, reject, delete).
 *
 * Mounted only while a review is open. `onChanged` refreshes the list.
 */
const ReviewDetailModal = ({ reviewId, onClose, onChanged }) => {
  const { review, permissions, loading, error, reload } = useAdminReviewDetail(reviewId);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const run = async (request, { closeAfter = false } = {}) => {
    setBusy(true);
    try {
      const data = await request();
      toast.success(data?.message || 'Saved');
      onChanged();
      if (closeAfter) {
        onClose();
      } else {
        setEditing(false);
        reload();
      }
    } catch (err) {
      toast.error(err?.message || 'Something went wrong');
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const handleSave = (payload) => run(() => updateAdminReview({ reviewId, ...payload }).then(() => ({ message: payload.approve ? 'Review saved and approved' : 'Review saved' })));

  const handleConfirm = (reason) => {
    if (confirmAction === 'approve') return run(() => approveReviews([reviewId]));
    if (confirmAction === 'reject') return run(() => rejectReviews([reviewId], reason));
    if (confirmAction === 'delete') return run(() => deleteReviews([reviewId]), { closeAfter: true });
    return undefined;
  };

  const badge = review ? getStatusBadge(review) : null;
  const canEdit = permissions?.canEdit && review && !review.isDeleted;
  const showApprove = permissions?.canApproveReject && review && canApprove(review);
  const showReject = permissions?.canApproveReject && review && canReject(review);
  const showDelete = review && !review.isDeleted;
  const current = review ? { rating: review.rating, title: review.title, comment: review.comment, images: review.images } : null;
  const currentIsLive = review && sameContent(current, review.publishedContent);

  const footer =
    review && !editing ? (
      <div className="flex flex-wrap justify-end gap-2">
        {showDelete && (
          <Button variant={theme.button.danger} onClick={() => setConfirmAction('delete')} disabled={busy}>
            Delete
          </Button>
        )}
        {showReject && (
          <Button variant={theme.button.outline} onClick={() => setConfirmAction('reject')} disabled={busy}>
            Reject
          </Button>
        )}
        {canEdit && (
          <Button variant={theme.button.secondary} onClick={() => setEditing(true)} disabled={busy}>
            Edit
          </Button>
        )}
        {showApprove && (
          <Button variant={theme.button.success} onClick={() => setConfirmAction('approve')} disabled={busy}>
            Approve
          </Button>
        )}
      </div>
    ) : null;

  return (
    <>
      <Modal isOpen onClose={busy ? undefined : onClose} title="Review" size="xl" footer={footer}>
        {!review && loading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}
        {error && (
          <p className={`mb-3 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-3 py-2`}>{error}</p>
        )}
        {review && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`font-semibold ${theme.text.heading}`}>{review.product?.name || 'Product'}</p>
                <p className={`text-sm ${theme.text.subheading}`}>
                  {review.customer?.name || 'Customer'}
                  {review.customer?.email ? ` · ${review.customer.email}` : ''}
                </p>
                <p className={`text-xs ${theme.text.muted}`}>
                  {[review.orderNumber && `Order ${review.orderNumber}`, purchasedOptions(review), `Posted ${formatDateTime(review.createdAt)}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={badge.variant} size="sm">
                  {badge.label}
                </Badge>
                {review.hasPendingChanges && (
                  <Badge variant={theme.badge.pendingChanges} size="sm">
                    Edit waiting
                  </Badge>
                )}
                {review.isEditedByAdmin && (
                  <Badge variant={theme.badge.edited} size="sm">
                    Edited by admin
                  </Badge>
                )}
              </div>
            </div>

            {review.moderationStatus === 'REJECTED' && review.rejectionReason && (
              <p className={`text-sm ${theme.alert.info.text} ${theme.alert.info.background} border ${theme.alert.info.border} rounded-lg px-3 py-2`}>
                Rejection reason: {review.rejectionReason}
              </p>
            )}

            {editing ? (
              <ReviewEditForm review={review} permissions={permissions} busy={busy} onSubmit={handleSave} onCancel={() => setEditing(false)} />
            ) : currentIsLive ? (
              <ContentBlock label="Review (live on the storefront)" content={review.publishedContent} tone={theme.panel.live} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <ContentBlock
                  label={review.moderationStatus === 'PENDING' ? 'Waiting for approval' : 'Latest version'}
                  content={current}
                  tone={review.moderationStatus === 'PENDING' ? theme.panel.pending : ''}
                  note={review.moderationStatus === 'REJECTED' ? 'Hidden from everyone' : ''}
                />
                <ContentBlock label="Live on the storefront" content={review.publishedContent} tone={review.publishedContent ? theme.panel.live : ''} />
              </div>
            )}

            {!editing && review.originalContent && !sameContent(review.originalContent, current) && (
              <ContentBlock label="Originally posted by the customer" content={review.originalContent} />
            )}

            {!editing && (
              <div>
                <p className={`text-sm font-semibold mb-2 ${theme.text.heading}`}>History</p>
                <HistoryList history={review.history} />
              </div>
            )}
          </div>
        )}
      </Modal>
      {confirmAction && <ReviewActionModal action={confirmAction} busy={busy} onConfirm={handleConfirm} onClose={() => setConfirmAction(null)} />}
    </>
  );
};

export default ReviewDetailModal;
