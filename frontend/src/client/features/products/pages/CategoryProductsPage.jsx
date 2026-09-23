import theme from '../../Home/theme/theme';
import { useStorefrontProductsByCategory } from '../hooks/useStorefrontProductsByCategory';
import ProductListItem from '../components/ProductListItem';
import Spinner from '../../../../components/common/Spinner/Spinner';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';
import StatusErrorPage from '../../../components/errors/StatusErrorPage';

/**
 * Storefront product listing for one category (and its active
 * sub-categories - see backend/services/productService.js
 * fetchProductsByCategoryForClient). Reached via the Navbar's Shop mega-menu,
 * which opens this in a new tab at /category/:id rather than navigating the
 * current tab.
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
  const { products, categoryName, loading, error, statusCode, reload } = useStorefrontProductsByCategory(categoryId);

  if (!loading && error) {
    return <StatusErrorPage statusCode={statusCode} message={error} onRetry={reload} onGoHome={onGoHome} />;
  }

  return (
    <div className={theme.page.background}>
      <section className={theme.section.wrapper}>
        <div className={theme.section.headerWrapper}>
          <h1 className={`${theme.section.headingLayout} ${theme.section.heading}`}>
            {categoryName || 'Category'}
          </h1>
          <p className={`${theme.section.subheadingLayout} ${theme.section.subheading}`}>
            {loading ? 'Loading products...' : `${products.length} product${products.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {loading && (
          <div className={theme.section.loadingWrapper}>
            <Spinner size="lg" label="Loading products" />
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <EmptyState title="No products in this category" description="Check back soon - new stock is added regularly." />
        )}

        {!loading && !error && products.length > 0 && (
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
        )}
      </section>
    </div>
  );
};

export default CategoryProductsPage;
