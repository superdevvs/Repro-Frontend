import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

/**
 * Bundle size gate.
 *
 * Two things are enforced and one is only reported:
 *
 *   raw bytes      hard-fails past a cap, with a warning budget below it so the
 *                  build tells you the ceiling is close before it blocks you.
 *   Brotli bytes   hard-fails past a cap, because that is what a browser
 *                  actually downloads. It guards the case raw size cannot see:
 *                  the bundle staying flat while its compressibility degrades.
 *   gzip bytes     reported for the fallback path, not gated.
 *
 * The caps live here rather than in the baseline file so that moving one is a
 * reviewable, deliberate diff. The baseline file records *measurements*, which
 * makes every build print how much the bundle moved since the last accepted
 * state. Growth is reported, never silently failed on — only the caps fail —
 * and the baseline is re-recorded with `--update`, the same ratchet the lint and
 * file-size gates use.
 *
 * Caps were set from a real production build (321,445 B raw / 36,307 B Brotli
 * for the main CSS chunk), not guessed: ~5.8% raw headroom and ~10% Brotli
 * headroom, so the two trip at roughly the same growth and Brotli trips first if
 * the compression ratio regresses.
 */
const MAX_JS_BYTES = Number.parseInt(process.env.MAX_JS_BUNDLE_BYTES ?? '512000', 10);
const MAX_CSS_BYTES = Number.parseInt(process.env.MAX_CSS_BUNDLE_BYTES ?? '340000', 10);
const WARN_CSS_BYTES = Number.parseInt(process.env.WARN_CSS_BUNDLE_BYTES ?? '330000', 10);
const MAX_CSS_BROTLI_BYTES = Number.parseInt(process.env.MAX_CSS_BROTLI_BYTES ?? '40000', 10);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const distAssetsDir = path.join(repoRoot, 'dist', 'assets');
const baselinePath = path.join(repoRoot, 'quality-baseline.json');
const shouldUpdate = process.argv.includes('--update');

const formatSize = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const formatDelta = (bytes) => {
  if (bytes === 0) return 'no change';
  const sign = bytes > 0 ? '+' : '-';
  const abs = Math.abs(bytes);
  return abs < 1024 ? `${sign}${abs} B` : `${sign}${(abs / 1024).toFixed(1)} KB`;
};

const measure = async (fullPath) => {
  const buffer = await fs.readFile(fullPath);
  return {
    raw: buffer.length,
    gzip: zlib.gzipSync(buffer, { level: 9 }).length,
    brotli: zlib.brotliCompressSync(buffer).length,
  };
};

const summarise = (assets) => ({
  largestRaw: assets.reduce((max, a) => Math.max(max, a.raw), 0),
  largestGzip: assets.reduce((max, a) => Math.max(max, a.gzip), 0),
  largestBrotli: assets.reduce((max, a) => Math.max(max, a.brotli), 0),
  totalRaw: assets.reduce((sum, a) => sum + a.raw, 0),
});

const reportDelta = (label, current, previous) => {
  if (previous === undefined) {
    console.log(`  ${label.padEnd(22)} ${formatSize(current).padStart(9)}  (no baseline recorded yet)`);
    return 0;
  }
  const delta = current - previous;
  console.log(
    `  ${label.padEnd(22)} ${formatSize(current).padStart(9)}`
    + `  baseline ${formatSize(previous).padStart(9)}`
    + `  ${formatDelta(delta)}`,
  );
  return delta;
};

