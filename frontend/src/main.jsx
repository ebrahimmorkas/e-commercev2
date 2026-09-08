import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ClientApp from './client/App.jsx'
import { ToastProvider } from './components/common/Toast'
import AdminAuthProvider from './admin/features/login/context/AuthProvider'
import ClientAuthProvider from './client/features/auth/context/AuthProvider'

// No router yet - the admin panel lives behind /admin, everything else is
// the client-facing storefront demo. Each side owns its own AuthProvider
// (separate customer vs admin sessions) - see
// client/features/auth/context/AuthProvider.jsx.
const isAdminRoute = window.location.pathname.startsWith('/admin')

const Root = () =>
  isAdminRoute ? (
    <AdminAuthProvider>
      <App />
    </AdminAuthProvider>
  ) : (
    <ClientAuthProvider>
      <ClientApp />
    </ClientAuthProvider>
  )

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <Root />
    </ToastProvider>
  </StrictMode>,
)
