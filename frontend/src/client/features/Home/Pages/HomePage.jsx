import theme from '../theme/theme';
import { GemIcon } from '../icons';
import { useStorefrontProducts } from '../../products/hooks/useStorefrontProducts';
import ProductCard from '../../products/components/ProductCard';
import Spinner from '../../../../components/common/Spinner/Spinner';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';

const PartnerBadge = () => (
  <div
    className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold tracking-wide uppercase ${theme.partnerBadge.background} ${theme.partnerBadge.border} ${theme.partnerBadge.text}`}
  >
    <GemIcon className={`w-4 h-4 shrink-0 ${theme.partnerBadge.icon}`} />
    Preciosa&reg; Crystals Authorized Partner
  </div>
);

/**
 * Client-facing storefront landing page: hero banner + featured products grid.
 *
 * @param {Object} props
 * @param {Function} [props.onAddToCart] - Called with the selected product when "Add to Cart" is clicked.
 * @param {Function} [props.onProductClick] - Called with the selected product when its card is opened.
 * @param {Object} [props.cartItems] - Map of cart-item id -> quantity, keyed by each product's default size id.
 * @param {Function} [props.onIncrementItem] - Called with a cart-item id to increase its quantity.
 * @param {Function} [props.onDecrementItem] - Called with a cart-item id to decrease (or remove) its quantity.
 */
const HomePage = ({ onAddToCart, onProductClick, cartItems = {}, onIncrementItem, onDecrementItem }) => {
  const { products, loading, error, reload } = useStorefrontProducts();

  return (
    <div className={theme.page.background}>
      <section className={`${theme.hero.background} px-4 sm:px-6 py-20`}>
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          <p className={`text-sm font-semibold tracking-wide uppercase ${theme.hero.eyebrow}`}>
            Hutaib Tailoring Materials
          </p>
          <h1 className={`mt-3 text-3xl sm:text-5xl font-bold ${theme.hero.heading}`}>
            Crystals, Pearls &amp; Beads for Every Creation
          </h1>
          <p className={`mt-4 max-w-xl text-base ${theme.hero.subheading}`}>
            Genuine Preciosa crystals, rhinestones, buttons, pearls and pressed glass beads —
            sourced with care, delivered with pride.
          </p>
          <button
            type="button"
            className={`mt-8 px-6 py-3 rounded-full text-sm font-semibold transition-colors duration-150 cursor-pointer ${theme.hero.cta}`}
          >
            Shop Now
          </button>
          <div className="mt-6">
            <PartnerBadge />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="text-center mb-10">
          <h2 className={`text-2xl font-bold ${theme.section.heading}`}>Featured Products</h2>
          <p className={`mt-2 text-sm ${theme.section.subheading}`}>A few of our customer favorites</p>
        </div>
        {loading && (
          <div className="flex justify-center py-16">
            <Spinner size="lg" label="Loading products" />
          </div>
        )}

        {!loading && error && (
          <EmptyState
            title="Couldn't load products"
            description={error}
            action={
              <button
                type="button"
                onClick={reload}
                className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${theme.hero.cta}`}
              >
                Try Again
              </button>
            }
          />
        )}

        {!loading && !error && products.length === 0 && (
          <EmptyState title="No products yet" description="Check back soon - new stock is added regularly." />
        )}

        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
            {products.map((product) => {
              const itemId = product.sizeId || product.id;
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={cartItems[itemId] || 0}
                  onAddToCart={onAddToCart}
                  onOpen={onProductClick}
                  onIncrement={() => onIncrementItem?.(itemId)}
                  onDecrement={() => onDecrementItem?.(itemId)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;
