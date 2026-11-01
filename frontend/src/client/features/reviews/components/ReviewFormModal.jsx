import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../../../components/common/Modal/Modal';
import { useToast } from '../../../../components/common/Toast';
import { StarRatingInput } from './StarRating';
import { createReview, deleteReview, updateReview } from '../api/reviewApi';

const TITLE_MAX = 120;
const COMMENT_MAX = 3000;
const DEFAULT_FORMATS = ['jpg', 'jpeg', 'png'];

const fileExtension = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

// Object URLs for the new photos' previews, released when they change/unmount.
const usePreviewUrls = (files) => {
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  return urls;
};

const PhotoTile = ({ src, onRemove, disabled }) => (
  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
    <img src={src} alt="" className="w-full h-full object-cover" />
    <button
      type="button"
      onClick={onRemove}
      disabled={disabled}
      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 text-white text-sm leading-none hover:bg-slate-900 cursor-pointer disabled:cursor-not-allowed"
      aria-label="Remove photo"
    >
      ×
    </button>
  </div>
);

/**
 * The form itself - mounted fresh every time the modal opens, so it always
 * starts from the review being edited (or empty).
 */
const ReviewForm = ({ productId, productName, orderOptions, orderId: fixedOrderId, review, settings, onSaved, onDeleted, onClose }) => {
  const toast = useToast();
  const isEdit = !!review;
  const fileInputRef = useRef(null);

  const [rating, setRating] = useState(review?.rating || 0);
  const [title, setTitle] = useState(review?.title || '');
  const [comment, setComment] = useState(review?.comment || '');
  const [orderId, setOrderId] = useState(fixedOrderId || orderOptions?.[0]?.orderId || '');
  const [keptImages, setKeptImages] = useState(review?.images || []);
  const [newFiles, setNewFiles] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const previewUrls = usePreviewUrls(newFiles);

  const imagesAllowed = !!settings?.imagesAllowed;
  const maxImages = settings?.maxImagesPerReview || 0;
  const maxImageMB = settings?.maxImageSizeMB || null;
  const allowedFormats = settings?.allowedImageFormats?.length ? settings.allowedImageFormats : DEFAULT_FORMATS;
  const photoCount = keptImages.length + newFiles.length;
  const canAddPhotos = imagesAllowed && photoCount < maxImages;

  const handlePickFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;

    const room = maxImages - photoCount;
    const accepted = [];
    const problems = [];
    picked.forEach((file) => {
      if (!allowedFormats.includes(fileExtension(file.name))) {
        problems.push(`${file.name}: only ${allowedFormats.join(', ')} photos are allowed.`);
      } else if (maxImageMB && file.size > maxImageMB * 1024 * 1024) {
        problems.push(`${file.name}: larger than ${maxImageMB}MB.`);
      } else if (accepted.length >= room) {
        problems.push(`You can add at most ${maxImages} photo${maxImages === 1 ? '' : 's'}.`);
      } else {
        accepted.push(file);
      }
    });

    setNewFiles((prev) => [...prev, ...accepted]);
    setError([...new Set(problems)].join(' '));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError('Please choose a star rating.');
      return;
    }
    if (!isEdit && !orderId) {
      setError('Please choose the order you are reviewing.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        const keptIds = new Set(keptImages.map((image) => image._id));
        const removeImageIds = (review.images || []).filter((image) => !keptIds.has(image._id)).map((image) => image._id);
        saved = await updateReview({
          reviewId: review._id,
          rating,
          title: title.trim(),
          comment: comment.trim(),
          removeImageIds,
          files: newFiles,
        });
      } else {
        saved = await createReview({
          productId,
          orderId,
          rating,
          title: title.trim(),
          comment: comment.trim(),
          files: newFiles,
        });
      }
      toast.success(isEdit ? 'Your review has been updated.' : 'Thank you! Your review has been posted.');
      onSaved?.(saved?.review || null);
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not save your review. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError('');
    try {
      await deleteReview(review._id);
      toast.success('Your review has been deleted.');
      onDeleted?.(review);
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not delete your review. Please try again.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {productName && <p className="text-sm font-medium text-slate-700 line-clamp-2">{productName}</p>}

      {error && (
        <div className="px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700" role="alert">
          {error}
        </div>
      )}

      {!isEdit && !fixedOrderId && orderOptions?.length > 1 && (
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Which order are you reviewing?</span>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            disabled={saving}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          >
            {orderOptions.map((order) => (
              <option key={order.orderId} value={order.orderId}>
                {order.orderNumber}
                {[order.variantName, order.sizeName].filter(Boolean).length
                  ? ` - ${[order.variantName, order.sizeName].filter(Boolean).join(' / ')}`
                  : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <div>
        <p className="text-sm font-semibold text-slate-800">Overall rating</p>
        <div className="mt-1.5">
          <StarRatingInput value={rating} onChange={setRating} disabled={saving} />
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Add a headline</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          disabled={saving}
          placeholder="What's most important to know?"
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Write your review</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={COMMENT_MAX}
          disabled={saving}
          placeholder="What did you like or dislike? How did you use this product?"
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-32 resize-y outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
        <span className="mt-1 block text-right text-xs text-slate-400">
          {comment.length}/{COMMENT_MAX}
        </span>
      </label>

      {imagesAllowed && (
        <div>
          <p className="text-sm font-semibold text-slate-800">Add photos</p>
          <p className="text-xs text-slate-500">
            Up to {maxImages} photo{maxImages === 1 ? '' : 's'} ({allowedFormats.join(', ')}
            {maxImageMB ? `, max ${maxImageMB}MB each` : ''}).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {keptImages.map((image) => (
              <PhotoTile
                key={image._id}
                src={image.url}
                disabled={saving}
                onRemove={() => setKeptImages((prev) => prev.filter((item) => item._id !== image._id))}
              />
            ))}
            {newFiles.map((file, index) => (
              <PhotoTile
                key={`${file.name}-${file.lastModified}-${index}`}
                src={previewUrls[index]}
                disabled={saving}
                onRemove={() => setNewFiles((prev) => prev.filter((_, i) => i !== index))}
              />
            ))}
            {canAddPhotos && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-amber-500 hover:text-amber-600 flex flex-col items-center justify-center text-xs cursor-pointer disabled:cursor-not-allowed"
              >
                <span className="text-2xl leading-none">+</span>
                Photo
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={allowedFormats.map((format) => `.${format}`).join(',')}
            multiple
            onChange={handlePickFiles}
            className="hidden"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {isEdit ? (
          confirmDelete ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Delete this review?</span>
              <button type="button" onClick={handleDelete} disabled={saving} className="font-semibold text-red-600 hover:underline cursor-pointer">
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={saving} className="text-slate-500 hover:underline cursor-pointer">
                Keep it
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
              className="text-sm font-medium text-red-600 hover:underline cursor-pointer"
            >
              Delete review
            </button>
          )
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-full text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-full text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-900 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Submit review'}
          </button>
        </div>
      </div>
    </form>
  );
};

/**
 * Write a new review (needs a delivered order: a fixed `orderId` from the
 * order page, or `orderOptions` to pick from on the product page) or edit /
 * delete an existing one (`review`).
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {string} props.productId
 * @param {string} [props.productName]
 * @param {string} [props.orderId]
 * @param {Array} [props.orderOptions] - [{ orderId, orderNumber, variantName, sizeName }]
 * @param {Object} [props.review] - The customer's own review, to edit.
 * @param {Object} props.settings - useReviewSettings().settings
 * @param {(review: Object|null) => void} [props.onSaved]
 * @param {(review: Object) => void} [props.onDeleted]
 */
const ReviewFormModal = ({ isOpen, onClose, review, ...formProps }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={review ? 'Edit your review' : 'Write a review'} size="md">
    {isOpen && <ReviewForm review={review} onClose={onClose} {...formProps} />}
  </Modal>
);

export default ReviewFormModal;
