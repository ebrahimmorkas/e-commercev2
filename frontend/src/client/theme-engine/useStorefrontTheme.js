import { useContext } from 'react';
import { StorefrontThemeContext } from './themeContext';
import { getTheme } from './themes';
import { DEFAULT_CONFIG } from './defaultConfig';

/** { config, theme } - theme is the component set (Footer, ProductCard, FallbackHero...) for the vendor's themeCode. */
export const useStorefrontTheme = () => {
  const ctx = useContext(StorefrontThemeContext);
  const config = ctx?.config || DEFAULT_CONFIG;
  return { config, theme: getTheme(config.themeCode) };
};

export default useStorefrontTheme;
