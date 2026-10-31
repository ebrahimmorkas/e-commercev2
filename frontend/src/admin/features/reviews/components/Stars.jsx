import theme from '../theme/theme';

const STAR_PATH = 'M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z';
const SIZES = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-7 h-7' };

const StarIcon = ({ filled, sizeClass }) => (
  <svg viewBox="0 0 20 20" className={`${sizeClass} ${filled ? theme.star.filled : theme.star.empty}`} fill="currentColor" aria-hidden="true">
    <path d={STAR_PATH} />
  </svg>
);

/** Read-only whole-star rating (reviews are always 1-5). */
export const Stars = ({ value = 0, size = 'sm' }) => {
  const sizeClass = SIZES[size] || SIZES.sm;
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} filled={star <= value} sizeClass={sizeClass} />
      ))}
    </span>
  );
};

/** Clickable 1-5 picker. */
export const StarsInput = ({ value = 0, onChange, disabled = false, size = 'lg' }) => {
  const sizeClass = SIZES[size] || SIZES.lg;
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className="cursor-pointer disabled:cursor-not-allowed rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <StarIcon filled={star <= value} sizeClass={sizeClass} />
        </button>
      ))}
    </div>
  );
};

export default Stars;
