import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Google OAuth (web routes) when VITE_API_URL is unset — same origin as Vite in dev
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Laravel public disk (banner uploads, avatars) when VITE_API_URL is unset
      '/storage': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
