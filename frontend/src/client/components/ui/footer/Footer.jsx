import theme from './theme/theme';

/**
 * Bottom footer for the client-facing storefront.
 */
const Footer = () => (
  <footer className={`border-t ${theme.footer.background} ${theme.footer.border}`}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 text-center">
      <p className={`text-lg font-bold ${theme.brand.text}`}>HTM</p>
      <p className={`mt-1 text-sm ${theme.tagline.text}`}>Hutaib Tailoring Materials</p>
      <p className={`mt-6 pt-6 border-t text-xs ${theme.copyright.border} ${theme.copyright.text}`}>
        © {new Date().getFullYear()} Hutaib Tailoring Materials. All rights reserved.
      </p>
    </div>
  </footer>
);

export default Footer;
