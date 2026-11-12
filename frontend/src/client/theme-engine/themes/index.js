import ClassicFallbackHero from './classic/ClassicFallbackHero';
import ClassicFooter from '../../components/ui/footer/ClassicFooter';
import ClassicProductCard from '../../features/products/components/ClassicProductCard';
import MinimalFallbackHero from './minimal/MinimalFallbackHero';
import MinimalFooter from './minimal/MinimalFooter';
import MinimalProductCard from './minimal/MinimalProductCard';

/**
 * Theme registry: themeCode -> the component set that gives the storefront its layout.
 * Themes only change presentation; they all use the same hooks, APIs and cart/checkout
 * flow, so adding a theme never touches product or order logic.
 *
 * Slots: FallbackHero (shown when no banner is uploaded), Footer, ProductCard,
 * gridClass (product grid columns).
 */
export const THEMES = {
  classic: {
    label: 'Classic',
    description: 'Navy hero, shadowed cards, full multi-column footer.',
    FallbackHero: ClassicFallbackHero,
    Footer: ClassicFooter,
    ProductCard: ClassicProductCard,
    gridClass: 'grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6',
  },
  minimal: {
    label: 'Minimal',
    description: 'Clean white hero, borderless cards, slim footer.',
    FallbackHero: MinimalFallbackHero,
    Footer: MinimalFooter,
    ProductCard: MinimalProductCard,
    gridClass: 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6',
  },
};

export const getTheme = (code) => THEMES[code] || THEMES.classic;
