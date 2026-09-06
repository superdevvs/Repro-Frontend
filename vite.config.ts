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
  // Axios errors retain headers/body for callers. Never let legacy console
  // statements serialize those objects into production browser diagnostics.
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    // jsPDF aliases the browser global, so its error logger is not matched by
    // esbuild's direct console removal. Suppress that known diagnostic namespace.
    pure: mode === 'production' ? ['globalObject.console.error', 'globalObject.console.error.apply'] : [],
  },
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
    mode === 'production' && {
      name: 'private-jspdf-diagnostics',
      enforce: 'pre' as const,
      transform(code: string, id: string) {
        // The published jsPDF entry is already minified, so its browser-global
        // alias no longer has a stable name. Annotate just its diagnostic calls.
        if (!normalizeModuleId(id).includes('/node_modules/jspdf/dist/jspdf.es')) return null;
        return {
          code: code.replace(/\b([A-Za-z_$][\w$]*\.console\.error(?:\.apply)?)\s*\(/g, '/* @__PURE__ */ $1('),
          map: null,
        };
      },
    },
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
