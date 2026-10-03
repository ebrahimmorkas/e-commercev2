import theme from '../../Home/theme/theme';
import ProductCard from './ProductCard';

/**
 * Grid of ProductCards wired to the cart (each card's stepper drives the
 * product's default size). Shared by the homepage and the all-products page.
 */
const ProductGrid = ({ products, cartItems = {}, onAddToCart, onProductClick, onIncrementItem, onDecrementItem, onSetItemQuantity }) => (
  <div className={theme.section.grid}>
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

export default ProductGrid;
