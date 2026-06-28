import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import http from "node:http";
import { componentTagger } from "lovable-tagger";

// The PHP built-in dev server (`php artisan serve`) is single-threaded and does
// not handle reused keep-alive sockets well, which surfaces as intermittent
// "Failed to fetch" in the browser. Forcing a fresh, non-pooled connection per
// proxied request makes local dev against it reliable.
const noKeepAliveAgent = new http.Agent({ keepAlive: false, maxSockets: 20 });

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        agent: noKeepAliveAgent,
        headers: { Connection: 'close' },
      },
      '/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ''),
      },
      '/storage': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        agent: noKeepAliveAgent,
        headers: { Connection: 'close' },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
