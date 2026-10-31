import { useState } from 'react';
import { StarRating } from './StarRating';
import { formatReviewDate } from '../utils/formatReview';

const COMMENT_CLAMP_LENGTH = 320;

export const PurchasedOptions = ({ review }) => {
  const parts = [
    review.variantName ? `Colour: ${review.variantName}` : null,
    review.sizeName ? `Size: ${review.sizeName}` : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <span className="text-xs text-slate-500">{parts.join(' | ')}</span>;
};

export const VerifiedBadge = () => (
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
    Verified Purchase
  </span>
);

export const ReviewPhotos = ({ images, onOpenImage, size = 'w-20 h-20' }) => {
  if (!images?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {images.map((image, index) => (
        <button
          key={image._id || image.url}
          type="button"
          onClick={() => onOpenImage?.(images, index)}
          className={`${size} rounded-lg overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500`}
          aria-label={`View photo ${index + 1} of ${images.length}`}
        >
          <img src={image.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
};

/**
 * One customer review in the product page list.
 *
 * @param {Object} props
 * @param {Object} props.review - formatPublicReview shape from the backend.
 * @param {(images: Array, index: number) => void} [props.onOpenImage]
 */
const ReviewCard = ({ review, onOpenImage }) => {
  const [expanded, setExpanded] = useState(false);
  const comment = review.comment || '';
  const isLong = comment.length > COMMENT_CLAMP_LENGTH;
  const shownComment = isLong && !expanded ? `${comment.slice(0, COMMENT_CLAMP_LENGTH).trimEnd()}...` : comment;
  const initial = (review.reviewerName || 'C').trim().charAt(0).toUpperCase();

  return (
    <article className="py-5">
      <div className="flex items-center gap-2.5">
        <span
          className="w-8 h-8 shrink-0 rounded-full bg-slate-200 text-slate-600 text-sm font-semibold flex items-center justify-center"
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="text-sm font-medium text-slate-800">{review.reviewerName}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <StarRating value={review.rating} size="sm" />
        {review.title && <h4 className="text-sm font-bold text-slate-900">{review.title}</h4>}
      </div>

      <p className="mt-1 text-xs text-slate-500">
        Reviewed on {formatReviewDate(review.createdAt)}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <PurchasedOptions review={review} />
        {review.isVerifiedPurchase && <VerifiedBadge />}
      </div>

      {comment && (
        <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line break-words">
          {shownComment}
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="ml-1 text-sm font-medium text-amber-700 hover:underline cursor-pointer"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </p>
      )}

      <ReviewPhotos images={review.images} onOpenImage={onOpenImage} />
    </article>
  );
};

export default ReviewCard;
