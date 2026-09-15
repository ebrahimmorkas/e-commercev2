import { useState } from 'react';
import theme from '../../Home/theme/theme';
import QuantityStepper from './QuantityStepper';

const formatPrice = (product) => {
  if (product.priceRange) return `₹${product.priceRange.min} - ₹${product.priceRange.max}`;
  if (typeof product.price === 'number') return `₹${product.price}`;
  return 'Price on request';
};

/**
 * Best (cheapest per-unit) bulk tier, used as the row's headline deal.
 */
const bestBulkTier = (bulkPricing) =>
  bulkPricing.reduce((best, tier) => (!best || tier.price < best.price ? tier : best), null);

const ProductThumb = ({ src, alt }) => {
  const [broken, setBroken] = useState(false);

  return (
    <div className={`${theme.listCard.imageWrapperLayout} ${theme.card.imageBackground}`}>
      {src && !broken ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className={theme.listCard.imageLayout}
        />
      ) : (
        <span className={`${theme.card.imageTextLayout} ${theme.card.imageText}`}>{alt}</span>
      )}
    </div>
  );
};

const BulkPricing = ({ bulkPricing }) => {
  if (!bulkPricing?.length) return null;
  const deal = bestBulkTier(bulkPricing);
  const moreTiers = bulkPricing.length - 1;

  return (
    <div className={`${theme.card.bulkWrapperLayout} ${theme.card.bulkBackground}`}>
      <p className={`${theme.card.bulkLabelLayout} ${theme.card.bulkLabel}`}>Bulk Pricing</p>
      <p className={`${theme.card.bulkTextLayout} ${theme.card.bulkText}`}>
        Buy {deal.minimumQuantity}+ at ₹{deal.price}/unit
        {moreTiers > 0 && ` · ${moreTiers} more tier${moreTiers > 1 ? 's' : ''}`}
      </p>
    </div>
  );
};

/**
 * Horizontal row alternative to ProductCard - same product data/props, laid
 * out thumbnail-left / details-right for a list view instead of a grid.
 * Independent of ProductCard so grid pages (HomePage, ProductDetailPage's
 * recommendations) stay untouched.
 *
 * @param {Object} props
 * @param {Object} props.product
 * @param {number} [props.quantity] - Current quantity of this product's default size in the cart.
 * @param {Function} [props.onAddToCart]
 * @param {Function} [props.onIncrement]
 * @param {Function} [props.onDecrement]
 * @param {Function} [props.onOpen] - Called with the product when the row (outside the Add to Cart control) is clicked, to open its detail page.
 */
const ProductListItem = ({ product, quantity = 0, onAddToCart, onIncrement, onDecrement, onOpen }) => {
  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(product)}
      onKeyDown={(e) => {
        if (onOpen && (e.key === 'Enter' || e.key === ' ')) onOpen(product);
      }}
      className={`${theme.listCard.layout} ${onOpen ? theme.listCard.clickable : ''} ${theme.card.background} ${theme.card.border} ${theme.card.shadow}`}
    >
      <ProductThumb src={product.image} alt={product.name || product.category} />
      <div className={theme.listCard.bodyLayout}>
        <p className={`${theme.card.categoryLayout} ${theme.card.category}`}>{product.category}</p>
        <h3 className={`${theme.card.nameLayout} ${theme.card.name} truncate`}>{product.name}</h3>
        <p className={`${theme.card.priceLayout} ${theme.card.price}`}>
          {formatPrice(product)}
          {product.unit && <span className={theme.card.unit}> / {product.unit}</span>}
        </p>
        <BulkPricing bulkPricing={product.bulkPricing} />
      </div>
      <div className={theme.listCard.actionsWrapperLayout}>
        <QuantityStepper
          quantity={quantity}
          inStock={product.inStock}
          maxQuantity={product.stock}
          onAdd={() => onAddToCart?.(product)}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
        />
      </div>
    </div>
  );
};

export default ProductListItem;
