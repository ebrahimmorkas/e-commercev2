import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ClientApp from './client/App.jsx'
import { ToastProvider } from './components/common/Toast'
import AuthProvider from './admin/features/login/context/AuthProvider'

// No router yet - the admin panel lives behind /admin, everything else is
// the client-facing storefront demo.
const isAdminRoute = window.location.pathname.startsWith('/admin')

const Root = () =>
  isAdminRoute ? (
    <AuthProvider>
      <App />
    </AuthProvider>
  ) : (
    <ClientApp />
  )

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <Root />
    </ToastProvider>
  </StrictMode>,
)
