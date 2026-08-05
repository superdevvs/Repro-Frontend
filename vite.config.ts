import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import http from "node:http";
import { componentTagger } from "lovable-tagger";

const normalizeModuleId = (id: string) => id.replaceAll("\\", "/");

const vendorChunkName = (id: string): string | undefined => {
  const normalizedId = normalizeModuleId(id);
  const marker = "/node_modules/";
  const markerIndex = normalizedId.lastIndexOf(marker);
  if (markerIndex === -1) return undefined;

  const packagePath = normalizedId.slice(markerIndex + marker.length);
  const segments = packagePath.split("/");
  const packageName = segments[0]?.startsWith("@")
    ? `${segments[0].slice(1)}-${segments[1]}`
    : segments[0];

  if (!packageName) return "vendor-misc";

  if (
    [
      "cookie",
      "detect-node-es",
      "dom-helpers",
      "laravel-echo",
      "pusher-js",
      "set-cookie-parser",
    ].includes(packageName)
  ) {
    return undefined;
  }

  if (
    [
      "react",
      "react-dom",
      "react-router",
      "react-router-dom",
      "remix-run-router",
      "scheduler",
      "tanstack-query-core",
      "tanstack-react-query",
    ].includes(packageName)
  ) {
    return "vendor-react";
  }

  if (
    packageName.startsWith("radix-ui-") ||
    packageName === "cmdk" ||
    packageName === "vaul"
  ) {
    return "vendor-ui";
  }

  if (
    packageName === "framer-motion" ||
    packageName === "motion-dom" ||
    packageName === "motion-utils"
  ) {
    return "vendor-motion";
  }

  if (
    packageName === "recharts" ||
    packageName === "recharts-scale" ||
    packageName === "victory-vendor" ||
    packageName === "react-smooth" ||
    packageName === "decimal-js-light" ||
    packageName.startsWith("d3-")
  ) {
    return "vendor-charts";
  }

  return `vendor-${packageName.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
};

const manualChunkName = (id: string): string | undefined => {
  const vendorChunk = vendorChunkName(id);
  if (vendorChunk) return vendorChunk;

  const normalizedId = normalizeModuleId(id);
  if (normalizedId.includes("/src/components/shoots/tabs/media/")) {
    return "shoot-media";
  }

  return undefined;
};

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
  build: {
    chunkSizeWarningLimit: 500,
    cssMinify: "lightningcss",
    rollupOptions: {
      output: {
        manualChunks: manualChunkName,
        onlyExplicitManualChunks: true,
      },
    },
  },
}));
