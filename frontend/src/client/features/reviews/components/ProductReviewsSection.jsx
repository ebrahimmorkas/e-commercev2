import { useCallback, useEffect, useState } from 'react';
import theme from '../../Home/theme/theme';
import Spinner from '../../../../components/common/Spinner/Spinner';
import { useAuth } from '../../auth/hooks/useAuth';
import { useProductReviews } from '../hooks/useProductReviews';
import { useMyProductReviewStatus } from '../hooks/useMyReviewStatus';
import RatingSummary from './RatingSummary';
import ReviewCard, { PurchasedOptions, ReviewPhotos } from './ReviewCard';
import { formatReviewDate } from '../utils/formatReview';
import ReviewFormModal from './ReviewFormModal';
import ReviewImageViewer from './ReviewImageViewer';
import { StarRating } from './StarRating';

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'highest', label: 'Highest rating' },
  { value: 'lowest', label: 'Lowest rating' },
  { value: 'withImages', label: 'With photos' },
];

// The customer's own review, pinned above the list with an Edit button.
const MyReviewCard = ({ review, onEdit, onOpenImage }) => (
  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Your review</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StarRating value={review.rating} size="sm" />
          {review.title && <span className="text-sm font-bold text-slate-900">{review.title}</span>}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Reviewed on {formatReviewDate(review.createdAt)} <PurchasedOptions review={review} />
        </p>
      </div>
      <button
        type="button"
        onClick={() => onEdit(review)}
        className="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
      >
        Edit
      </button>
    </div>
    {review.comment && <p className="mt-2 text-sm text-slate-700 whitespace-pre-line break-words line-clamp-4">{review.comment}</p>}
    <ReviewPhotos images={review.images} onOpenImage={onOpenImage} size="w-14 h-14" />
  </div>
);

/**
 * "Customer reviews" block for the product page: rating summary with star
 * filters, the customer's own review / Write-a-review entry point, and the
 * sortable review list. Renders nothing unless reviews are visible for the
 * store (settings.showReviews).
 *
 * @param {Object} props
 * @param {string} props.productId
 * @param {string} props.productName
 * @param {Object} props.settings - useReviewSettings().settings
 * @param {Function} [props.onSignIn] - Opens the login modal for a guest.
 * @param {Function} [props.onReviewsChanged] - After the customer writes/edits/deletes a review.
 * @param {(summary: Object) => void} [props.onSummaryChange] - Latest rating summary, so the page header stays current.
 */
