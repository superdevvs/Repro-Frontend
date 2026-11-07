import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { assertRuntimeSource, reviewedBuildGlobGuard } from './build-glob-review.mjs';

const root = new URL('../', import.meta.url);
const chunk = (id) => ({ 'app.js': { type: 'chunk', modules: { [id]: {} } } });

test('the affected build tools resolve patched minimatch with their existing API', () => {
  const require = createRequire(import.meta.url);
  for (const owner of ['@electron/universal', '@typescript-eslint/typescript-estree', 'app-builder-lib']) {
    const fromOwner = createRequire(require.resolve(owner));
    assert.equal(fromOwner('minimatch/package.json').version, '11.0.5', owner);
    const { minimatch, Minimatch } = fromOwner('minimatch');
    assert.equal(minimatch('assets/.config.json', '*.json', { dot: true, matchBase: true }), true, owner);
    assert.equal(new Minimatch('assets/**', { dot: true }).match('assets/.config.json'), true, owner);
  }
});

test('the lock keeps glob out of Sucrase and uses the patched follow-redirects', () => {
  const lock = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'));
  assert.equal(lock.packages['node_modules/sucrase'].dependencies.glob, undefined);
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

test('audit scans CJS/MJS runtime source and leaves the retired build advisories unapproved', () => {
  const audit = readFileSync(new URL('scripts/audit-with-policy.mjs', root), 'utf8');
  assert.match(audit, /sourceExtensions[^\n]*'\.cjs'[^\n]*'\.mjs'/);
  assert.match(audit, /assertRuntimeSource\(path\.relative/);
  assert.doesNotMatch(audit, /const buildOnlyAdvisory\s*=/);
  assert.doesNotMatch(audit, /buildAllowed/);
  assert.doesNotMatch(audit, /GHSA-(?:vfj7-8cjw-p6xm|3g3m-2fjr-6pw4|g3hv-75wg-m249)/);
});
