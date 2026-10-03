import theme from '../theme/theme';
import { GemIcon } from '../icons';
import { useCallback, useState } from 'react';
import { getStorefrontProducts } from '../../products/api/productApi';
import { usePagedProducts } from '../../products/hooks/usePagedProducts';
import { DEFAULT_SORT } from '../../products/constants/sortOptions';
import SortSelect from '../../products/components/SortSelect';
import InfiniteProductGrid from '../../products/components/InfiniteProductGrid';
import { useStorefrontBanner } from '../../banners/hooks/useStorefrontBanner';
import { ProductGridSkeleton } from '../../products/components/ProductSkeletons';
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
 * Client-facing storefront landing page: hero banner + every product in one infinite-scroll grid.
 *
 * @param {Object} props
 * @param {Function} [props.onAddToCart] - Called with the selected product when "Add to Cart" is clicked.
 * @param {Function} [props.onProductClick] - Called with the selected product when its card is opened.
 * @param {Object} [props.cartItems] - Map of cart-item id -> quantity, keyed by each product's default size id.
 * @param {Function} [props.onIncrementItem] - Called with a cart-item id to increase its quantity.
 * @param {Function} [props.onDecrementItem] - Called with a cart-item id to decrease (or remove) its quantity.
 * @param {Function} [props.onSetItemQuantity] - Called with a cart-item id and a typed quantity.
 *  */
const HomePage = ({ onAddToCart, onProductClick, cartItems = {}, onIncrementItem, onDecrementItem, onSetItemQuantity }) => {
  const [sort, setSort] = useState(DEFAULT_SORT);
  const fetchPage = useCallback((page) => getStorefrontProducts({ page, sort }), [sort]);
  // One page at a time as the user scrolls (see InfiniteProductGrid) - never the whole catalogue at once.
  const { products, total, hasMore, loading, loadingMore, error, loadMoreError, loadMore, reload } = usePagedProducts({
    fetchPage,
    resetKey: `home|${sort}`,
  });

  const scrollToProducts = () => document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' });
  const { banner, loading: bannerLoading } = useStorefrontBanner();

  return (
    <div className={theme.page.background}>
      {bannerLoading ? (
        // Hold a blank placeholder the same size as the eventual hero until
        // we know what to show - otherwise the static fallback hero (or the
        // wrong banner) paints for a frame first and gets swapped out once
        // the fetch resolves, flashing on every load.
        <section className="relative w-full aspect-video sm:aspect-auto sm:h-screen overflow-hidden bg-slate-900" />
      ) : banner?.video ? (
        // Full-bleed h-screen + object-cover works on wide screens, but forces
        // a landscape video into a tall narrow box on mobile - object-cover
        // then crops away most of the width to fill that height. Below sm,
        // size the section by the video's own aspect ratio instead and use
        // object-contain so the whole frame stays visible (letterboxed by the
        // section background rather than cropped).
        <section className="relative w-full aspect-video sm:aspect-auto sm:h-screen overflow-hidden bg-slate-900">
          <video
            className="absolute inset-0 h-full w-full object-contain sm:object-cover"
            src={banner.video}
            autoPlay
            muted
            loop
            playsInline
          />
        </section>
      ) : banner?.image ? (
        <section className="relative w-full aspect-video sm:aspect-auto sm:h-screen overflow-hidden bg-slate-900">
          <img
            className="absolute inset-0 h-full w-full object-contain sm:object-cover"
            src={banner.image}
            alt={banner.name || 'Banner'}
          />
        </section>
      ) : (
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
            <button type="button" onClick={scrollToProducts} className={`${theme.hero.ctaLayout} ${theme.hero.cta}`}>
              <span className={theme.hero.ctaShine} />
              <span className={theme.hero.ctaLabel}>Shop Now</span>
            </button>
            <div className={theme.hero.ctaWrapper}>
              <PartnerBadge />
            </div>
          </div>
        </section>
      )}

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

export default HomePage;
