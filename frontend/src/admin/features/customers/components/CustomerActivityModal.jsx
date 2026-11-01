import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../../components/common/Modal';
import Table from '../../../../components/common/tables';
import Badge from '../../../../components/common/Badge';
import Spinner from '../../../../components/common/Spinner';
import EmptyState from '../../../../components/common/EmptyState';
import { getCustomerOrders, getCustomerReviews } from '../api/customerApi';
import { formatOrderMoney, stepBadgeVariant } from '../../orders/utils/formatOrder';
import { formatDateTime } from '../utils/customerListFilters';
import theme from '../theme/theme';

const MODERATION_BADGES = {
  APPROVED: { variant: 'green', label: 'Approved' },
  PENDING: { variant: 'yellow', label: 'Pending' },
  REJECTED: { variant: 'red', label: 'Rejected' },
};

const PAYMENT_BADGES = {
  PAID: 'green',
  AUTHORIZED: 'blue',
  PENDING: 'yellow',
  FAILED: 'red',
  PARTIALLY_REFUNDED: 'gray',
  REFUNDED: 'gray',
};

const Stars = ({ rating }) => (
  <span className="whitespace-nowrap text-amber-500" aria-label={`${rating} out of 5 stars`}>
    {'★'.repeat(rating)}
    <span className="text-gray-300">{'★'.repeat(Math.max(0, 5 - rating))}</span>
  </span>
);

const humanize = (value) => (value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '');

const ORDER_COLUMNS = [
  {
    key: 'orderNumber',
    label: 'Order',
    render: (row) => (
      <div className="min-w-0">
        <p className={`font-medium whitespace-nowrap ${theme.text.heading}`}>{row.orderNumber || '—'}</p>
        {row.isPlacedByAdmin && <p className={`text-xs ${theme.text.muted}`}>Placed by admin</p>}
      </div>
    ),
  },
  {
    key: 'orderPlacedAt',
    label: 'Placed on',
    render: (row) => <span className={`whitespace-nowrap text-sm ${theme.text.body}`}>{formatDateTime(row.orderPlacedAt || row.createdAt) || '—'}</span>,
  },
  {
    key: 'currentStepName',
    label: 'Status',
    render: (row) => (
      <Badge variant={stepBadgeVariant(row.currentStepCode)} size="sm">
        {row.currentStepName || humanize(row.currentStepCode) || '—'}
      </Badge>
    ),
  },
  {
    key: 'payment',
    label: 'Payment',
    render: (row) => (
      <div className="flex flex-col items-start gap-0.5">
        <Badge variant={PAYMENT_BADGES[row.payment?.status] || 'gray'} size="sm">
          {humanize(row.payment?.status) || 'Pending'}
        </Badge>
        {row.payment?.method && <span className={`text-xs ${theme.text.muted}`}>{row.payment.method === 'COD' ? 'Cash on delivery' : 'Online'}</span>}
      </div>
    ),
  },
  {
    key: 'grandTotal',
    label: 'Total',
    align: 'right',
    render: (row) => <span className={`whitespace-nowrap tabular-nums font-medium ${theme.text.heading}`}>{formatOrderMoney(row, row.grandTotal || 0)}</span>,
  },
];

const REVIEW_COLUMNS = [
  {
    key: 'productName',
    label: 'Product',
    render: (row) => (
      <div className="min-w-0 max-w-48">
        <p className={`font-medium truncate ${theme.text.heading}`}>{row.productName || 'Deleted product'}</p>
        {(row.variantName || row.sizeName) && (
          <p className={`text-xs truncate ${theme.text.muted}`}>{[row.variantName, row.sizeName].filter(Boolean).join(' / ')}</p>
        )}
        {row.orderNumber && <p className={`text-xs truncate ${theme.text.muted}`}>Order {row.orderNumber}</p>}
      </div>
    ),
  },
  { key: 'rating', label: 'Rating', render: (row) => <Stars rating={row.rating} /> },
  {
    key: 'comment',
    label: 'Review',
    render: (row) => (
      <div className="min-w-0 max-w-72">
        {row.title && <p className={`text-sm font-medium ${theme.text.heading}`}>{row.title}</p>}
        <p className={`text-sm line-clamp-3 ${theme.text.body}`}>{row.comment || <span className={theme.text.muted}>No written review</span>}</p>
      </div>
    ),
  },
  {
    key: 'moderationStatus',
    label: 'Status',
    render: (row) => {
      const badge = MODERATION_BADGES[row.moderationStatus] || { variant: 'gray', label: humanize(row.moderationStatus) };
      return (
        <div className="flex flex-col items-start gap-1">
          <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
          {row.status === 'I' && <Badge variant="gray" size="sm">Hidden</Badge>}
        </div>
      );
    },
  },
  {
    key: 'createdAt',
    label: 'Written on',
    render: (row) => <span className={`whitespace-nowrap text-sm ${theme.text.body}`}>{formatDateTime(row.createdAt)}</span>,
  },
];

/**
 * A customer's orders or reviews - opened by clicking the Orders / Reviews
 * count on the Customers page. Lists exactly what that count counts.
 *
 * @param {Object} props
 * @param {{ customer: { _id, name }, type: 'orders'|'reviews' } | null} props.target - null = closed
 * @param {Function} props.onClose
 */
const CustomerActivityModal = ({ target, onClose }) => {
  const [state, setState] = useState({ key: null, rows: [], error: '' });
  const requestKey = target ? `${target.type}:${target.customer._id}` : null;

  useEffect(() => {
    if (!target) return undefined;
    let cancelled = false;
    const request = target.type === 'orders' ? getCustomerOrders(target.customer._id) : getCustomerReviews(target.customer._id);
    request
      .then((data) => {
        if (cancelled) return;
        const rows = target.type === 'orders' ? data?.orders : data?.reviews;
        setState({ key: requestKey, rows: Array.isArray(rows) ? rows : [], error: '' });
      })
      .catch((err) => {
        if (!cancelled) setState({ key: requestKey, rows: [], error: err.message || `Failed to load ${target.type}` });
      });
    return () => {
      cancelled = true;
    };
    // requestKey identifies the target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const loading = !!target && state.key !== requestKey;
  const isOrders = target?.type === 'orders';
  const columns = useMemo(() => (isOrders ? ORDER_COLUMNS : REVIEW_COLUMNS), [isOrders]);
  const title = target ? `${isOrders ? 'Orders' : 'Reviews'} by ${target.customer.name}` : '';

  return (
    <Modal isOpen={!!target} onClose={onClose} title={title} size="xl">
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : state.error ? (
        <p className={`text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>{state.error}</p>
      ) : state.rows.length === 0 ? (
        <EmptyState size="sm" title={isOrders ? 'No orders yet' : 'No reviews yet'} description={isOrders ? 'This customer has not placed any orders.' : 'This customer has not written any reviews.'} />
      ) : (
        <>
          <p className={`mb-3 text-sm ${theme.text.muted}`}>
            {state.rows.length} {isOrders ? (state.rows.length === 1 ? 'order' : 'orders') : state.rows.length === 1 ? 'review' : 'reviews'}
          </p>
          <div className="overflow-x-auto">
            <Table columns={columns} data={state.rows} keyField="_id" pageSize={10} />
          </div>
        </>
      )}
    </Modal>
  );
};

export default CustomerActivityModal;
