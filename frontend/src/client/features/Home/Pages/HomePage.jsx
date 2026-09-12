import theme from '../theme/theme';
import { GemIcon } from '../icons';
import { useStorefrontProducts } from '../../products/hooks/useStorefrontProducts';
import ProductCard from '../../products/components/ProductCard';
import Spinner from '../../../../components/common/Spinner/Spinner';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';

const PartnerBadge = () => (
  <div
    className={`${theme.partnerBadge.layout} ${theme.partnerBadge.background} ${theme.partnerBadge.border} ${theme.partnerBadge.text}`}
  >
    <GemIcon className={`${theme.partnerBadge.iconLayout} ${theme.partnerBadge.icon}`} />
    Preciosa&reg; Crystals Authorized Partner
  </div>
);

/**
 * Decorative, non-interactive gem shapes floating in 3D behind the hero copy.
 * Purely visual - aria-hidden, and inert under prefers-reduced-motion via CSS.
 */
const FloatingGems = () => (
  <div className={theme.floatingGems.wrapper} aria-hidden="true">
    {theme.floatingGems.items.map((className, index) => (
      <GemIcon key={index} className={className} />
    ))}
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
      <section className={`${theme.hero.section} ${theme.hero.background}`}>
        <FloatingGems />
        <div className={theme.hero.container}>
          <p className={`${theme.hero.eyebrowLayout} ${theme.hero.eyebrow}`}>Hutaib Tailoring Materials</p>
          <h1 className={`${theme.hero.headingLayout} ${theme.hero.heading}`}>
            Crystals, Pearls &amp; Beads for Every Creation
          </h1>
          <p className={`${theme.hero.subheadingLayout} ${theme.hero.subheading}`}>
            Genuine Preciosa crystals, rhinestones, buttons, pearls and pressed glass beads —
            sourced with care, delivered with pride.
          </p>
          <button type="button" className={`${theme.hero.ctaLayout} ${theme.hero.cta}`}>
            <span className={theme.hero.ctaShine} />
            <span className={theme.hero.ctaLabel}>Shop Now</span>
          </button>
          <div className={theme.hero.ctaWrapper}>
            <PartnerBadge />
          </div>
        </div>
      </section>

      <section className={theme.section.wrapper}>
        <div className={theme.section.headerWrapper}>
          <h2 className={`${theme.section.headingLayout} ${theme.section.heading}`}>Featured Products</h2>
          <p className={`${theme.section.subheadingLayout} ${theme.section.subheading}`}>
            A few of our customer favorites
          </p>
        </div>
        {loading && (
          <div className={theme.section.loadingWrapper}>
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
                className={`${theme.hero.ctaSecondaryLayout} ${theme.hero.cta}`}
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
          <div className={theme.section.grid}>
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