const main = async () => {
  const entries = await fs.readdir(distAssetsDir, { withFileTypes: true });
  const assets = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /\.(js|css)$/.test(entry.name))
      .map(async (entry) => ({
        name: entry.name,
        kind: entry.name.endsWith('.css') ? 'css' : 'js',
        ...(await measure(path.join(distAssetsDir, entry.name))),
      })),
  );

  const jsAssets = assets.filter((a) => a.kind === 'js').sort((a, b) => b.raw - a.raw);
  const cssAssets = assets.filter((a) => a.kind === 'css').sort((a, b) => b.raw - a.raw);

  if (jsAssets.length === 0 && cssAssets.length === 0) {
    throw new Error('No built assets found in dist/assets. Run the frontend build before checking bundle sizes.');
  }

  const printTable = (title, list) => {
    console.log(`\n${title}`);
    list.slice(0, 5).forEach((a) => {
      console.log(
        `- ${a.name.padEnd(44)} raw ${formatSize(a.raw).padStart(9)}`
        + `  gzip ${formatSize(a.gzip).padStart(8)}`
        + `  brotli ${formatSize(a.brotli).padStart(8)}`,
      );
    });
  };
  printTable('Largest JS bundles:', jsAssets);
  printTable('Largest CSS bundles:', cssAssets);

  const current = { css: summarise(cssAssets), js: summarise(jsAssets) };

  let baseline = {};
  try {
    baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const recorded = baseline.bundleSizes?.recorded ?? {};

  if (shouldUpdate) {
    baseline.bundleSizes = {
      description:
        'Bundle sizes at the last accepted state. Reported as a delta on every build so growth '
        + 'is visible; the hard caps in scripts/check-bundle-sizes.mjs are what fail a build. '
        + 'Re-record with npm run check:bundle-sizes:update once growth is understood and accepted.',
      updatedAt: new Date().toISOString().slice(0, 10),
      recorded: current,
    };
    await fs.writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    console.log(`\nBaseline re-recorded in ${path.relative(repoRoot, baselinePath)}.`);
  }

  console.log('\nChange since the recorded baseline:');
  const cssRawDelta = reportDelta('CSS largest (raw)', current.css.largestRaw, recorded.css?.largestRaw);
  reportDelta('CSS largest (brotli)', current.css.largestBrotli, recorded.css?.largestBrotli);
  reportDelta('CSS total (raw)', current.css.totalRaw, recorded.css?.totalRaw);
  const jsRawDelta = reportDelta('JS largest (raw)', current.js.largestRaw, recorded.js?.largestRaw);
  reportDelta('JS largest (brotli)', current.js.largestBrotli, recorded.js?.largestBrotli);
  reportDelta('JS total (raw)', current.js.totalRaw, recorded.js?.totalRaw);

  console.log('\nBudgets:');
  console.log(`  JS raw          hard ${formatSize(MAX_JS_BYTES)}`);
  console.log(`  CSS raw         warn ${formatSize(WARN_CSS_BYTES)}   hard ${formatSize(MAX_CSS_BYTES)}`);
  console.log(`  CSS brotli      hard ${formatSize(MAX_CSS_BROTLI_BYTES)}`);

  const oversizedJs = jsAssets.filter((a) => a.raw > MAX_JS_BYTES);
  const oversizedCss = cssAssets.filter((a) => a.raw > MAX_CSS_BYTES);
  const oversizedCssBrotli = cssAssets.filter((a) => a.brotli > MAX_CSS_BROTLI_BYTES);
  const warningCss = cssAssets.filter((a) => a.raw > WARN_CSS_BYTES && a.raw <= MAX_CSS_BYTES);

  if (oversizedJs.length > 0 || oversizedCss.length > 0 || oversizedCssBrotli.length > 0) {
    if (oversizedJs.length > 0) {
      console.error(`\nJS raw bundle cap exceeded (${formatSize(MAX_JS_BYTES)}):`);
      oversizedJs.forEach((a) => console.error(`- ${a.name}: ${formatSize(a.raw)}`));
    }
    if (oversizedCss.length > 0) {
      console.error(`\nCSS raw bundle cap exceeded (${formatSize(MAX_CSS_BYTES)}):`);
      oversizedCss.forEach((a) => console.error(`- ${a.name}: ${formatSize(a.raw)}`));
    }
    if (oversizedCssBrotli.length > 0) {
      console.error(`\nCSS Brotli cap exceeded (${formatSize(MAX_CSS_BROTLI_BYTES)}):`);
      oversizedCssBrotli.forEach((a) => console.error(`- ${a.name}: ${formatSize(a.brotli)} brotli`));
    }
    console.error(
      '\nUnderstand the growth before raising a cap. If it is real and accepted, move the cap in'
      + ' scripts/check-bundle-sizes.mjs and re-record with npm run check:bundle-sizes:update.',
    );
    process.exitCode = 1;
    return;
  }

  if (warningCss.length > 0) {
    console.warn(`\nWarning: CSS is past the ${formatSize(WARN_CSS_BYTES)} budget but under the ${formatSize(MAX_CSS_BYTES)} cap:`);
    warningCss.forEach((a) => console.warn(`- ${a.name}: ${formatSize(a.raw)} raw, ${formatSize(a.brotli)} brotli`));
    console.warn('Not a failure. Treat it as notice that the next few UI changes need the growth understood.');
  }

  if (cssRawDelta > 0 || jsRawDelta > 0) {
    console.log('\nBundle grew since the baseline. If that growth is expected, re-record it with:');
    console.log('  npm run check:bundle-sizes:update');
  }

  console.log('\nBundle size checks passed.');
};

main().catch((error) => {
  console.error('Failed to check bundle sizes:', error);
  process.exitCode = 1;
});
