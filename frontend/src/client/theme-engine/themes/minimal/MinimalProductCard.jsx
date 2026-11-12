import { useState } from 'react';
import QuantityStepper from '../../../features/products/components/QuantityStepper';
import { useCurrency } from '../../../currency/useCurrency';
import { resolveBulkPrice } from '../../../features/products/utils/bulkTier';

const formatPrice = (product, formatMoney) => {
  if (product.priceRange) return `${formatMoney(product.priceRange.min)} - ${formatMoney(product.priceRange.max)}`;
  if (typeof product.price === 'number') return formatMoney(product.price);
  return 'Price on request';
};

/** Minimal theme card: borderless, flat, image on top, name and price underneath. Same props as the classic card. */
const MinimalProductCard = ({ product, quantity = 0, onAddToCart, onIncrement, onDecrement, onSetQuantity, onOpen }) => {
  const { formatMoney } = useCurrency();
  const [broken, setBroken] = useState(false);
  const bulk = resolveBulkPrice(product.bulkPricing, quantity, product.price);
  const alt = product.name || product.category;

  return (
    <div className="flex flex-col">
      <div
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={() => onOpen?.(product)}
        onKeyDown={(e) => {
          if (onOpen && (e.key === 'Enter' || e.key === ' ')) onOpen(product);
        }}
        className={onOpen ? 'cursor-pointer' : ''}
      >
        <div className="flex aspect-square items-center justify-center overflow-hidden bg-slate-50">
          {product.image && !broken ? (
            <img src={product.image} alt={alt} loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-full w-full object-contain" />
          ) : (
            <span className="px-3 text-center text-xs text-slate-400">{alt}</span>
          )}
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm font-medium text-slate-900">{product.name}</h3>
        <p className="mt-1 text-sm text-slate-600">
          {bulk.isApplied ? formatMoney(bulk.unitPrice) : formatPrice(product, formatMoney)}
          {product.unit && <span className="text-slate-400"> / {product.unit}</span>}
        </p>
      </div>
      <div className="mt-3">
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
  );
};

export default MinimalProductCard;
