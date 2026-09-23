import { useState } from 'react';
import Badge from '../../../../components/common/Badge';
import { formatOrderMoney } from '../utils/formatOrder';

const RETURN_EXCHANGE_LABELS = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PICKED_UP: 'Picked up',
  REFUNDED: 'Refunded',
  REPLACEMENT_SHIPPED: 'Replacement shipped',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const RETURN_EXCHANGE_BADGE_VARIANTS = {
  REQUESTED: 'yellow',
  APPROVED: 'blue',
  REJECTED: 'red',
  PICKED_UP: 'purple',
  REFUNDED: 'green',
  REPLACEMENT_SHIPPED: 'purple',
  COMPLETED: 'green',
  CANCELLED: 'gray',
};

/**
 * Product/size thumbnail resolved live against the current Product doc
 * (order.items itself only freezes name/price/tax, never the image - see
 * backend/models/Order.js) - falls back to the product name on a missing
 * or broken image.
 */
const ItemThumb = ({ src, alt }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className="w-14 h-14 shrink-0 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
      {src && !broken ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[10px] leading-tight text-gray-400 text-center px-1">{alt}</span>
      )}
    </div>
  );
};

const OrderItemRow = ({ item, order }) => (
  <li className="flex gap-3 py-3">
    <ItemThumb src={item.image?.url} alt={item.productName} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        {item.variantName} · {item.sizeName}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">SKU: {item.sku}</p>
      {(item.returnStatus || item.exchangeStatus) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {item.returnStatus && (
            <Badge variant={RETURN_EXCHANGE_BADGE_VARIANTS[item.returnStatus] || 'gray'} size="sm">
              Return: {RETURN_EXCHANGE_LABELS[item.returnStatus] || item.returnStatus}
            </Badge>
          )}
          {item.exchangeStatus && (
            <Badge variant={RETURN_EXCHANGE_BADGE_VARIANTS[item.exchangeStatus] || 'gray'} size="sm">
              Exchange: {RETURN_EXCHANGE_LABELS[item.exchangeStatus] || item.exchangeStatus}
            </Badge>
          )}
        </div>
      )}
    </div>
    <div className="text-right shrink-0">
      <p className="text-sm text-gray-700">
        {item.quantity} × {formatOrderMoney(order, item.unitPrice)}
      </p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatOrderMoney(order, item.lineAmount)}</p>
      {item.taxBreakdown?.length > 0 && (
        <div className="mt-1 text-[11px] text-gray-400 space-y-0.5">
          {item.taxBreakdown.map((tax) => (
            <p key={tax.taxId || tax.taxName}>
              {tax.taxName}: {formatOrderMoney(order, tax.taxAmount)}
            </p>
          ))}
        </div>
      )}
    </div>
  </li>
);

/**
 * Renders Order.items (see backend/models/Order.js) - the products/
 * variants/sizes actually placed on this order, enriched server-side
 * (orderService.js's fetchOrderById) with a live image plus any return/
 * exchange status. Renders nothing for orders placed before this field
 * existed and whose linked cart is also gone (empty array from the
 * backend's legacy fallback).
 */
const OrderItems = ({ order }) => {
  const items = order?.items || [];
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">Items ({items.length})</h3>
      <ul className="divide-y divide-gray-100">
        {items.map((item) => (
          <OrderItemRow key={`${item.productId}-${item.variantId}-${item.sizeId}`} item={item} order={order} />
        ))}
      </ul>
    </div>
  );
};

export default OrderItems;
