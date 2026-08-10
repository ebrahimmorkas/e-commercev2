import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxied so the browser sees API calls as same-origin as the frontend page -
      // required for the httpOnly refresh-token cookie (sameSite: 'lax') to be sent
      // back on cross-port fetch calls during local dev.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
