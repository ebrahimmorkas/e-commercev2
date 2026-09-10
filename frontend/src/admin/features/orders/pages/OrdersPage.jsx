import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Badge from '../../../../components/common/Badge';
import EmptyState from '../../../../components/common/EmptyState';
import Button from '../../../../components/common/Buttons';
import { useOrdersAdmin } from '../hooks/useOrdersAdmin';
import OrderDetailModal from '../components/OrderDetailModal';
import { formatOrderMoney, formatOrderDateTime, stepBadgeVariant } from '../utils/formatOrder';
import theme from '../theme/theme';

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
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const columns = useMemo(
    () => [
      {
        key: 'orderNumber',
        label: 'Order #',
        sortable: true,
        render: (row) => <span className={`font-medium ${theme.text.heading}`}>{row.orderNumber}</span>,
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
          <Button variant={theme.button.secondary} onClick={refetch}>
            Refresh
          </Button>
        }
      >
        {error && (
          <p
            className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}
          >
            {error}
          </p>
        )}

        <Table
          columns={columns}
          data={orders}
          keyField="_id"
          actions={actions}
          loading={loading}
          pageSize={15}
          onRowClick={(row) => setSelectedOrderId(row._id)}
          emptyComponent={<EmptyState title="No orders yet" description="Orders placed on your storefront will show up here." />}
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
