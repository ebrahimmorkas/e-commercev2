import { useEffect, useState } from 'react';
import Header from './components/ui/header';
import Navbar from './components/ui/navbar';
import AnnouncementBar from './components/ui/announcementBar';
import Footer from './components/ui/footer';
import HomePage from './features/Home/Pages/HomePage';
import ProductDetailPage from './features/products/pages/ProductDetailPage';
import CategoryProductsPage from './features/products/pages/CategoryProductsPage';
import CartPage from './features/cart/pages/CartPage';
import { useCart } from './features/cart/hooks/useCart';
import { useAuth } from './features/auth/hooks/useAuth';
import AuthModal from './features/auth/components/AuthModal';
import CheckoutPage from './features/orders/pages/CheckoutPage';
import OrdersPage from './features/orders/pages/OrdersPage';
import OrderDetailPage from './features/orders/pages/OrderDetailPage';
import AddressesPage from './features/address/pages/AddressesPage';
import { useToast } from '../components/common/Toast';
import EmptyState from '../components/common/EmptyState/EmptyState';
import NotFoundPage from './components/errors/NotFoundPage';
import theme from './features/Home/theme/theme';

// No routing library yet - path match against `/product/:id` (id = Mongo
// ObjectId), `/category/:id`, `/cart`, `/checkout`, `/orders`, `/orders/:id`, `/addresses`,
// or home. pushState/popstate keep the URL shareable and the browser back
// button working. `/category/:id` is also opened directly as a real link
// (new tab) from the Navbar's Shop mega-menu, so it has to work as a
// standalone page load, not just via in-app pushState.
// Anything that doesn't match one of these is 'not-found' (previously fell
// through to 'home' silently - see NotFoundPage).
// Product ids are also common.encodeId-encoded now (see productController.js's
// formatProductForResponse) - same 43-char url-safe base64 shape as
// CATEGORY_PATH_RE/ORDER_DETAIL_PATH_RE below, never raw hex.
const PRODUCT_PATH_RE = /^\/product\/([A-Za-z0-9_-]{43})$/;
// Category ids now come from the backend common.encodeId-encoded (AES-256-CBC
// of a 24-char ObjectId hex string, base64url output) - always exactly 43
// url-safe base64 characters, never raw hex. See categoryController.js's
// formatCategoryForResponse.
const CATEGORY_PATH_RE = /^\/category\/([A-Za-z0-9_-]{43})$/;
// Order ids are also common.encodeId-encoded now (see orderController.js's
// formatOrderForResponse) - same 43-char url-safe base64 shape as
// CATEGORY_PATH_RE above, never raw hex.
const ORDER_DETAIL_PATH_RE = /^\/orders\/([A-Za-z0-9_-]{43})$/;
const parseRoute = () => {
  const path = window.location.pathname;
  if (path === '/' || path === '') return { type: 'home' };
  if (path === '/cart') return { type: 'cart' };
  if (path === '/checkout') return { type: 'checkout' };
  if (path === '/orders') return { type: 'orders' };
  if (path === '/addresses') return { type: 'addresses' };
  const orderId = path.match(ORDER_DETAIL_PATH_RE)?.[1];
  if (orderId) return { type: 'order-detail', id: orderId };
  const productId = path.match(PRODUCT_PATH_RE)?.[1];
  if (productId) return { type: 'product', id: productId };
  const categoryId = path.match(CATEGORY_PATH_RE)?.[1];
  if (categoryId) return { type: 'category', id: categoryId };
  return { type: 'not-found' };
};

// Shown for /checkout, /orders, /orders/:id, and /addresses when reached (typically via
// a direct URL or a page refresh) while logged out.
const SignInGate = ({ onBack, onSignIn }) => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <EmptyState
      title="Please sign in"
      description="You need an account to view this page."
      action={
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onSignIn}
            className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${theme.hero.cta}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Go Home
          </button>
        </div>
      }
    />
  </div>
);

/**
 * Client-facing storefront shell: header + page content + footer.
 * Auth is real (see features/auth) - login/register hit /api/auth/*, and
 * checkout/orders (features/orders, features/address) require it, matching
 * backend/routes/orderRoutes.js and addressRoutes.js's authenticate +
 * authorize('user'). The cart itself stays reachable as a guest (see
 * features/cart/hooks/useCart.js) - only checkout requires being logged in.
 * `cartItems` is a { [sizeId]: quantity } map, so the card and detail page's
 * +/- steppers both read/write the same quantity for a given size no matter
 * which view added it first.
 */
