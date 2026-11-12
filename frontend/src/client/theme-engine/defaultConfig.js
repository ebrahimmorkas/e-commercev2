// Mirrors backend/constants/storefrontConstants.js defaultConfig(). Used until the
// vendor's config arrives and whenever the request fails, so the storefront always
// renders the original look rather than an error.
export const SECTION_TYPES = ['hero', 'categories', 'certificate', 'allProducts'];

export const DEFAULT_CONFIG = {
  themeCode: 'classic',
  primaryColor: null,
  fontFamily: null,
  sections: [
    { type: 'hero', enabled: true },
    { type: 'categories', enabled: false },
    { type: 'certificate', enabled: true },
    { type: 'allProducts', enabled: true },
  ],
};
