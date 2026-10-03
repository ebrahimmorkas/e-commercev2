import theme from '../../Home/theme/theme';

const formatCount = (value) => value.toLocaleString('en-IN');

/**
 * "Showing 48 of 10,012 products" + a Load more button under a paged product
 * list. A button rather than auto-loading on scroll, so the page always ends
 * and the footer below stays reachable. While the next page loads, the
 * caller renders skeletons under the list; a failed page offers a retry
 * without losing what's already shown.
 */
const LoadMoreFooter = ({ shown, total, hasMore, loadingMore, error, onLoadMore, itemLabel = 'products' }) => {
  if (total === 0) return null;

  return (
    <div className="mt-8 flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-slate-500" aria-live="polite">
        Showing {formatCount(shown)} of {formatCount(total)} {itemLabel}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className={`${theme.hero.ctaSecondaryLayout} ${theme.card.button} px-8 py-2.5 disabled:opacity-60 disabled:cursor-wait`}
        >
          {loadingMore ? 'Loading...' : error ? 'Try again' : 'Load more'}
        </button>
      ) : (
        shown > 0 && <p className="text-xs text-slate-400">You've seen all {itemLabel}.</p>
      )}
    </div>
  );
};

export default LoadMoreFooter;
