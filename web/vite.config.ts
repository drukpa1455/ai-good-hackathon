import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The FastAPI server supplies the SPA fallback in production; in dev we only
// need the SPA behavior Vite provides by default. /api is proxied so the same
// code path works when a backend appears (VITE_DATA_MODE=api).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api': {
        target: process.env.VITE_API_ORIGIN ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
