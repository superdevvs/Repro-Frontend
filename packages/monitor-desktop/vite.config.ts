import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
import { reviewedBuildGlobGuard } from "../../scripts/build-glob-review.mjs";
const root = fileURLToPath(new URL("../..", import.meta.url));
export default defineConfig({
  root,
  base: "./",
  plugins: [reviewedBuildGlobGuard(), react()],
  resolve: { alias: { "@": `${root}/src` } },
  build: {
    outDir: "packages/monitor-desktop/renderer",
    emptyOutDir: true,
    rollupOptions: { input: `${root}/packages/monitor-desktop/index.html` },
  },
  publicDir: false,
});
