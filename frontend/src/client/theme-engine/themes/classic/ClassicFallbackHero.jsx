import theme from '../../../features/Home/theme/theme';
import { GemIcon } from '../../../features/Home/icons';

/**
 * Classic theme's hero when the vendor has no banner (or it failed to load): navy
 * background, floating gems and the company name tilting in 3D.
 */
const ClassicFallbackHero = ({ companyName, onShopNow }) => (
  <section className={`${theme.hero.section} ${theme.hero.background} sm:py-32`}>
    <div className={theme.floatingGems.wrapper} aria-hidden="true">
      {theme.floatingGems.items.map((className, index) => (
        <GemIcon key={index} className={className} />
      ))}
    </div>
    <div className={theme.hero.container}>
      <h1 className="animate-sway3d [transform-style:preserve-3d] text-4xl sm:text-6xl font-extrabold tracking-tight text-white drop-shadow-[0_6px_0_rgba(180,120,10,0.55)] drop-shadow-[0_14px_24px_rgba(0,0,0,0.5)]">
        {companyName || 'Welcome to our store'}
      </h1>
      <button type="button" onClick={onShopNow} className={`${theme.hero.ctaLayout} ${theme.hero.cta}`}>
        <span className={theme.hero.ctaShine} />
        <span className={theme.hero.ctaLabel}>Shop Now</span>
      </button>
    </div>
  </section>
);

export default ClassicFallbackHero;
