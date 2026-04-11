import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const distAssetsDir = path.join(repoRoot, 'dist', 'assets');

const MAX_JS_BYTES = Number.parseInt(process.env.MAX_JS_BUNDLE_BYTES ?? '1200000', 10);
const MAX_CSS_BYTES = Number.parseInt(process.env.MAX_CSS_BUNDLE_BYTES ?? '325000', 10);

const formatSize = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const main = async () => {
  const entries = await fs.readdir(distAssetsDir, { withFileTypes: true });
  const assets = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const fullPath = path.join(distAssetsDir, entry.name);
        const stats = await fs.stat(fullPath);
        return {
          name: entry.name,
          size: stats.size,
        };
      }),
  );

  const jsAssets = assets.filter((asset) => asset.name.endsWith('.js')).sort((a, b) => b.size - a.size);
  const cssAssets = assets.filter((asset) => asset.name.endsWith('.css')).sort((a, b) => b.size - a.size);

  if (jsAssets.length === 0 && cssAssets.length === 0) {
    throw new Error('No built assets found in dist/assets. Run the frontend build before checking bundle sizes.');
  }

  console.log('Largest JS bundles:');
  jsAssets.slice(0, 5).forEach((asset) => {
    console.log(`- ${asset.name}: ${formatSize(asset.size)}`);
  });

  console.log('\nLargest CSS bundles:');
  cssAssets.slice(0, 5).forEach((asset) => {
    console.log(`- ${asset.name}: ${formatSize(asset.size)}`);
  });

  const oversizedJs = jsAssets.filter((asset) => asset.size > MAX_JS_BYTES);
  const oversizedCss = cssAssets.filter((asset) => asset.size > MAX_CSS_BYTES);

  if (oversizedJs.length > 0 || oversizedCss.length > 0) {
    if (oversizedJs.length > 0) {
      console.error(`\nJS bundle threshold exceeded (${formatSize(MAX_JS_BYTES)}):`);
      oversizedJs.forEach((asset) => console.error(`- ${asset.name}: ${formatSize(asset.size)}`));
    }

    if (oversizedCss.length > 0) {
      console.error(`\nCSS bundle threshold exceeded (${formatSize(MAX_CSS_BYTES)}):`);
      oversizedCss.forEach((asset) => console.error(`- ${asset.name}: ${formatSize(asset.size)}`));
    }

    process.exitCode = 1;
    return;
  }

  console.log(`\nBundle size checks passed. Limits: JS ${formatSize(MAX_JS_BYTES)}, CSS ${formatSize(MAX_CSS_BYTES)}.`);
};

main().catch((error) => {
  console.error('Failed to check bundle sizes:', error);
  process.exitCode = 1;
});
