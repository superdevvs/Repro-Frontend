import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { assertReviewedLock, assertRuntimeSource, isReviewedAdvisory, reviewedBuildGlobGuard, reviewedVersions, reviewExpiresAt } from './build-glob-review.mjs';

const root = new URL('../', import.meta.url);
const reviewedLock = () => ({ packages: Object.fromEntries(Object.entries(reviewedVersions).map(([location, version]) => [location, { version }])) });
const reviewedDate = Date.parse('2026-10-31T00:00:00Z');
const chunk = (id) => ({ 'app.js': { type: 'chunk', modules: { [id]: {} } } });

test('only the reviewed advisory/package pairs qualify', () => {
  assert.equal(isReviewedAdvisory('glob', 'GHSA-3g3m-2fjr-6pw4'), true);
  assert.equal(isReviewedAdvisory('minimatch', 'GHSA-g3hv-75wg-m249'), true);
  assert.equal(isReviewedAdvisory('minimatch', 'GHSA-3g3m-2fjr-6pw4'), false);
  assert.equal(isReviewedAdvisory('glob', 'GHSA-new-unreviewed-advisory'), false);
  assert.equal(isReviewedAdvisory('customer-api', 'GHSA-g3hv-75wg-m249'), false);
});

test('review expires at the explicit cutoff and rejects an invalid clock', () => {
  assert.doesNotThrow(() => assertReviewedLock(reviewedLock(), reviewedDate));
  assert.throws(() => assertReviewedLock(reviewedLock(), Date.parse(reviewExpiresAt)), /expired/);
  assert.throws(() => assertReviewedLock(reviewedLock(), Number.NaN), /expired/);
});

test('version changes, new nested installations, and missing reviewed packages fail closed', () => {
  const changed = reviewedLock();
  changed.packages['node_modules/minimatch'].version = '3.1.6';
  assert.throws(() => assertReviewedLock(changed, reviewedDate), /Unreviewed/);
  const added = reviewedLock();
  added.packages['node_modules/new-tool/node_modules/minimatch'] = { version: '3.1.5' };
  assert.throws(() => assertReviewedLock(added, reviewedDate), /Unreviewed/);
  const removed = reviewedLock();
  delete removed.packages['node_modules/glob'];
  assert.throws(() => assertReviewedLock(removed, reviewedDate), /Unreviewed/);
});

test('current lock exactly matches the reviewed dependency tree', () => {
  const lock = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'));
  assertReviewedLock(lock, reviewedDate);
  assert.equal(lock.packages['node_modules/follow-redirects'].version, '1.16.2');
});

test('static, dynamic, CJS, side effect, subpath and parent-tool runtime imports are refused', () => {
  for (const source of [
    "import { glob } from 'glob';", "export { minimatch } from 'minimatch';",
    "const tool = await import('glob');", "const tool = require('minimatch');",
    "import 'glob';", "require.resolve('glob/dist/commonjs/index.js');",
    "import { build } from 'electron-builder';", "require('@electron/asar');",
  ]) {
    assert.throws(() => assertRuntimeSource('packages/runtime/main.cjs', source), /build tool imported/);
  }
  assert.doesNotThrow(() => assertRuntimeSource('src/page.tsx', "import React from 'react';"));
});

test('only the existing packaging CLI can import electron-builder and runtime cannot import that CLI', () => {
  assert.doesNotThrow(() => assertRuntimeSource('packages/edit-helper/release.cjs', "require('electron-builder')"));
  assert.throws(() => assertRuntimeSource('packages/edit-helper/main.cjs', "require('./release.cjs')"), /Packaging entry/);
  assert.throws(() => assertRuntimeSource('packages\\edit-helper\\main.cjs', "require('./release.cjs')"), /Packaging entry/);
  assert.throws(() => assertRuntimeSource('packages/runtime/main.cjs', "require('@repro/edit-helper/release.cjs')"), /Packaging entry/);
  assert.throws(() => assertRuntimeSource('packages/edit-helper/release.cjs', "require('minimatch')"), /build tool/);
  assert.doesNotThrow(() => assertRuntimeSource('packages/edit-helper/test/release.test.cjs', "require('../release.cjs')"));
  const { releaseOptions } = createRequire(import.meta.url)('../packages/edit-helper/release.cjs');
  const { files } = releaseOptions('win32', 'x64', true, {});
  assert.ok(Array.isArray(files) && files.length > 0, 'The reviewed explicit artifact file allowlist must remain present.');
  for (const file of files) {
    assert.equal(typeof file, 'string');
    assert.doesNotMatch(file, /release\.cjs|\*|node_modules/);
  }
});

test('Rollup gate rejects direct and nested build dependencies including Windows module IDs', () => {
  const guard = reviewedBuildGlobGuard();
  for (const id of [
    '/repo/node_modules/glob/dist/index.js',
    '/repo/node_modules/something/node_modules/minimatch/index.js',
    'C:\\repo\\node_modules\\minimatch\\index.js',
    '\0commonjs-proxy:/repo/node_modules/@electron/asar/lib/asar.js',
  ]) assert.throws(() => guard.generateBundle({}, chunk(id)), /must not ship/);
  assert.doesNotThrow(() => guard.generateBundle({}, chunk('/repo/node_modules/react/index.js')));
});

test('both shipped renderer build configurations keep the module-graph gate', () => {
  for (const config of ['vite.config.ts', 'packages/monitor-desktop/vite.config.ts']) {
    const source = readFileSync(new URL(config, root), 'utf8');
    assert.match(source, /import\s*\{\s*reviewedBuildGlobGuard\s*\}/);
    assert.match(source, /plugins:\s*\[\s*reviewedBuildGlobGuard\(\)/);
  }
});

test('audit still scans CJS/MJS runtime source and preserves the unrelated braces cutoff', () => {
  const audit = readFileSync(new URL('scripts/audit-with-policy.mjs', root), 'utf8');
  assert.match(audit, /sourceExtensions[^\n]*'\.cjs'[^\n]*'\.mjs'/);
  assert.match(audit, /assertRuntimeSource\(path\.relative/);
  assert.match(audit, /2026-11-03T00:00:00Z/);
});
