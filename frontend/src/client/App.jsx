import { useState } from 'react';
import Header from './components/ui/header';
import Navbar from './components/ui/navbar';
import AnnouncementBar from './components/ui/announcementBar';
import Footer from './components/ui/footer';
import HomePage from './features/Home/Pages/HomePage';
import { useToast } from '../components/common/Toast';

const DEMO_USER = { name: 'Husain Jaorawala', email: 'husain@example.com' };

/**
 * Client-facing storefront shell: header + page content + footer.
 * Login/cart state is local demo state (no backend wiring yet).
 */
const ClientApp = () => {
  const toast = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const handleLogin = () => {
    setIsAuthenticated(true);
    toast.success(`Welcome back, ${DEMO_USER.name.split(' ')[0]}!`);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    toast.info('You have been logged out.');
  };

  const handleAddToCart = (product) => {
    setCartCount((count) => count + 1);
    toast.success(`${product.name} added to cart`);
  };

  const handleSearch = (query) => {
    if (query) toast.info(`Searching for "${query}"...`);
  };

  const handleCartClick = () => {
    toast.info(cartCount > 0 ? `${cartCount} item(s) in your cart` : 'Your cart is empty');
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
        onCartClick={handleCartClick}
      />
      <Navbar />
      <AnnouncementBar />
      <main className="flex-1">
        <HomePage onAddToCart={handleAddToCart} />
      </main>
      <Footer />
    </div>
  );
};

export default ClientApp;
