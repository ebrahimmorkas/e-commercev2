import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Badge from '../../../../components/common/Badge';
import EmptyState from '../../../../components/common/EmptyState';
import Button from '../../../../components/common/Buttons';
import SearchInput from '../../../../components/common/SearchInput';
import { useOrdersAdmin } from '../hooks/useOrdersAdmin';
import { useRealtime } from '../../../realtime/useRealtime';
import LiveIndicator from '../../../realtime/LiveIndicator';
import { CONNECTION_STATUS } from '../../../../utils/socketClient';
import OrderDetailModal from '../components/OrderDetailModal';
import { filterBySearch } from '../../../../utils/searchFilter';
import { formatOrderMoney, formatOrderDateTime, stepBadgeVariant, orderSourceLabel, orderSourceVariant } from '../utils/formatOrder';
import theme from '../theme/theme';

// Client-side search: the admin endpoint returns every order at once, and live pushes keep that
// list current, so filtering it here also covers orders arriving while a search is active
// (matching rules: utils/searchFilter.js). Limited to what the list rows carry - order number,
// source, status, payment, the address snapshot, and the customer's name/phone for walk-in
// orders. Online orders only carry a user id here, not the customer's name.
const orderSearchFields = (order) => [
  order.orderNumber,
  orderSourceLabel(order),
  order.currentStepName,
  order.currentStepCode,
  order.payment?.status,
  order.payment?.method,
  order.payment?.transactionId,
  order.walkInCustomer?.name,
  order.walkInCustomer?.phone,
  order.walkInCustomer?.whatsapp,
  order.walkInCustomer?.email,
  order.shippingAddressSnapshot?.building,
  order.shippingAddressSnapshot?.cityName,
  order.shippingAddressSnapshot?.stateName,
  order.shippingAddressSnapshot?.pincode,
];

/**
 * Admin order management: all orders for this vendor, with a detail view
 * that supports advancing an order's workflow step and assigning a
 * delivery agent. Backed by GET /api/orders/admin (orderAdminApi.js).
 *
 * NOTE: Order only stores a reference to its (now-deactivated) cart, not a
 * line-item snapshot, and there's no route to fetch a deactivated cart by
 * id - so, like the storefront's own order pages, this can't show "what was
 * in this order," only totals/status/addresses.
 */
const OrdersPage = () => {
  const { orders, loading, error, refetch } = useOrdersAdmin();
  const { status, reconnect } = useRealtime();
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = useMemo(() => filterBySearch(orders, searchTerm, orderSearchFields), [orders, searchTerm]);
  const isSearching = searchTerm.trim() !== '';

  // While the live connection is up the list keeps itself current, so a manual Refresh is only offered when
  // it can actually help: the connection is down/reconnecting (the list may be stale), or the last load
  // failed (Refresh doubles as the retry - hiding it then would leave no way to try again).
  const showRefresh = status !== CONNECTION_STATUS.CONNECTED || !!error;

  // Refetch first, THEN reconnect: the fetch is what refreshes an expired
  // access token, and the socket's handshake reads that token. (No-op unless
  // the socket has actually given up - see reconnectSocket.)
  const handleRefresh = async () => {
    await refetch();
    reconnect();
  };

  const columns = useMemo(
    () => [
      {
        key: 'orderNumber',
        label: 'Order #',
        sortable: true,
        render: (row) => <span className={`font-medium ${theme.text.heading}`}>{row.orderNumber}</span>,
      },
      {
        key: 'source',
        label: 'Source',
        render: (row) => <Badge variant={orderSourceVariant(row)}>{orderSourceLabel(row)}</Badge>,
      },
      { key: 'orderPlacedAt', label: 'Placed On', sortable: true, render: (row) => formatOrderDateTime(row.orderPlacedAt) },
      {
        key: 'currentStepName',
        label: 'Status',
        render: (row) => <Badge variant={stepBadgeVariant(row.currentStepCode)}>{row.currentStepName}</Badge>,
      },
      {
        key: 'grandTotal',
        label: 'Grand Total',
        align: 'right',
        sortable: true,
        render: (row) => formatOrderMoney(row, row.grandTotal),
      },
      {
        key: 'paymentStatus',
        label: 'Payment',
        align: 'center',
        render: (row) => row.payment?.status || 'PENDING',
      },
    ],
    []
  );

  const actions = [
    {
      label: 'View',
      variant: theme.button.secondary,
      onClick: (row) => setSelectedOrderId(row._id),
    },
  ];

  return (
    <div className="max-w-8xl mx-auto p-6">
      <Card
        title={<span className="font-bold">Orders</span>}
        subtitle="View and manage every order placed on your storefront"
        headerActions={
          <div className="flex items-center gap-3">
            <LiveIndicator />
            {showRefresh && (
              <Button variant={theme.button.secondary} onClick={handleRefresh}>
                Refresh
              </Button>
            )}
          </div>
        }
      >
        {error && (
          <p
            className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}
          >
            {error}
          </p>
        )}

        {!loading && orders.length > 0 && (
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search order #, status, payment, customer or city…"
            ariaLabel="Search orders"
            matchCount={filteredOrders.length}
            totalCount={orders.length}
            itemLabel="orders"
          />
        )}

        <Table
          columns={columns}
          data={filteredOrders}
          keyField="_id"
          actions={actions}
          loading={loading}
          pageSize={15}
          resetPageOn={searchTerm}
          onRowClick={(row) => setSelectedOrderId(row._id)}
          emptyComponent={
            isSearching && orders.length > 0 ? (
              <EmptyState
                size="sm"
                title="No matching orders"
                description={`Nothing matches "${searchTerm.trim()}". Try an order number, status or payment method.`}
                action={
                  <Button variant={theme.button.secondary} onClick={() => setSearchTerm('')}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No orders yet" description="Orders placed on your storefront will show up here." />
            )
          }
        />
      </Card>

      <OrderDetailModal
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onChanged={refetch}
      />
    </div>
  );
};

export default OrdersPage;
