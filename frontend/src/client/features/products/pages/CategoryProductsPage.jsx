import { useState } from 'react';
import theme from '../../Home/theme/theme';
import { useStorefrontProductsByCategory } from '../hooks/useStorefrontProductsByCategory';
import ProductListItem from '../components/ProductListItem';
import { ProductListSkeleton } from '../components/ProductSkeletons';
import LoadMoreFooter from '../components/LoadMoreFooter';
import SortSelect from '../components/SortSelect';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';
import StatusErrorPage from '../../../components/errors/StatusErrorPage';

/**
 * Storefront product listing for one category (and its active
 * sub-categories - see backend/services/productService.js
 * fetchProductsByCategoryForClient). Reached via the Navbar's Shop mega-menu,
 * which opens this in a new tab at /category/:id rather than navigating the
 * current tab. Loads a page at a time with a "Load more" button, so a big
 * category never blocks the page or the footer.
 */
const CategoryProductsPage = ({
  categoryId,
  onProductClick,
  cartItems = {},
  onAddToCart,
  onIncrementItem,
  onDecrementItem,
  onSetItemQuantity,
  onGoHome,
}) => {
  const [sort, setSort] = useState('featured');
  const { products, total, hasMore, categoryName, loading, loadingMore, error, statusCode, loadMoreError, loadMore, reload } =
    useStorefrontProductsByCategory(categoryId, sort);

  if (!loading && error) {
    return <StatusErrorPage statusCode={statusCode} message={error} onRetry={reload} onGoHome={onGoHome} />;
  }

  return (
    <div className={theme.page.background}>
      <section className={theme.section.wrapper}>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className={`${theme.section.headingLayout} ${theme.section.heading}`}>
              {categoryName || (loading ? 'Loading...' : 'Category')}
            </h1>
            <p className={`${theme.section.subheadingLayout} ${theme.section.subheading}`} aria-live="polite">
              {loading ? 'Loading products...' : `${total.toLocaleString('en-IN')} product${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <SortSelect value={sort} onChange={setSort} disabled={loading} />
        </div>

        {loading && <ProductListSkeleton count={6} />}

        {!loading && !error && products.length === 0 && (
          <EmptyState title="No products in this category" description="Check back soon - new stock is added regularly." />
        )}

        {!loading && !error && products.length > 0 && (
          <>
            <div className="flex flex-col gap-3 sm:gap-4">
              {products.map((product) => {
                const itemId = product.sizeId || product.id;
                return (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    quantity={cartItems[itemId] || 0}
                    onAddToCart={onAddToCart}
                    onOpen={onProductClick}
                    onIncrement={() => onIncrementItem?.(itemId)}
                    onDecrement={() => onDecrementItem?.(itemId)}
                    onSetQuantity={(quantity) => onSetItemQuantity?.(itemId, quantity)}
                  />
                );
              })}
            </div>
            {loadingMore && (
              <div className="mt-3 sm:mt-4">
                <ProductListSkeleton count={3} label="Loading more products" />
              </div>
            )}
            <LoadMoreFooter
              shown={products.length}
              total={total}
              hasMore={hasMore}
              loadingMore={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
            />
          </>
        )}
      </section>
    </div>
  );
};

export default CategoryProductsPage;
