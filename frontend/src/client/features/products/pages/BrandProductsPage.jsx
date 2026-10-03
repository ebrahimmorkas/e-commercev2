import { useState } from 'react';
import theme from '../../Home/theme/theme';
import { useStorefrontProductsByBrand } from '../hooks/useStorefrontProductsByBrand';
import { DEFAULT_SORT } from '../constants/sortOptions';
import InfiniteProductGrid from '../components/InfiniteProductGrid';
import { ProductGridSkeleton } from '../components/ProductSkeletons';
import SortSelect from '../components/SortSelect';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';
import StatusErrorPage from '../../../components/errors/StatusErrorPage';

/**
 * Storefront product listing for one brand (/brand/:id), opened from the
 * Navbar's Brands panel. Same infinite-scroll grid as the landing page.
 */
const BrandProductsPage = ({
  brandId,
  cartItems = {},
  onAddToCart,
  onProductClick,
  onIncrementItem,
  onDecrementItem,
  onSetItemQuantity,
  onGoHome,
}) => {
  const [sort, setSort] = useState(DEFAULT_SORT);
  const { products, total, hasMore, brandName, loading, loadingMore, error, statusCode, loadMoreError, loadMore, reload } =
    useStorefrontProductsByBrand(brandId, sort);

  if (!loading && error) {
    return <StatusErrorPage statusCode={statusCode} message={error} onRetry={reload} onGoHome={onGoHome} />;
  }

  return (
    <div className={theme.page.background}>
      <section className={theme.section.wrapper}>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className={`${theme.section.headingLayout} ${theme.section.heading}`}>
              {brandName || (loading ? 'Loading...' : 'Brand')}
            </h1>
            <p className={`${theme.section.subheadingLayout} ${theme.section.subheading}`} aria-live="polite">
              {loading ? 'Loading products...' : `${total.toLocaleString('en-IN')} product${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <SortSelect value={sort} onChange={setSort} disabled={loading} />
        </div>

        {loading && <ProductGridSkeleton count={9} />}

        {!loading && products.length === 0 && (
          <EmptyState title="No products for this brand" description="Check back soon - new stock is added regularly." />
        )}

        {!loading && products.length > 0 && (
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

export default BrandProductsPage;
