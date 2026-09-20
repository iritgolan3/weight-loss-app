/// <reference types="node" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend origin the dev server proxies to. Override with VISIONTRACK_BACKEND.
const BACKEND =
  (typeof process !== 'undefined' && process.env?.VISIONTRACK_BACKEND) || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND, ws: true, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
})
