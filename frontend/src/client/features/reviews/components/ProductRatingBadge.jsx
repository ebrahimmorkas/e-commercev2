import { useReviewSettings } from '../hooks/useReviewSettings';
import { StarRating } from './StarRating';

/**
 * Compact "★★★★☆ 4.3 (12)" line for product cards/rows. Shows nothing while
 * reviews are hidden for the store or the product has no reviews yet.
 *
 * @param {Object} props
 * @param {number} props.averageRating
 * @param {number} props.totalReviews
 */
const ProductRatingBadge = ({ averageRating = 0, totalReviews = 0, className = '' }) => {
  const { showReviews } = useReviewSettings();
  if (!showReviews || !totalReviews) return null;

  return (
    <p className={`flex items-center gap-1 text-xs text-slate-500 ${className}`}>
      <StarRating value={averageRating} size="xs" />
      <span className="font-medium text-slate-700">{averageRating.toFixed(1)}</span>
      <span>({totalReviews})</span>
    </p>
  );
};

export default ProductRatingBadge;
