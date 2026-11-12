import { useStorefrontBanner } from '../../banners/hooks/useStorefrontBanner';
import { useStorefrontCompanySettings } from '../../companySettings/hooks/useStorefrontCompanySettings';
import { useStorefrontTheme } from '../../../theme-engine/useStorefrontTheme';

/**
 * Home hero. The vendor's banner (video or image) is shown the same way in every theme;
 * with no banner - none uploaded, or the request failed - the active theme's own
 * FallbackHero renders, so shoppers never see an empty or broken banner.
 */
const HeroSection = () => {
  const { banner, loading, isRotating, next } = useStorefrontBanner();
  const { companySettings } = useStorefrontCompanySettings();
  const { theme } = useStorefrontTheme();
  const companyName = (companySettings?.companyName || '').trim();

  const scrollToProducts = () => document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' });

  if (loading) {
    // Hold a blank placeholder the same size as the eventual hero until we know what to
    // show - otherwise the fallback (or the wrong banner) paints for a frame first.
    return <section className="relative w-full aspect-video sm:aspect-auto sm:h-screen overflow-hidden bg-slate-900" />;
  }

  if (banner?.video) {
    // Below sm, size the section by the video's own aspect ratio so the whole frame stays
    // visible; from sm up, cover the full-bleed hero area.
    return (
      <section className="relative w-full sm:h-screen overflow-hidden sm:bg-slate-900">
        <video
          key={banner._id || banner.video}
          className="block w-full h-auto sm:absolute sm:inset-0 sm:h-full sm:object-cover"
          src={banner.video}
          autoPlay
          muted
          loop={!isRotating}
          onEnded={isRotating ? next : undefined}
          playsInline
        />
      </section>
    );
  }

  if (banner?.image) {
    return (
      <section className="relative w-full sm:h-screen overflow-hidden sm:bg-slate-900">
        <img
          key={banner._id || banner.image}
          className="block w-full h-auto sm:absolute sm:inset-0 sm:h-full sm:object-cover"
          src={banner.image}
          alt={banner.name || 'Banner'}
        />
      </section>
    );
  }

  const FallbackHero = theme.FallbackHero;
  return <FallbackHero companyName={companyName} onShopNow={scrollToProducts} />;
};

export default HeroSection;
