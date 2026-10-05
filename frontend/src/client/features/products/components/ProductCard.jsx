import { useState } from 'react';
import theme from '../../Home/theme/theme';
import { useTilt3D } from '../../../components/hooks/useTilt3D';
import QuantityStepper from './QuantityStepper';
import { useCurrency } from '../../../currency/useCurrency';
import { resolveBulkPrice } from '../utils/bulkTier';

// Prices arrive in the store currency; formatMoney converts to the shopper's.
const formatPrice = (product, formatMoney) => {
  if (product.priceRange) return `${formatMoney(product.priceRange.min)} - ${formatMoney(product.priceRange.max)}`;
  if (typeof product.price === 'number') return formatMoney(product.price);
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
    <div className={`${theme.card.imageWrapperLayout} ${theme.card.imageBackground}`}>
      {src && !broken ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className={theme.card.imageLayout}
        />
      ) : (
        <span className={`${theme.card.imageTextLayout} ${theme.card.imageText}`}>{alt}</span>
      )}
    </div>
  );
};

const BulkPricing = ({ bulkPricing, isApplied }) => {
  const { formatMoney } = useCurrency();
  if (!bulkPricing?.length) return null;
  const deal = bestBulkTier(bulkPricing);
  const moreTiers = bulkPricing.length - 1;

  return (
    <div className={`${theme.card.bulkWrapperLayout} ${theme.card.bulkBackground}`}>
      <p className={`${theme.card.bulkLabelLayout} ${theme.card.bulkLabel}`}>
        Bulk Pricing{isApplied && <span className="text-emerald-600"> · applied</span>}
      </p>
      <p className={`${theme.card.bulkTextLayout} ${theme.card.bulkText}`}>
        Buy {deal.minimumQuantity}+ at {formatMoney(deal.price)}/unit
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
 * @param {(quantity: number) => void} [props.onSetQuantity] - A quantity typed into the stepper.
 * @param {Function} [props.onOpen] - Called with the product when the card (outside the Add to Cart control) is clicked, to open its detail page.
 */
const ProductCard = ({ product, quantity = 0, onAddToCart, onIncrement, onDecrement, onSetQuantity, onOpen }) => {
  const { ref, onMouseMove, onMouseLeave } = useTilt3D({ max: 6, scale: 1.02 });
  const { formatMoney } = useCurrency();
  // The stepper's quantity is of the default size, whose price is product.price -
  // so the tier it has reached prices that size live, same as the cart will.
  const bulk = resolveBulkPrice(product.bulkPricing, quantity, product.price);

  return (
    <div
      ref={ref}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(product)}
      onKeyDown={(e) => {
        if (onOpen && (e.key === 'Enter' || e.key === ' ')) onOpen(product);
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`${theme.card.layout} ${onOpen ? theme.card.clickable : ''} ${theme.card.background} ${theme.card.border} ${theme.card.shadow}`}
    >
      <ProductImage src={product.image} alt={product.name || product.category} />
      <div className={theme.card.body}>
        <p className={`${theme.card.categoryLayout} ${theme.card.category}`}>{product.category}</p>
        <h3 className={`${theme.card.nameLayout} ${theme.card.name}`}>{product.name}</h3>
        <p className={`${theme.card.priceLayout} ${theme.card.price}`}>
          {bulk.isApplied ? formatMoney(bulk.unitPrice) : formatPrice(product, formatMoney)}
          {product.unit && <span className={theme.card.unit}> / {product.unit}</span>}
          {bulk.isApplied && <span className="ml-1.5 text-sm font-normal text-slate-400 line-through">{formatMoney(product.price)}</span>}
        </p>
        <BulkPricing bulkPricing={product.bulkPricing} isApplied={bulk.isApplied} />
        <div className={theme.card.actionsWrapper}>
          <QuantityStepper
            quantity={quantity}
            inStock={product.inStock}
            maxQuantity={product.stock}
            onAdd={() => onAddToCart?.(product)}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            onSetQuantity={onSetQuantity}
          />
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
