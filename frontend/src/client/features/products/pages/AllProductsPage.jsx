import { useCallback } from 'react';
import theme from '../../Home/theme/theme';
import { getStorefrontProducts } from '../api/productApi';
import { usePagedProducts } from '../hooks/usePagedProducts';
import { ProductGridSkeleton } from '../components/ProductSkeletons';
import InfiniteProductGrid from '../components/InfiniteProductGrid';
import SortSelect from '../components/SortSelect';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';

/**
 * Every product in the store (/products), or search results for the header
 * search box (/products?q=...). Loads a page at a time as you scroll
 * (page size set per vendor in CompanyMaster.productsPerPage), with a jump-to-footer shortcut.
 *
 * @param {Object} props
 * @param {string} [props.query] - Search text from the URL.
 * @param {string} props.sort - Current sort (from the URL).
 * @param {Function} props.onSortChange - (sort) => void, updates the URL.
 * @param {Function} props.onClearSearch - Back to all products.
 */
const AllProductsPage = ({
  query = '',
  sort,
  onSortChange,
  onClearSearch,
  cartItems = {},
  onAddToCart,
  onProductClick,
  onIncrementItem,
  onDecrementItem,
  onSetItemQuantity,
}) => {
  const fetchPage = useCallback(
    (page) => getStorefrontProducts({ page, sort, q: query }),
    [sort, query]
  );
  const { products, total, hasMore, loading, loadingMore, error, loadMoreError, loadMore, reload } = usePagedProducts({
    fetchPage,
    resetKey: `${query}|${sort}`,
  });

  const heading = query ? `Results for "${query}"` : 'All Products';
  let subheading = 'Loading products...';
  if (!loading && !error) {
    subheading = `${total.toLocaleString('en-IN')} product${total === 1 ? '' : 's'}`;
  }

  return (
    <div className={theme.page.background}>
      <section className={theme.section.wrapper}>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className={`${theme.section.headingLayout} ${theme.section.heading}`}>{heading}</h1>
            <p className={`${theme.section.subheadingLayout} ${theme.section.subheading}`} aria-live="polite">
              {subheading}
            </p>
          </div>
          <SortSelect value={sort} onChange={onSortChange} disabled={loading} />
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
          <EmptyState
            title={query ? 'No matching products' : 'No products yet'}
            description={query ? `Nothing matches "${query}". Try a shorter or different word.` : 'Check back soon - new stock is added regularly.'}
            action={
              query && (
                <button type="button" onClick={onClearSearch} className={`${theme.hero.ctaSecondaryLayout} ${theme.hero.cta}`}>
                  View all products
                </button>
              )
            }
          />
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
    </div>
  );
};

export default AllProductsPage;
