import { useMemo, useRef, useState } from 'react';
import Dropdown from '../../../../components/common/DropDown';
import TextArea from '../../../../components/common/TextArea';
import Spinner from '../../../../components/common/Spinner';
import { RadioGroup } from '../../../../components/common/Radio';
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

// Where a directly placed order is delivered. Limits match the backend
// (middlewares/validations/abandonedCartValidations.js).
const ADDRESS_MODE_OPTIONS = [
  { value: 'saved', label: "One of the customer's saved addresses" },
  { value: 'new', label: 'Type a different address' },
];
const MIN_ADDRESS_LENGTH = 5;
const MAX_ADDRESS_LENGTH = 1000;

// Same wording as the Place Order page's saved-address list.
const describeAddress = (address) =>
  `${address.address_name} - ${[address.room_no, address.building, address.address_in_words].filter(Boolean).join(', ')} (${address.pincode})`;

/**
 * @param {boolean} [props.canPlaceOrder] - Place Order is on for this account
 *   (its Company Master switch + module) - shows the Place Order column / button.
 * @param {(cart: Object) => void} [props.onOpenPlaceOrder] - Opens the Place
 *   Order page filled in with a row's customer and products.
 */
const AbandonedCartsPage = ({ canPlaceOrder = false, onOpenPlaceOrder }) => {
  const { carts, loading, error, placeOrder, placingOrder, loadAddresses } = useAbandonedCarts();
  // "Place order directly": the delivery address step of the Place Order modal.
  const [addressStep, setAddressStep] = useState(false);
  const [addressMode, setAddressMode] = useState('saved');
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addressText, setAddressText] = useState('');
  const [addressError, setAddressError] = useState('');
  // The cart whose saved addresses are being loaded - a late answer for another cart is dropped.
  const addressRequestRef = useRef(null);
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
                    openOrderModal(row._id);
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

  // Always opens on the question, never on a previous cart's address.
  const openOrderModal = (cartId) => {
    setAddressStep(false);
    setAddresses([]);
    setSelectedAddressId('');
    setAddressText('');
    setAddressError('');
    setOrderCartId(cartId);
  };

  const closeOrderModal = () => {
    if (placingOrder) return;
    addressRequestRef.current = null;
    setOrderCartId(null);
  };

  // "Place order directly" first asks where to deliver: one of the customer's
  // saved addresses, or one the admin types.
  const handleChooseDirect = async () => {
    const cartId = orderCart._id;
    addressRequestRef.current = cartId;
    setAddressStep(true);
    setAddressError('');
    setAddressesLoading(true);
    const list = await loadAddresses(orderCart.userId);
    // The admin moved on to another cart (or closed this) while it loaded.
    if (addressRequestRef.current !== cartId) return;
    setAddresses(list);
    setAddressMode(list.length > 0 ? 'saved' : 'new');
    setAddressesLoading(false);
  };

  const handlePlaceDirectly = async () => {
    let address;
    if (addressMode === 'saved') {
      if (!selectedAddressId) {
        setAddressError('Select one of the saved addresses.');
        return;
      }
      address = { addressId: selectedAddressId };
    } else {
      const trimmed = addressText.trim();
      if (trimmed.length < MIN_ADDRESS_LENGTH) {
        setAddressError(`Enter the full delivery address (at least ${MIN_ADDRESS_LENGTH} characters).`);
        return;
      }
      address = { addressText: trimmed };
    }
    setAddressError('');
    const success = await placeOrder(orderCart._id, address);
    if (success) {
      addressRequestRef.current = null;
      setOrderCartId(null);
      setProductsCartId(null);
    }
  };

  const handleGoToPlaceOrder = () => {
    const cart = orderCart;
    addressRequestRef.current = null;
    setOrderCartId(null);
    setProductsCartId(null);
    onOpenPlaceOrder?.(cart);
  };

  const addressOptions = addresses.map((address) => ({ value: String(address._id), label: describeAddress(address) }));

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
              <Button variant="primary" onClick={() => openOrderModal(productsCart._id)}>
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeOrderModal} disabled={placingOrder}>
              Cancel
            </Button>
            {addressStep && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    addressRequestRef.current = null;
                    setAddressStep(false);
                    setAddressError('');
                  }}
                  disabled={placingOrder}
                >
                  Back
                </Button>
                <Button variant="primary" onClick={handlePlaceDirectly} loading={placingOrder} loadingText="Placing order..." disabled={addressesLoading || (addressMode === 'saved' && addressOptions.length === 0)}>
                  Place order
                </Button>
              </>
            )}
          </div>
        }
      >
        {orderCart && addressStep && (
          <div className="space-y-3">
            <p className={`text-sm ${theme.text.body}`}>
              Where should the order for {orderCart.userName || 'this customer'} be delivered?
            </p>
            {addressesLoading ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : (
              <>
                <RadioGroup
                  label="Delivery address"
                  name="abandoned-cart-address-mode"
                  options={ADDRESS_MODE_OPTIONS}
                  value={addressMode}
                  onChange={(value) => {
                    setAddressMode(value);
                    setAddressError('');
                  }}
                />
                {addressMode === 'saved' ? (
                  addressOptions.length === 0 ? (
                    <p className={`text-sm ${theme.text.subheading}`}>This customer has no saved addresses. Type the address instead.</p>
                  ) : (
                    <Dropdown
                      label="Saved address"
                      options={addressOptions}
                      value={selectedAddressId}
                      onChange={(value) => {
                        setSelectedAddressId(value);
                        setAddressError('');
                      }}
                      placeholder="Select an address"
                      error={addressError}
                    />
                  )
                ) : (
                  <div>
                    <TextArea
                      label="Delivery address"
                      placeholder="Flat / building, street, area, city, state, pincode"
                      rows={4}
                      maxLength={MAX_ADDRESS_LENGTH}
                      value={addressText}
                      onChange={(e) => setAddressText(e.target.value)}
                      disabled={placingOrder}
                    />
                    {/* TextArea only shows its own per-keystroke validation errors, so the submit-time one is shown here. */}
                    {addressError && (
                      <p className={`mt-1 text-sm ${theme.alert.error.text}`} role="alert">
                        {addressError}
                      </p>
                    )}
                  </div>
                )}
                <p className={`text-xs ${theme.text.muted}`}>
                  A typed address is used for this order only. It is not saved to the customer&apos;s address book.
                </p>
              </>
            )}
          </div>
        )}
        {orderCart && !addressStep && (
          <div className="space-y-4">
            <p className={`text-sm ${theme.text.body}`}>
              How do you want to place the order for {orderCart.userName || 'this customer'} ({orderCart.itemCount} product{orderCart.itemCount === 1 ? '' : 's'})?
            </p>
            <div className="space-y-1">
              <Button variant="primary" fullWidth onClick={handleChooseDirect}>
                Place order directly
              </Button>
              <p className={`text-xs ${theme.text.muted}`}>
                Orders everything in the cart at today&apos;s prices, with no shipping price or discount. You only choose the delivery address next.
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
