import { useState } from 'react';

const STAR_PATH =
  'M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z';

const SIZES = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-9 h-9',
};

// One star filled `fill` (0-1) from the left.
const Star = ({ fill, sizeClass }) => (
  <span className={`relative inline-block shrink-0 ${sizeClass}`} aria-hidden="true">
    <svg viewBox="0 0 20 20" className={`absolute inset-0 ${sizeClass} text-slate-200`} fill="currentColor">
      <path d={STAR_PATH} />
    </svg>
    {fill > 0 && (
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${Math.min(1, fill) * 100}%` }}>
        <svg viewBox="0 0 20 20" className={`${sizeClass} text-amber-400`} fill="currentColor">
          <path d={STAR_PATH} />
        </svg>
      </span>
    )}
  </span>
);

/**
 * Read-only star row. `value` may be fractional (4.3 fills 4 stars and 30% of the fifth).
 *
 * @param {Object} props
 * @param {number} props.value - 0 to 5.
 * @param {'xs'|'sm'|'md'|'lg'} [props.size]
 */
export const StarRating = ({ value = 0, size = 'sm', className = '' }) => {
  const sizeClass = SIZES[size] || SIZES.sm;
  const rounded = Math.round(value * 10) / 10;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`${rounded} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} fill={Math.max(0, Math.min(1, value - (star - 1)))} sizeClass={sizeClass} />
      ))}
    </span>
  );
};

const RATING_LABELS = { 1: 'Terrible', 2: 'Poor', 3: 'Average', 4: 'Good', 5: 'Excellent' };

/**
 * Clickable 1-5 star picker (radio group, keyboard friendly).
 *
 * @param {Object} props
 * @param {number} props.value - 0 = nothing chosen yet.
 * @param {(rating: number) => void} props.onChange
 */
export const StarRatingInput = ({ value = 0, onChange, disabled = false, size = 'xl' }) => {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;
  const sizeClass = SIZES[size] || SIZES.xl;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''} - ${RATING_LABELS[star]}`}
            disabled={disabled}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(0)}
            onClick={() => onChange?.(star)}
            className="cursor-pointer rounded transition-transform duration-100 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed"
          >
            <Star fill={star <= shown ? 1 : 0} sizeClass={sizeClass} />
          </button>
        ))}
      </div>
      <span className="text-sm font-medium text-slate-600 min-w-16">{shown ? RATING_LABELS[shown] : ''}</span>
    </div>
  );
};

export default StarRating;
