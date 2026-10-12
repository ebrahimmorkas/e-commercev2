import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Badge from '../../../../components/common/Badge';
import Button from '../../../../components/common/Buttons';
import Modal from '../../../../components/common/Modal';
import EmptyState from '../../../../components/common/EmptyState';
import { useAbandonedCarts } from '../hooks/useAbandonedCarts';
import LiveIndicator from '../../../realtime/LiveIndicator';
import theme from '../theme/theme';

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTimeAgo = (value) => {
  if (!value) return '—';
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

// Whether the customer was logged in when they filled the cart.
const SOURCE_LABELS = {
  LOGGED_IN: 'Logged in',
  GUEST_KNOWN: 'Guest only',
  COMBINED: 'Logged in + guest',
};

const SOURCE_DESCRIPTIONS = {
  LOGGED_IN: 'The customer was logged in when they added these products.',
  GUEST_KNOWN: 'The customer was not logged in when they added these products. They are recognised from an earlier login on the same browser.',
  COMBINED: 'The customer left two carts: one while logged in and one as a guest. Both are shown here together.',
};

/**
 * @param {boolean} [props.canPlaceOrder] - Place Order is on for this account
 *   (its Company Master switch + module) - shows the Place Order column / button.
 * @param {(cart: Object) => void} [props.onOpenPlaceOrder] - Opens the Place
 *   Order page filled in with a row's customer and products.
 */
const AbandonedCartsPage = ({ canPlaceOrder = false, onOpenPlaceOrder }) => {
  const { carts, loading, error, placeOrder, placingOrder } = useAbandonedCarts();
  // Row ids, not the rows themselves: the list re-reads itself on every live
  // update, and a row that left it (the customer came back) closes its modal.
  const [productsCartId, setProductsCartId] = useState(null);
  const [orderCartId, setOrderCartId] = useState(null);
  const productsCart = carts.find((cart) => cart._id === productsCartId) || null;
  const orderCart = carts.find((cart) => cart._id === orderCartId) || null;

  const columns = useMemo(
    () => [
      {
        key: 'userName',
        label: 'Customer',
        render: (row) => (
          <div>
            <span className={`block font-medium ${theme.text.heading}`}>{row.userName || 'Unknown'}</span>
            <span className={`block text-xs ${theme.text.muted}`}>{row.userEmail || '—'}</span>
          </div>
        ),
      },
      { key: 'userPhone', label: 'Phone', render: (row) => row.userPhone || '—' },
      {
        key: 'source',
        label: 'Cart type',
        render: (row) => (
          <Badge variant={theme.badge.source[row.source] || 'gray'} size="sm" title={SOURCE_DESCRIPTIONS[row.source]}>
            {SOURCE_LABELS[row.source] || row.source}
          </Badge>
        ),
      },
      {
        key: 'itemCount',
        label: 'Products',
        align: 'center',
        render: (row) => (
          <Button
            variant="outline"
            size="xs"
            shape="pill"
            ariaLabel={`View the ${row.itemCount} product(s) in this cart`}
            title="View the products in this cart"
            onClick={() => setProductsCartId(row._id)}
          >
            {row.itemCount}
          </Button>
        ),
      },
      { key: 'lastProductAddedAt', label: 'Last Activity', sortable: true, render: (row) => formatDateTime(row.lastProductAddedAt) },
      {
        key: 'abandonedAt',
        label: 'Abandoned',
        sortable: true,
        render: (row) => (
          <span title={formatDateTime(row.abandonedAt)} className={theme.text.body}>
            {formatTimeAgo(row.abandonedAt)}
          </span>
        ),
      },
      ...(canPlaceOrder
        ? [
            {
              key: 'placeOrder',
              label: 'Place Order',
              align: 'center',
              render: (row) => (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    // The row itself opens the products modal - this button only asks how to place the order.
                    e.stopPropagation();
                    setOrderCartId(row._id);
                  }}
                >
                  Place Order
                </Button>
              ),
            },
          ]
        : []),
    ],
    [canPlaceOrder]
  );

  const closeOrderModal = () => {
    if (!placingOrder) setOrderCartId(null);
  };

  const handlePlaceDirectly = async () => {
    const success = await placeOrder(orderCart._id);
    if (success) {
      setOrderCartId(null);
      setProductsCartId(null);
    }
  };

  const handleGoToPlaceOrder = () => {
    const cart = orderCart;
    setOrderCartId(null);
    setProductsCartId(null);
    onOpenPlaceOrder?.(cart);
  };

  return (
    <div className="max-w-8xl mx-auto p-6">
      <Card
        title={<span className="font-bold">Abandoned Carts</span>}
        subtitle="Customers who added items to their cart but did not check out. Updates live - no need to refresh."
        headerActions={<LiveIndicator />}
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
          data={carts}
          keyField="_id"
          // The whole row opens the cart's products.
          onRowClick={(row) => setProductsCartId(row._id)}
          loading={loading}
          pageSize={10}
          emptyComponent={
            <EmptyState
              title="No abandoned carts"
              description="Carts that go quiet past your configured reflection time will show up here automatically."
            />
          }
        />
      </Card>

      {/* The products the customer left in the cart. */}
      <Modal
        isOpen={!!productsCart}
        onClose={() => setProductsCartId(null)}
        title={productsCart ? `Products in ${productsCart.userName ? `${productsCart.userName}'s` : 'this'} cart` : 'Products'}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setProductsCartId(null)}>
              Close
            </Button>
            {canPlaceOrder && productsCart && (
              <Button variant="primary" onClick={() => setOrderCartId(productsCart._id)}>
                Place Order
              </Button>
            )}
          </div>
        }
      >
        {productsCart && (
          <ul className="divide-y divide-gray-100">
            {(productsCart.items || []).map((item) => (
              <li key={`${item.productId}:${item.variantId}:${item.sizeId}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className={`font-medium wrap-break-word ${theme.text.heading}`}>{item.productName}</p>
                  <p className={`text-xs ${theme.text.muted}`}>
                    {item.variantName} / {item.sizeName}
                  </p>
                </div>
                <span className={`shrink-0 ${theme.text.body}`}>× {item.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* How the admin wants to place the order for this cart. */}
      <Modal
        isOpen={!!orderCart}
        onClose={closeOrderModal}
        title="Place Order"
        size="md"
        footer={
          <div className="flex justify-end">
            <Button variant="ghost" onClick={closeOrderModal} disabled={placingOrder}>
              Cancel
            </Button>
          </div>
        }
      >
        {orderCart && (
          <div className="space-y-4">
            <p className={`text-sm ${theme.text.body}`}>
              How do you want to place the order for {orderCart.userName || 'this customer'} ({orderCart.itemCount} product{orderCart.itemCount === 1 ? '' : 's'})?
            </p>
            <div className="space-y-1">
              <Button variant="primary" fullWidth onClick={handlePlaceDirectly} loading={placingOrder} loadingText="Placing order...">
                Place order directly
              </Button>
              <p className={`text-xs ${theme.text.muted}`}>
                Orders everything in the cart right now at today&apos;s prices, with no shipping price, discount or address. You can add those on the order afterwards.
              </p>
            </div>
            <div className="space-y-1">
              <Button variant="secondary" fullWidth onClick={handleGoToPlaceOrder} disabled={placingOrder}>
                Go to Place Order page
              </Button>
              <p className={`text-xs ${theme.text.muted}`}>
                Opens Place Order with this customer and these products already filled in, so you can review and change them first.
              </p>
            </div>
            <p className={`text-xs ${theme.text.muted}`}>Either way, the customer&apos;s cart is emptied once the order is placed.</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AbandonedCartsPage;
