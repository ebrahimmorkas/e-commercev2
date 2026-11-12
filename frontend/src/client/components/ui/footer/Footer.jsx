import { useStorefrontTheme } from '../../../theme-engine/useStorefrontTheme';

/** Footer for the active storefront theme (see theme-engine/themes). */
const Footer = (props) => {
  const { theme } = useStorefrontTheme();
  const ThemeFooter = theme.Footer;
  return <ThemeFooter {...props} />;
};

export default Footer;
