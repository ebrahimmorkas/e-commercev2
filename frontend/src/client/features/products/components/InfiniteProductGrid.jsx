import theme from '../../Home/theme/theme';
import ProductGrid from './ProductGrid';
import { ProductGridSkeleton } from './ProductSkeletons';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

const formatCount = (value) => value.toLocaleString('en-IN');

/**
 * A product grid that loads the next page as the user scrolls: skeleton cards
 * show where the next products will appear, a failed page offers a retry, and
 * a floating "Footer" button keeps the page footer reachable however long the
 * list gets (see useInfiniteScroll).
 *
 * Takes the result of usePagedProducts, plus the usual cart props.
 */
const InfiniteProductGrid = ({
  products,
  total,
  hasMore,
  loadingMore,
  loadMoreError,
  loadMore,
  cartItems,
  onAddToCart,
  onProductClick,
  onIncrementItem,
  onDecrementItem,
  onSetItemQuantity,
}) => {
  // A failed page stops auto-loading (else it would retry in a tight loop) until the user taps Try again.
  const { sentinelRef, footerInView, jumpToFooter } = useInfiniteScroll({
    onLoadMore: loadMore,
    itemCount: products.length,
    enabled: hasMore && !loadMoreError,
  });

  return (
    <>
      <ProductGrid
        products={products}
        cartItems={cartItems}
        onAddToCart={onAddToCart}
        onProductClick={onProductClick}
        onIncrementItem={onIncrementItem}
        onDecrementItem={onDecrementItem}
        onSetItemQuantity={onSetItemQuantity}
      />

      {loadingMore && (
        <div className="mt-4 sm:mt-6">
          <ProductGridSkeleton count={6} label="Loading more products" />
        </div>
      )}

      <div ref={sentinelRef} className="mt-8 flex flex-col items-center gap-3 text-center" aria-live="polite">
        {loadMoreError && <p className="text-sm text-red-600">{loadMoreError}</p>}
        {hasMore && !loadingMore && (loadMoreError || footerInView) && (
          // Manual fallback: shown after a failed page, or while loading is paused because the footer is on screen.
          <button
            type="button"
            onClick={loadMore}
            className={`${theme.hero.ctaSecondaryLayout} ${theme.card.button} px-8 py-2.5`}
          >
            {loadMoreError ? 'Try again' : `Load more (${formatCount(products.length)} of ${formatCount(total)})`}
          </button>
        )}
        {!hasMore && products.length > 0 && (
          <p className="text-xs text-slate-400">You've seen all {formatCount(total)} products.</p>
        )}
      </div>

      {hasMore && !footerInView && (
        <button
          type="button"
          onClick={jumpToFooter}
          className="fixed bottom-5 right-5 z-30 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
          aria-label="Jump to the page footer"
        >
          Footer &darr;
        </button>
      )}
    </>
  );
};

export default InfiniteProductGrid;
