import ProductCard from './ProductCard';
import { useStorefrontTheme } from '../../../theme-engine/useStorefrontTheme';

/**
 * Grid of ProductCards wired to the cart (each card's stepper drives the
 * product's default size). Shared by the homepage and the all-products page.
 * Column layout comes from the active storefront theme.
 */
const ProductGrid = ({ products, cartItems = {}, onAddToCart, onProductClick, onIncrementItem, onDecrementItem, onSetItemQuantity }) => {
  const { theme } = useStorefrontTheme();
  return (
    <div className={theme.gridClass}>
      {products.map((product) => {
        const itemId = product.sizeId || product.id;
        return (
          <ProductCard
            key={product.id}
            product={product}
            quantity={cartItems[itemId] || 0}
            onAddToCart={onAddToCart}
            onOpen={onProductClick}
            onIncrement={() => onIncrementItem?.(itemId)}
            onDecrement={() => onDecrementItem?.(itemId)}
            onSetQuantity={(quantity) => onSetItemQuantity?.(itemId, quantity)}
          />
        );
      })}
    </div>
  );
};

export default ProductGrid;