const ClientApp = () => {
  const toast = useToast();
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const {
    lineItems,
    cartItems,
    cartCount,
    subtotal,
    loading: cartLoading,
    error: cartError,
    reload: reloadCart,
    addToCart,
    incrementItem: incrementCartItem,
    decrementItem: decrementCartItem,
    removeItem: removeCartItemFromHook,
  } = useCart();
  const [route, setRoute] = useState(parseRoute);
  // Delivery address picked on the cart page; carried into checkout so the shopper doesn't re-pick it.
  const [deliveryAddressId, setDeliveryAddressId] = useState(null);

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path, nextRoute) => {
    window.history.pushState({}, '', path);
    setRoute(nextRoute);
    window.scrollTo(0, 0);
  };

  const openProduct = (id) => navigate(`/product/${id}`, { type: 'product', id });
  const openCart = () => navigate('/cart', { type: 'cart' });
  const openCheckout = () => navigate('/checkout', { type: 'checkout' });
  const openOrders = () => navigate('/orders', { type: 'orders' });
  const openAddresses = () => navigate('/addresses', { type: 'addresses' });
  const openOrderDetail = (id) => navigate(`/orders/${id}`, { type: 'order-detail', id });
  const goHome = () => navigate('/', { type: 'home' });

  const handleLoginClick = () => setAuthModalOpen(true);

  const handleLogout = () => {
    logout();
    setDeliveryAddressId(null);
    if (route.type === 'checkout' || route.type === 'orders' || route.type === 'order-detail' || route.type === 'addresses')
      goHome();
  };

  const handleOrdersClick = () => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    openOrders();
  };

  const handleAddressesClick = () => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    openAddresses();
  };

  const addItemToCart = async ({ productId: itemProductId, variantId, sizeId }) => {
    if (!itemProductId || !variantId || !sizeId) {
      toast.error('This item has no available size to add.');
      return;
    }
    try {
      await addToCart({ productId: itemProductId, variantId, sizeId, quantity: 1 });
    } catch (err) {
      toast.error(err.message || 'Could not add item to cart');
    }
  };

  const handleIncrementItem = async (itemId) => {
    try {
      await incrementCartItem(itemId);
    } catch (err) {
      toast.error(err.message || 'Could not update cart');
    }
  };

  const handleDecrementItem = async (itemId) => {
    try {
      await decrementCartItem(itemId);
    } catch (err) {
      toast.error(err.message || 'Could not update cart');
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await removeCartItemFromHook(itemId);
    } catch (err) {
      toast.error(err.message || 'Could not remove item from cart');
    }
  };

  const handleCheckoutClick = () => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    openCheckout();
  };

  const handleOrderPlaced = (orderId) => {
    toast.success('Order placed successfully!');
    reloadCart();
    openOrderDetail(orderId);
  };

  const handleAddToCart = (product) =>
    addItemToCart({ productId: product.id, variantId: product.variantId, sizeId: product.sizeId });
  const handleDetailAddToCart = ({ product, variant, size }) =>
    addItemToCart({ productId: product.id, variantId: variant.id, sizeId: size.id });
  const handleProductClick = (product) => openProduct(product.id);

  const handleSearch = (query) => {
    if (query) toast.info(`Searching for "${query}"...`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        isAuthenticated={isAuthenticated}
        authLoading={authLoading}
        user={user}
        cartCount={cartCount}
        onLoginClick={handleLoginClick}
        onLogout={handleLogout}
        onOrdersClick={handleOrdersClick}
        onAddressesClick={handleAddressesClick}
        onSearch={handleSearch}
        onCartClick={openCart}
      />
      <Navbar />
      <AnnouncementBar />
      <main className="flex-1">
        {route.type === 'product' && (
          <ProductDetailPage
            productId={route.id}
            onBack={goHome}
            cartItems={cartItems}
            onAddToCart={handleDetailAddToCart}
            onIncrementItem={handleIncrementItem}
            onDecrementItem={handleDecrementItem}
            onProductClick={handleProductClick}
            onRecommendedAddToCart={handleAddToCart}
          />
        )}
        {route.type === 'category' && (
          <CategoryProductsPage
            categoryId={route.id}
            cartItems={cartItems}
            onAddToCart={handleAddToCart}
            onProductClick={handleProductClick}
            onIncrementItem={handleIncrementItem}
            onDecrementItem={handleDecrementItem}
            onGoHome={goHome}
          />
        )}
        {route.type === 'cart' && (
          <CartPage
            lineItems={lineItems}
            subtotal={subtotal}
            loading={cartLoading}
            error={cartError}
            onBack={goHome}
            onIncrementItem={handleIncrementItem}
            onDecrementItem={handleDecrementItem}
            onRemoveItem={handleRemoveItem}
            onCheckout={handleCheckoutClick}
            isAuthenticated={isAuthenticated}
            addressId={deliveryAddressId}
            onAddressChange={setDeliveryAddressId}
            reload={reloadCart}
          />
        )}
        {(route.type === 'checkout' ||
          route.type === 'orders' ||
          route.type === 'order-detail' ||
          route.type === 'addresses') &&
          !isAuthenticated && (
            <SignInGate onBack={goHome} onSignIn={() => setAuthModalOpen(true)} />
          )}
        {route.type === 'checkout' && isAuthenticated && (
          <CheckoutPage
            lineItems={lineItems}
            subtotal={subtotal}
            cartLoading={cartLoading}
            initialAddressId={deliveryAddressId}
            onBack={openCart}
            onPlaced={handleOrderPlaced}
          />
        )}
        {route.type === 'orders' && isAuthenticated && <OrdersPage onBack={goHome} onOpenOrder={openOrderDetail} />}
        {route.type === 'addresses' && isAuthenticated && <AddressesPage onBack={goHome} />}
        {route.type === 'order-detail' && isAuthenticated && (
          <OrderDetailPage orderId={route.id} onBack={openOrders} onGoHome={goHome} />
        )}
        {route.type === 'home' && (
          <HomePage
            onProductClick={handleProductClick}
            cartItems={cartItems}
            onAddToCart={handleAddToCart}
            onIncrementItem={handleIncrementItem}
            onDecrementItem={handleDecrementItem}
          />
        )}
        {route.type === 'not-found' && <NotFoundPage onGoHome={goHome} />}
      </main>
      <Footer />

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
};

export default ClientApp;
