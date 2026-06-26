import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      // Pure/in-memory property + unit tests for the onboarding-qa harness live next to
      // their implementation under e2e/helpers/ (Playwright only matches *.e2e.ts, so these
      // are not picked up by the browser suite).
      "e2e/**/*.{test,spec}.{ts,tsx}",
    ],
    css: false,
  },
});
