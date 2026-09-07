import { useEffect, useState } from 'react';
import Header from './components/ui/header';
import Navbar from './components/ui/navbar';
import Footer from './components/ui/footer';
import HomePage from './features/Home/Pages/HomePage';
import ProductDetailPage from './features/products/pages/ProductDetailPage';
import CartPage from './features/cart/pages/CartPage';
import { useCart } from './features/cart/hooks/useCart';
import { useToast } from '../components/common/Toast';

const DEMO_USER = { name: 'Husain Jaorawala', email: 'husain@example.com' };

// No routing library yet - a product detail page and the cart page are the
// only other views this storefront needs, so it's just a path match against
// `/product/:id` (id = Mongo ObjectId, since GET /products/get-product/:id
// expects one) or the literal `/cart`. pushState/popstate keep the URL
// shareable and the browser back button working.
const PRODUCT_PATH_RE = /^\/product\/([a-fA-F0-9]{24})$/;
const parseRoute = () => {
  const path = window.location.pathname;
  if (path === '/cart') return { type: 'cart' };
  const productId = path.match(PRODUCT_PATH_RE)?.[1];
  if (productId) return { type: 'product', id: productId };
  return { type: 'home' };
};

/**
 * Client-facing storefront shell: header + page content + footer.
 * Login state is still local demo state (no client auth wiring yet), but
 * the cart is real - backed by GET/POST/PUT /api/cart/* (see
 * features/cart/hooks/useCart.js), identified server-side by a guest cookie
 * until real client auth exists. `cartItems` is a { [sizeId]: quantity }
 * map, so the card and detail page's +/- steppers both read/write the same
 * quantity for a given size no matter which view added it first.
 */
const ClientApp = () => {
  const toast = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
    checkout,
  } = useCart();
  const [route, setRoute] = useState(parseRoute);

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openProduct = (id) => {
    window.history.pushState({}, '', `/product/${id}`);
    setRoute({ type: 'product', id });
    window.scrollTo(0, 0);
  };

  const openCart = () => {
    window.history.pushState({}, '', '/cart');
    setRoute({ type: 'cart' });
    window.scrollTo(0, 0);
  };

  const goHome = () => {
    window.history.pushState({}, '', '/');
    setRoute({ type: 'home' });
    window.scrollTo(0, 0);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    toast.success(`Welcome back, ${DEMO_USER.name.split(' ')[0]}!`);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    toast.info('You have been logged out.');
  };

  const addItemToCart = async ({ productId: itemProductId, variantId, sizeId, name }) => {
    if (!itemProductId || !variantId || !sizeId) {
      toast.error('This item has no available size to add.');
      return;
    }
    try {
      await addToCart({ productId: itemProductId, variantId, sizeId, quantity: 1 });
      toast.success(`${name} added to cart`);
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

  const handleCheckout = async () => {
    try {
      const result = await checkout();
      toast.success(`Checkout ready - grand total ₹${result.grandTotal}`);
    } catch (err) {
      toast.error(err.message || 'Could not checkout');
    }
  };

  const handleAddToCart = (product) =>
    addItemToCart({ productId: product.id, variantId: product.variantId, sizeId: product.sizeId, name: product.name });
  const handleDetailAddToCart = ({ product, variant, size }) =>
    addItemToCart({ productId: product.id, variantId: variant.id, sizeId: size.id, name: product.name });
  const handleProductClick = (product) => openProduct(product.id);

  const handleSearch = (query) => {
    if (query) toast.info(`Searching for "${query}"...`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        isAuthenticated={isAuthenticated}
        user={DEMO_USER}
        cartCount={cartCount}
        onLoginClick={handleLogin}
        onLogout={handleLogout}
        onSearch={handleSearch}
        onCartClick={openCart}
      />
      <Navbar />
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
            onCheckout={handleCheckout}
            reload={reloadCart}
          />
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
      </main>
      <Footer />
    </div>
  );
};

export default ClientApp;
