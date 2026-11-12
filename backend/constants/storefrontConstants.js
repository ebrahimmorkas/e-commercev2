// Single source of truth for what a vendor can pick in Storefront Customization.
// Themes and section types are CODE (components live in the frontend), so they are
// constants here - not a DB table that could drift out of sync with the code.

const THEME_CODES = ['classic', 'minimal'];
const DEFAULT_THEME_CODE = 'classic';

// Curated list only - mirrors FONT_OPTIONS in frontend/src/client/theme-engine/tokens.js.
const FONT_FAMILIES = ['Inter', 'Poppins', 'Playfair Display', 'Montserrat', 'Lora'];

// Order here is the default home-page order. `enabled` is the default for a vendor
// who has never customised anything - it reproduces the original home page exactly.
const SECTION_DEFAULTS = [
    { type: 'hero', enabled: true },
    { type: 'categories', enabled: false },
    { type: 'certificate', enabled: true },
    { type: 'allProducts', enabled: true },
];
const SECTION_TYPES = SECTION_DEFAULTS.map((s) => s.type);

const defaultConfig = () => ({
    themeCode: DEFAULT_THEME_CODE,
    primaryColor: null,
    fontFamily: null,
    sections: SECTION_DEFAULTS.map((s) => ({ ...s })),
});

module.exports = { THEME_CODES, DEFAULT_THEME_CODE, FONT_FAMILIES, SECTION_DEFAULTS, SECTION_TYPES, defaultConfig };
