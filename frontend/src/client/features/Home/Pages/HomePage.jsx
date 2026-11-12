import theme from '../theme/theme';
import { useStorefrontTheme } from '../../../theme-engine/useStorefrontTheme';
import HeroSection from '../sections/HeroSection';
import CategoriesSection from '../sections/CategoriesSection';
import AllProductsSection from '../sections/AllProductsSection';
import CertificateSection from '../components/CertificateSection';

// Section registry: the `type` stored in the vendor's storefront config -> component.
// The vendor chooses which sections show and in what order (see StorefrontSettings);
// a type missing from here is skipped rather than breaking the page.
const SECTIONS = {
  hero: HeroSection,
  categories: CategoriesSection,
  certificate: CertificateSection,
  allProducts: AllProductsSection,
};

/**
 * Client-facing storefront landing page, assembled from the vendor's ordered list of
 * home sections.
 *
 * @param {Object} props
 * @param {Function} [props.onAddToCart] - Called with the selected product when "Add to Cart" is clicked.
 * @param {Function} [props.onProductClick] - Called with the selected product when its card is opened.
 * @param {Object} [props.cartItems] - Map of cart-item id -> quantity, keyed by each product's default size id.
 * @param {Function} [props.onIncrementItem] - Called with a cart-item id to increase its quantity.
 * @param {Function} [props.onDecrementItem] - Called with a cart-item id to decrease (or remove) its quantity.
 * @param {Function} [props.onSetItemQuantity] - Called with a cart-item id and a typed quantity.
 */
const HomePage = (props) => {
  const { config } = useStorefrontTheme();

  return (
    <div className={theme.page.background}>
      {config.sections
        .filter((section) => section.enabled && SECTIONS[section.type])
        .map((section) => {
          const Section = SECTIONS[section.type];
          return <Section key={section.type} {...props} />;
        })}
    </div>
  );
};

export default HomePage;