const ProductReviewsSection = ({ productId, productName, settings, onSignIn, onReviewsChanged, onSummaryChange }) => {
  const showReviews = !!settings?.showReviews;
  const { isAuthenticated } = useAuth();
  const reviews = useProductReviews(productId, { enabled: showReviews });
  const myStatus = useMyProductReviewStatus(productId, showReviews && isAuthenticated);
  const [formState, setFormState] = useState(null); // { review } | { orderOptions }
  const [viewer, setViewer] = useState({ images: [], index: null });

  useEffect(() => {
    if (reviews.summary) onSummaryChange?.(reviews.summary);
  }, [reviews.summary, onSummaryChange]);

  const openImage = useCallback((images, index) => setViewer({ images, index }), []);
  const setViewerIndex = useCallback((index) => setViewer((prev) => ({ ...prev, index })), []);

  const { reload: reloadReviews } = reviews;
  const { reload: reloadMyStatus } = myStatus;
  const handleChanged = useCallback(() => {
    reloadReviews();
    reloadMyStatus();
    onReviewsChanged?.();
  }, [reloadReviews, reloadMyStatus, onReviewsChanged]);

  if (!showReviews) return null;

  const { summary, total } = reviews;
  const status = myStatus.data;
  const myReviews = status?.myReviews || [];

  const renderWriteBox = () => {
    if (!isAuthenticated) {
      return (
        <>
          <p className="text-sm text-slate-600">Share your thoughts with other customers.</p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-3 w-full px-4 py-2 rounded-full text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Sign in to write a review
          </button>
        </>
      );
    }
    if (myStatus.loading && !status) return <Spinner size="sm" label="Checking" />;
    if (status?.canWrite) {
      return (
        <>
          <p className="text-sm text-slate-600">Share your thoughts with other customers.</p>
          <button
            type="button"
            onClick={() => setFormState({ orderOptions: status.eligibleOrders })}
            className="mt-3 w-full px-4 py-2 rounded-full text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-900 cursor-pointer"
          >
            Write a review
          </button>
        </>
      );
    }
    if (status?.reason === 'ALREADY_REVIEWED') {
      return <p className="text-sm text-slate-600">Thanks for reviewing this product. You can edit your review at any time.</p>;
    }
    return <p className="text-sm text-slate-600">Only customers who have received this product can review it.</p>;
  };

  return (
    <section className="mt-16 pt-10 border-t border-slate-200" id="reviews" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className={`text-lg font-bold ${theme.section.heading}`}>
        Customer Reviews
      </h2>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-[18rem_1fr] gap-8 md:gap-12">
        <aside className="space-y-6">
          {summary && summary.totalReviews > 0 ? (
            <RatingSummary summary={summary} activeRating={reviews.rating} onSelectRating={reviews.setRating} />
          ) : (
            !reviews.loading && <p className="text-sm text-slate-500">No reviews yet.</p>
          )}

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900">Review this product</h3>
            <div className="mt-1.5">{renderWriteBox()}</div>
          </div>
        </aside>

        <div className="min-w-0">
          {myReviews.length > 0 && (
            <div className="space-y-3 mb-6">
              {myReviews.map((review) => (
                <MyReviewCard key={review._id} review={review} onEdit={(r) => setFormState({ review: r })} onOpenImage={openImage} />
              ))}
            </div>
          )}

          {(summary?.totalReviews > 0 || reviews.rating) && (
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <p className="text-sm text-slate-600">
                {reviews.rating ? (
                  <>
                    {total} {total === 1 ? 'review' : 'reviews'} with {reviews.rating} star{reviews.rating > 1 ? 's' : ''}{' '}
                    <button type="button" onClick={() => reviews.setRating(null)} className="ml-1 font-medium text-amber-700 hover:underline cursor-pointer">
                      Clear filter
                    </button>
                  </>
                ) : (
                  <>
                    {total} {total === 1 ? 'review' : 'reviews'}
                  </>
                )}
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Sort by
                <select
                  value={reviews.sort}
                  onChange={(e) => reviews.setSort(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {reviews.loading ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" label="Loading reviews" />
            </div>
          ) : reviews.error ? (
            <div className="py-8 text-sm text-slate-600">
              {reviews.error}{' '}
              <button type="button" onClick={reviews.reload} className="font-medium text-amber-700 hover:underline cursor-pointer">
                Try again
              </button>
            </div>
          ) : reviews.reviews.length === 0 ? (
            summary?.totalReviews > 0 && (
              <p className="py-8 text-sm text-slate-500">No reviews match this filter.</p>
            )
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {reviews.reviews.map((review) => (
                  <ReviewCard key={review._id} review={review} onOpenImage={openImage} />
                ))}
              </div>
              {reviews.hasMore && (
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={reviews.loadMore}
                    disabled={reviews.loadingMore}
                    className="px-5 py-2 rounded-full text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
                  >
                    {reviews.loadingMore ? 'Loading...' : 'Show more reviews'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ReviewFormModal
        isOpen={!!formState}
        onClose={() => setFormState(null)}
        productId={productId}
        productName={productName}
        review={formState?.review}
        orderOptions={formState?.orderOptions}
        settings={settings}
        onSaved={handleChanged}
        onDeleted={handleChanged}
      />
      <ReviewImageViewer images={viewer.images} index={viewer.index} onChangeIndex={setViewerIndex} />
    </section>
  );
};

export default ProductReviewsSection;
