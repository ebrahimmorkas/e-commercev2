import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * Hook to read/act on the current admin session from anywhere below <AuthProvider>.
 *
 * Usage:
 *   const { user, isAuthenticated, isLoading, login, logout } = useAuth();
 */
export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }

  return ctx;
};

export default useAuth;
