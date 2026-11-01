import { useState } from 'react';
import Modal from '../../../../components/common/Modal';
import Button from '../../../../components/common/Buttons';
import { REJECTION_REASON_MAX } from '../constants';
import theme from '../theme/theme';

const COPY = {
  reject: {
    title: 'Reject review',
    confirm: 'Reject',
    variant: theme.button.danger,
    body: (count) =>
      `${count === 1 ? 'This review' : `These ${count} reviews`} will not be shown to anyone. If it was an edit of an already-approved review, the earlier approved version stays live. The customer is not told.`,
  },
  delete: {
    title: 'Delete review',
    confirm: 'Delete',
    variant: theme.button.danger,
    body: (count) => `${count === 1 ? 'This review' : `These ${count} reviews`} will be removed from the storefront and from the product's rating.`,
  },
  approve: {
    title: 'Approve review',
    confirm: 'Approve',
    variant: theme.button.success,
    body: (count) => `${count === 1 ? 'This review' : `These ${count} reviews`} will go live on the storefront and count towards the product's rating.`,
  },
};

/**
 * Confirmation for approve / reject / delete (one review or many). Reject
 * also takes an optional reason, only ever seen by admins.
 *
 * Mounted only while open (the parent renders it conditionally), so the reason
 * starts empty every time.
 */
const ReviewActionModal = ({ action, count = 1, busy = false, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  const copy = COPY[action];
  if (!copy) return null;

  return (
    <Modal
      isOpen
      onClose={busy ? undefined : onClose}
      title={count > 1 ? `${copy.title}s (${count})` : copy.title}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant={theme.button.ghost} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={copy.variant} loading={busy} onClick={() => onConfirm(action === 'reject' ? reason.trim() : undefined)}>
            {copy.confirm}
          </Button>
        </div>
      }
    >
      <p className={`text-sm ${theme.text.body}`}>{copy.body(count)}</p>
      {action === 'reject' && (
        <div className="mt-4">
          <label htmlFor="review-reject-reason" className={`block text-sm font-medium mb-1 ${theme.text.heading}`}>
            Reason <span className={theme.text.muted}>(optional, admins only)</span>
          </label>
          <textarea
            id="review-reject-reason"
            rows={3}
            maxLength={REJECTION_REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={theme.input}
            disabled={busy}
          />
          <p className={`mt-1 text-xs text-right ${theme.text.muted}`}>
            {reason.length}/{REJECTION_REASON_MAX}
          </p>
        </div>
      )}
    </Modal>
  );
};

export default ReviewActionModal;
