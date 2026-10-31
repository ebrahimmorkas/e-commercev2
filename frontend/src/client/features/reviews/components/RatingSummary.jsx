import { StarRating } from './StarRating';

/**
 * Average rating, review count and a 5 -> 1 star breakdown. Each bar filters
 * the list to that star rating; clicking the active one clears the filter.
 *
 * @param {Object} props
 * @param {{ averageRating: number, totalReviews: number, breakdown: Object }} props.summary
 * @param {number|null} props.activeRating
 * @param {(rating: number|null) => void} props.onSelectRating
 */
const RatingSummary = ({ summary, activeRating, onSelectRating }) => {
  const total = summary?.totalReviews || 0;
  const average = summary?.averageRating || 0;

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="text-4xl font-bold text-slate-900">{average.toFixed(1)}</span>
        <div>
          <StarRating value={average} size="md" />
          <p className="mt-0.5 text-sm text-slate-500">
            {total} {total === 1 ? 'rating' : 'ratings'}
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = summary?.breakdown?.[star] || 0;
          const percent = total ? Math.round((count / total) * 100) : 0;
          const isActive = activeRating === star;
          return (
            <li key={star}>
              <button
                type="button"
                disabled={count === 0 && !isActive}
                onClick={() => onSelectRating?.(isActive ? null : star)}
                aria-pressed={isActive}
                className={`group w-full flex items-center gap-3 text-sm rounded-md px-1.5 py-1 transition-colors duration-150 ${
                  isActive ? 'bg-amber-50' : 'hover:bg-slate-50'
                } disabled:cursor-default disabled:hover:bg-transparent cursor-pointer`}
              >
                <span className={`w-12 shrink-0 text-left ${isActive ? 'font-semibold text-amber-700' : 'text-slate-600 group-hover:underline'}`}>
                  {star} star
                </span>
                <span className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right text-slate-500">{percent}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default RatingSummary;
