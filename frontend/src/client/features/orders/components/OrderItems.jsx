import { useState } from 'react';
import { formatOrderMoney } from '../utils/formatOrder';
import { StarRating } from '../../reviews/components/StarRating';

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

/**
 * Product/size thumbnail resolved live against the current Product doc
 * (order.items itself only freezes name/price/tax, never the image - see
 * backend/models/Order.js) - falls back to the product name on a missing
 * or broken image, same pattern as ProductCard.jsx's ProductImage.
 */
const ItemThumb = ({ src, alt }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
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
        <span className="text-[10px] leading-tight text-slate-400 text-center px-1">{alt}</span>
      )}
    </div>
  );
};

const StatusPill = ({ label }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-amber-50 text-amber-700 border-amber-200">
    {label}
  </span>
);

// Review entry point for one delivered item: the customer's review (stars +
// Edit) or a "Rate & review" button. `reviewEntry` is null while reviews are
// off or the order isn't delivered - then nothing shows.
const ItemReviewAction = ({ item, reviewEntry, onWriteReview, onEditReview }) => {
  if (!reviewEntry) return null;
  if (reviewEntry.review) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StarRating value={reviewEntry.review.rating} size="xs" />
        <button
          type="button"
          onClick={() => onEditReview?.(item, reviewEntry.review)}
          className="text-xs font-semibold text-amber-700 hover:underline cursor-pointer"
        >
          Edit your review
        </button>
      </div>
    );
  }
  if (!reviewEntry.canWrite) return null;
  return (
    <button
      type="button"
      onClick={() => onWriteReview?.(item)}
      className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer"
    >
      ★ Rate &amp; review
    </button>
  );
};

const OrderItemRow = ({ item, order, reviewEntry, onWriteReview, onEditReview }) => (
  <li className="flex gap-3 py-3">
    <ItemThumb src={item.image?.url} alt={item.productName} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-slate-900 truncate">{item.productName}</p>
      <p className="text-xs text-slate-500 mt-0.5 truncate">
        {item.variantName} · {item.sizeName}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">SKU: {item.sku}</p>
      {(item.returnStatus || item.exchangeStatus) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {item.returnStatus && (
            <StatusPill label={`Return: ${RETURN_EXCHANGE_LABELS[item.returnStatus] || item.returnStatus}`} />
          )}
          {item.exchangeStatus && (
            <StatusPill label={`Exchange: ${RETURN_EXCHANGE_LABELS[item.exchangeStatus] || item.exchangeStatus}`} />
          )}
        </div>
      )}
      <ItemReviewAction item={item} reviewEntry={reviewEntry} onWriteReview={onWriteReview} onEditReview={onEditReview} />
    </div>
    <div className="text-right shrink-0">
      <p className="text-sm text-slate-700">
        {item.quantity} × {formatOrderMoney(order, item.unitPrice)}
      </p>
      <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatOrderMoney(order, item.lineAmount)}</p>
      {item.taxBreakdown?.length > 0 && (
        <div className="mt-1 text-[11px] text-slate-400 space-y-0.5">
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
 *
 * Optional review props: `reviewsByProductId` (productId -> { canWrite,
 * review } from GET /reviews/my-order/:id), `onWriteReview(item)`,
 * `onEditReview(item, review)`. The same product bought in two sizes on one
 * order gets one review, so only its first row carries the action.
 */
const OrderItems = ({ order, reviewsByProductId = null, onWriteReview, onEditReview }) => {
  const items = order?.items || [];
  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-1">Items ({items.length})</h2>
      <ul className="divide-y divide-slate-100">
        {items.map((item, index) => {
          const isFirstRowOfProduct = items.findIndex((other) => other.productId === item.productId) === index;
          return (
            <OrderItemRow
              key={`${item.productId}-${item.variantId}-${item.sizeId}`}
              item={item}
              order={order}
              reviewEntry={isFirstRowOfProduct ? reviewsByProductId?.[item.productId] || null : null}
              onWriteReview={onWriteReview}
              onEditReview={onEditReview}
            />
          );
        })}
      </ul>
    </div>
  );
};

export default OrderItems;
