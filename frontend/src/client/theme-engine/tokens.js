/**
 * Per-vendor design tokens for the storefront.
 *
 * The storefront never hardcodes its accent colour: every `brand-*` Tailwind class
 * resolves to a CSS variable (`--sf-brand-N`) declared in `src/index.css`, whose
 * fallback is the original amber palette. Applying a vendor's tokens just sets those
 * variables (and a font / corner radius) on the document root, so a vendor with no
 * config - or a failed config request - renders exactly the default look.
 */

const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

// Share of the primary colour mixed with white (light steps) or black (dark steps).
// 500 is the primary colour itself.
const MIX = {
  50: ['white', 8], 100: ['white', 18], 200: ['white', 35], 300: ['white', 55], 400: ['white', 78],
  500: null,
  600: ['black', 12], 700: ['black', 28], 800: ['black', 42], 900: ['black', 56],
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// Curated list only (no arbitrary font URLs) - name -> Google Fonts family query.
export const FONT_OPTIONS = {
  Inter: 'Inter:wght@400;500;600;700',
  Poppins: 'Poppins:wght@400;500;600;700',
  'Playfair Display': 'Playfair+Display:wght@400;600;700',
  Montserrat: 'Montserrat:wght@400;500;600;700',
  Lora: 'Lora:wght@400;500;600;700',
};

export const DEFAULT_TOKENS = { primaryColor: null, fontFamily: null, radius: null };

/** Builds the --sf-brand-* map for a hex colour using CSS color-mix (no colour library needed). */
export const buildBrandScale = (hex) => {
  if (!HEX.test(hex || '')) return {};
  const vars = {};
  SCALE_STEPS.forEach((step) => {
    const mix = MIX[step];
    vars[`--sf-brand-${step}`] = mix ? `color-mix(in oklab, ${hex} ${100 - mix[1]}%, ${mix[0]})` : hex;
  });
  return vars;
};

const FONT_LINK_ID = 'sf-font-link';

/** Sets (or clears) the vendor's tokens on <html>. Safe to call repeatedly. */
export const applyTokens = (tokens = DEFAULT_TOKENS) => {
  const root = document.documentElement;
  const vars = {
    ...Object.fromEntries(SCALE_STEPS.map((s) => [`--sf-brand-${s}`, null])),
    ...buildBrandScale(tokens.primaryColor),
    '--sf-font': FONT_OPTIONS[tokens.fontFamily] ? `'${tokens.fontFamily}', sans-serif` : null,
    '--sf-radius': tokens.radius || null,
  };
  Object.entries(vars).forEach(([name, value]) => {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  });

  const existing = document.getElementById(FONT_LINK_ID);
  const query = FONT_OPTIONS[tokens.fontFamily];
  if (!query) {
    existing?.remove();
    return;
  }
  const href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  if (existing) {
    if (existing.href !== href) existing.href = href;
    return;
  }
  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
};
