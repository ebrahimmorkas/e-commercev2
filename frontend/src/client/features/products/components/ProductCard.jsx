import { useState } from 'react';
import theme from '../../Home/theme/theme';
import QuantityStepper from './QuantityStepper';

const formatPrice = (product) => {
  if (product.priceRange) return `₹${product.priceRange.min} - ₹${product.priceRange.max}`;
  if (typeof product.price === 'number') return `₹${product.price}`;
  return 'Price on request';
};

/**
 * Best (cheapest per-unit) bulk tier, used as the card's headline deal.
 */
const bestBulkTier = (bulkPricing) =>
  bulkPricing.reduce((best, tier) => (!best || tier.price < best.price ? tier : best), null);

/**
 * Storefront product image, standardized to the same square footprint for
 * every card regardless of the source photo's own dimensions/aspect ratio -
 * the whole image is always shown (never cropped), letterboxed on the
 * card's background when it isn't already square.
 */
const ProductImage = ({ src, alt }) => {
  const [broken, setBroken] = useState(false);

  return (
    <div className={`aspect-square flex items-center justify-center overflow-hidden ${theme.card.imageBackground}`}>
      {src && !broken ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="w-full h-full object-contain"
        />
      ) : (
        <span className={`text-xs font-bold tracking-widest uppercase ${theme.card.imageText}`}>{alt}</span>
      )}
    </div>
  );
};

const BulkPricing = ({ bulkPricing }) => {
  if (!bulkPricing?.length) return null;
  const deal = bestBulkTier(bulkPricing);
  const moreTiers = bulkPricing.length - 1;

  return (
    <div className={`mt-2 rounded-lg px-2.5 py-1.5 ${theme.card.bulkBackground}`}>
      <p className={`text-[10px] font-bold tracking-wide uppercase ${theme.card.bulkLabel}`}>Bulk Pricing</p>
      <p className={`text-xs font-medium ${theme.card.bulkText}`}>
        Buy {deal.minimumQuantity}+ at ₹{deal.price}/unit
        {moreTiers > 0 && ` · ${moreTiers} more tier${moreTiers > 1 ? 's' : ''}`}
      </p>
    </div>
  );
};

/**
 * @param {Object} props
 * @param {Object} props.product
 * @param {number} [props.quantity] - Current quantity of this product's default size in the cart.
 * @param {Function} [props.onAddToCart]
 * @param {Function} [props.onIncrement]
 * @param {Function} [props.onDecrement]
 * @param {Function} [props.onOpen] - Called with the product when the card (outside the Add to Cart control) is clicked, to open its detail page.
 */
const ProductCard = ({ product, quantity = 0, onAddToCart, onIncrement, onDecrement, onOpen }) => (
  <div
    role={onOpen ? 'button' : undefined}
    tabIndex={onOpen ? 0 : undefined}
    onClick={() => onOpen?.(product)}
    onKeyDown={(e) => {
      if (onOpen && (e.key === 'Enter' || e.key === ' ')) onOpen(product);
    }}
    className={`rounded-xl border overflow-hidden transition-shadow duration-150 ${onOpen ? 'cursor-pointer' : ''} ${theme.card.background} ${theme.card.border} ${theme.card.shadow}`}
  >
    <ProductImage src={product.image} alt={product.name || product.category} />
    <div className="p-4">
      <p className={`text-[11px] font-semibold tracking-wide uppercase ${theme.card.category}`}>{product.category}</p>
      <h3 className={`mt-0.5 text-sm font-semibold ${theme.card.name}`}>{product.name}</h3>
      <p className={`mt-1 text-base font-bold ${theme.card.price}`}>
        {formatPrice(product)}
        {product.unit && <span className="text-xs font-normal text-slate-400"> / {product.unit}</span>}
      </p>
      <BulkPricing bulkPricing={product.bulkPricing} />
      <div className="mt-3">
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
  </div>
);

export default ProductCard;
