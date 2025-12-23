import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://192.168.100.100:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    },
  },
})
