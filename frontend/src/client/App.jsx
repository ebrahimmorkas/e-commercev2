import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Header from './components/ui/header';
import Navbar from './components/ui/navbar';
import AnnouncementBar from './components/ui/announcementBar';
import Footer from './components/ui/footer';
import HomePage from './features/Home/Pages/HomePage';
import ProductDetailPage from './features/products/pages/ProductDetailPage';
import CategoryProductsPage from './features/products/pages/CategoryProductsPage';
import BrandProductsPage from './features/products/pages/BrandProductsPage';
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
import PolicyPage from './features/companySettings/pages/PolicyPage';
import { getPolicyLinkByPath } from './features/companySettings/constants';
import theme from './features/Home/theme/theme';
import AllProductsPage from './features/products/pages/AllProductsPage';
import { DEFAULT_SORT as DEFAULT_PRODUCTS_SORT, isValidSort } from './features/products/constants/sortOptions';


// /products, /products?q=crystal&sort=price_asc - the default sort is left out of the URL.
const productsPath = (q = '', sort = DEFAULT_PRODUCTS_SORT) => {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (sort && sort !== DEFAULT_PRODUCTS_SORT) params.set('sort', sort);
  const query = params.toString();
  return query ? `/products?${query}` : '/products';
};

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
// Brand ids are encoded the same way (brandMasterController formatBrandForResponse).
const BRAND_PATH_RE = /^\/brand\/([A-Za-z0-9_-]{43})$/;
// Order ids are also common.encodeId-encoded now (see orderController.js's
// formatOrderForResponse) - same 43-char url-safe base64 shape as
// CATEGORY_PATH_RE above, never raw hex.
const ORDER_DETAIL_PATH_RE = /^\/orders\/([A-Za-z0-9_-]{43})$/;
const LIST_ROUTE_TYPES = ['home', 'products', 'category', 'brand'];
const currentPath = () => window.location.pathname + window.location.search;
const parseRoute = () => {
  const path = window.location.pathname;
  if (path === '/' || path === '') return { type: 'home' };
  if (path === '/products') {
    const params = new URLSearchParams(window.location.search);
    const sort = params.get('sort');
    return { type: 'products', q: (params.get('q') || '').trim(), sort: isValidSort(sort) ? sort : DEFAULT_PRODUCTS_SORT };
  }
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
  const brandId = path.match(BRAND_PATH_RE)?.[1];
  if (brandId) return { type: 'brand', id: brandId };
  const policyLink = getPolicyLinkByPath(path);
  if (policyLink) return { type: 'policy', link: policyLink };
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
    appliedFreeCash,
    totalFreeCashAmount,
    appliedDiscounts,
    totalDiscountAmount,
    replaceCart,
    loading: cartLoading,
    error: cartError,
    reload: reloadCart,
    addToCart,
    incrementItem: incrementCartItem,
    decrementItem: decrementCartItem,
    setItemQuantity: setCartItemQuantity,
    removeItem: removeCartItemFromHook,
  } = useCart();
  const [route, setRoute] = useState(parseRoute);
  // Delivery address picked on the cart page; carried into checkout so the shopper doesn't re-pick it.
  const [deliveryAddressId, setDeliveryAddressId] = useState(null);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);

  // The last list page (home/products/category/brand) is kept mounted but hidden
  // while a product is open, so "Back to shop" returns to the same loaded items
  // and scroll offset instead of a fresh page at the top.
  const [listRoute, setListRoute] = useState(() => {
    const initial = parseRoute();
    return LIST_ROUTE_TYPES.includes(initial.type) ? { route: initial, path: currentPath() } : null;
  });
  const savedScroll = useRef(null);
  const restoreScroll = useRef(false);

  const applyRoute = (nextRoute) => {
    setRoute(nextRoute);
    if (LIST_ROUTE_TYPES.includes(nextRoute.type)) setListRoute({ route: nextRoute, path: currentPath() });
  };

  useEffect(() => {
    const handlePopState = () => {
      restoreScroll.current = true;
      applyRoute(parseRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Runs after the list page is visible again, so the document is tall enough to scroll.
  useLayoutEffect(() => {
    if (!restoreScroll.current || !LIST_ROUTE_TYPES.includes(route.type)) return;
    restoreScroll.current = false;
    const saved = savedScroll.current;
    if (saved && saved.path === currentPath()) window.scrollTo(0, saved.y);
  }, [route]);

  const navigate = (path, nextRoute) => {
    if (LIST_ROUTE_TYPES.includes(route.type) && nextRoute.type === 'product') {
      savedScroll.current = { path: currentPath(), y: window.scrollY };
    }
    window.history.pushState({}, '', path);
    applyRoute(nextRoute);
    window.scrollTo(0, 0);
  };

  const backToList = () => {
    if (!listRoute) return goHome();
    window.history.pushState({}, '', listRoute.path);
    restoreScroll.current = true;
    applyRoute(listRoute.route);
  };

  const openProduct = (id) => navigate(`/product/${id}`, { type: 'product', id });
  const openCart = () => navigate('/cart', { type: 'cart' });
  const openCheckout = () => navigate('/checkout', { type: 'checkout' });
  const openOrders = () => navigate('/orders', { type: 'orders' });
  const openAddresses = () => navigate('/addresses', { type: 'addresses' });
  const openOrderDetail = (id) => navigate(`/orders/${id}`, { type: 'order-detail', id });
  const openPolicyPage = (link) => navigate(link.path, { type: 'policy', link });
  const goHome = () => navigate('/', { type: 'home' });
  const openAllProducts = (q = '', sort = DEFAULT_PRODUCTS_SORT) => navigate(productsPath(q, sort), { type: 'products', q, sort });

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

  // A quantity typed into the stepper. Over stock, the backend says how many
  // are left (errors[0].availableStock) - the line is set to that instead,
  // with a message; out of stock entirely just shows the error.
  const handleSetItemQuantity = async (itemId, quantity) => {
    try {
      await setCartItemQuantity(itemId, quantity);
    } catch (err) {
      const availableStock = err.errors?.[0]?.availableStock;
      if (typeof availableStock !== 'number' || availableStock <= 0) {
        toast.error(err.message || 'Could not update cart');
        return;
      }
      try {
        await setCartItemQuantity(itemId, availableStock);
        toast.warning(`Only ${availableStock} in stock - quantity set to ${availableStock}.`);
      } catch (retryErr) {
        toast.error(retryErr.message || 'Could not update cart');
      }
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

  // Header search -> /products?q=...; an empty search shows every product.
  const handleSearch = (query) => openAllProducts((query || '').trim(), route.type === 'products' ? route.sort : DEFAULT_PRODUCTS_SORT);

  // The list page on screen - or, while a product is open, the one kept hidden underneath.
  const listView = LIST_ROUTE_TYPES.includes(route.type) ? route : route.type === 'product' ? listRoute?.route : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* One sticky unit: header and nav bar stay pinned together while scrolling. */}
      <div className="sticky top-0 z-40">
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
          onProductSelect={openProduct}
          onSearchPanelChange={setSearchPanelOpen}
          onCartClick={openCart}
        />
        <Navbar suspended={searchPanelOpen} />
      </div>
      <AnnouncementBar />
      <main className="flex-1">
        {route.type === 'product' && (
          <ProductDetailPage
            productId={route.id}
            onBack={backToList}
            cartItems={cartItems}
            onAddToCart={handleDetailAddToCart}
            onIncrementItem={handleIncrementItem}
            onDecrementItem={handleDecrementItem}
            onSetItemQuantity={handleSetItemQuantity}
            onProductClick={handleProductClick}
            onRecommendedAddToCart={handleAddToCart}
          />
        )}
        <div hidden={route.type === 'product'}>
        {listView?.type === 'category' && (
          <CategoryProductsPage
            categoryId={listView.id}
            cartItems={cartItems}
            onAddToCart={handleAddToCart}
            onProductClick={handleProductClick}
            onIncrementItem={handleIncrementItem}
            onDecrementItem={handleDecrementItem}
            onSetItemQuantity={handleSetItemQuantity}
            onGoHome={goHome}
          />
        )}
        {listView?.type === 'brand' && (
          <BrandProductsPage
            brandId={listView.id}
            cartItems={cartItems}
            onAddToCart={handleAddToCart}
            onProductClick={handleProductClick}
            onIncrementItem={handleIncrementItem}
            onDecrementItem={handleDecrementItem}
            onSetItemQuantity={handleSetItemQuantity}
            onGoHome={goHome}
          />
        )}
        </div>
        {route.type === 'cart' && (
          <CartPage
            lineItems={lineItems}
            subtotal={subtotal}
            loading={cartLoading}
            error={cartError}
            onBack={goHome}
            onIncrementItem={handleIncrementItem}
            onDecrementItem={handleDecrementItem}
            onSetItemQuantity={handleSetItemQuantity}
            onRemoveItem={handleRemoveItem}
            onCheckout={handleCheckoutClick}
            isAuthenticated={isAuthenticated}
            addressId={deliveryAddressId}
            onAddressChange={setDeliveryAddressId}
            reload={reloadCart}
            appliedFreeCash={appliedFreeCash}
            totalFreeCashAmount={totalFreeCashAmount}
            appliedDiscounts={appliedDiscounts}
            totalDiscountAmount={totalDiscountAmount}
            onCartUpdated={replaceCart}
            onSignIn={handleLoginClick}
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
            totalFreeCashAmount={totalFreeCashAmount}
            totalDiscountAmount={totalDiscountAmount}
            cartLoading={cartLoading}
            initialAddressId={deliveryAddressId}
            onBack={openCart}
            onPlaced={handleOrderPlaced}
            onOrderFailed={reloadCart}
          />
        )}
        {route.type === 'orders' && isAuthenticated && <OrdersPage onBack={goHome} onOpenOrder={openOrderDetail} />}
        {route.type === 'addresses' && isAuthenticated && <AddressesPage onBack={goHome} />}
        {route.type === 'order-detail' && isAuthenticated && (
          <OrderDetailPage orderId={route.id} onBack={openOrders} onGoHome={goHome} />
        )}
        <div hidden={route.type === 'product'}>
        {listView?.type === 'products' && (
          <AllProductsPage
            query={listView.q}
            sort={listView.sort}
            onSortChange={(sort) => {
              // Same page, new sort - replace instead of stacking a history entry per sort change.
              window.history.replaceState({}, '', productsPath(listView.q, sort));
              applyRoute({ ...listView, sort });
            }}
            onClearSearch={() => openAllProducts('', listView.sort)}
            cartItems={cartItems}
            onAddToCart={handleAddToCart}
            onProductClick={handleProductClick}
            onIncrementItem={handleIncrementItem}
            onDecrementItem={handleDecrementItem}
            onSetItemQuantity={handleSetItemQuantity}
          />
        )}
        {listView?.type === 'home' && (
          <HomePage
            onProductClick={handleProductClick}
            cartItems={cartItems}
            onAddToCart={handleAddToCart}
            onIncrementItem={handleIncrementItem}
            onDecrementItem={handleDecrementItem}
            onSetItemQuantity={handleSetItemQuantity}
          />
        )}
        </div>
        {route.type === 'policy' && <PolicyPage link={route.link} onBack={goHome} />}
        {route.type === 'not-found' && <NotFoundPage onGoHome={goHome} />}
      </main>
      <Footer onOpenPolicyPage={openPolicyPage} />

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
};

export default ClientApp;
