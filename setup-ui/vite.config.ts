import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// npm run dev: Vite on 5173, /api proxied to `npm run api`; changeOrigin sends the Host the API accepts
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: 'http://127.0.0.1:4319', changeOrigin: true } } },
});
