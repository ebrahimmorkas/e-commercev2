import { useStorefrontTheme } from '../../../theme-engine/useStorefrontTheme';

/**
 * Product card for the active storefront theme (see theme-engine/themes). Same props
 * for every theme: product, quantity, onAddToCart, onIncrement, onDecrement,
 * onSetQuantity, onOpen.
 */
const ProductCard = (props) => {
  const { theme } = useStorefrontTheme();
  const Card = theme.ProductCard;
  return <Card {...props} />;
};

export default ProductCard;
