import { useCallback, useState } from 'react';
import theme from '../theme/theme';
import { getStorefrontProducts } from '../../products/api/productApi';
import { usePagedProducts } from '../../products/hooks/usePagedProducts';
import { DEFAULT_SORT } from '../../products/constants/sortOptions';
import SortSelect from '../../products/components/SortSelect';
import InfiniteProductGrid from '../../products/components/InfiniteProductGrid';
import { ProductGridSkeleton } from '../../products/components/ProductSkeletons';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';

/**
 * Every product in one infinite-scroll grid (one page at a time as the shopper scrolls -
 * never the whole catalogue at once). Only mounted when the vendor has this section on,
 * so a vendor who hides it doesn't trigger the product requests.
 */
const AllProductsSection = ({ onAddToCart, onProductClick, cartItems = {}, onIncrementItem, onDecrementItem, onSetItemQuantity }) => {
  const [sort, setSort] = useState(DEFAULT_SORT);
  const fetchPage = useCallback((page) => getStorefrontProducts({ page, sort }), [sort]);
  const { products, total, hasMore, loading, loadingMore, error, loadMoreError, loadMore, reload } = usePagedProducts({
    fetchPage,
    resetKey: `home|${sort}`,
  });

  return (
    <section id="all-products" className={`${theme.section.wrapper} scroll-mt-20`}>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={`${theme.section.headingLayout} ${theme.section.heading}`}>All Products</h2>
          {!loading && !error && total > 0 && (
            <p className={`${theme.section.subheadingLayout} ${theme.section.subheading}`}>
              {total.toLocaleString('en-IN')} product{total === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <SortSelect value={sort} onChange={setSort} disabled={loading} />
      </div>
      {loading && <ProductGridSkeleton count={9} />}

      {!loading && error && (
        <EmptyState
          title="Couldn't load products"
          description={error}
          action={
            <button type="button" onClick={reload} className={`${theme.hero.ctaSecondaryLayout} ${theme.hero.cta}`}>
              Try Again
            </button>
          }
        />
      )}

      {!loading && !error && products.length === 0 && (
        <EmptyState title="No products yet" description="Check back soon - new stock is added regularly." />
      )}

      {!loading && !error && products.length > 0 && (
        <InfiniteProductGrid
          products={products}
          total={total}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loadMoreError={loadMoreError}
          loadMore={loadMore}
          cartItems={cartItems}
          onAddToCart={onAddToCart}
          onProductClick={onProductClick}
          onIncrementItem={onIncrementItem}
          onDecrementItem={onDecrementItem}
          onSetItemQuantity={onSetItemQuantity}
        />
      )}
    </section>
  );
};

export default AllProductsSection;
