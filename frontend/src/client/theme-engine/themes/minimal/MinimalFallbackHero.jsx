/** Minimal theme's hero when there is no banner: plain white, left-aligned name, thin accent rule. */
const MinimalFallbackHero = ({ companyName, onShopNow }) => (
  <section className="bg-white">
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-28">
      <div className="h-1 w-16 rounded-full bg-brand-500" />
      <h1 className="mt-6 max-w-3xl text-4xl font-light tracking-tight text-slate-900 sm:text-6xl">
        {companyName || 'Welcome to our store'}
      </h1>
      <button
        type="button"
        onClick={onShopNow}
        className="mt-8 cursor-pointer border border-slate-900 px-6 py-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-900 hover:text-white"
      >
        Shop now
      </button>
    </div>
  </section>
);

export default MinimalFallbackHero;
