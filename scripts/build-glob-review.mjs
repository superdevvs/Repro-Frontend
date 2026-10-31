import path from 'node:path';

// Exposure review, not a severity exception. See docs/build-glob-advisory-review.md.
export const reviewExpiresAt = '2026-11-07T00:00:00Z';
export const reviewedAdvisories = {
  'GHSA-3g3m-2fjr-6pw4': [
    '@electron/asar', '@electron/universal', 'app-builder-lib', 'dmg-builder',
    'electron-builder', 'electron-builder-squirrel-windows', 'electron-winstaller',
    'glob', 'rimraf', 'sucrase', 'temp',
  ],
  'GHSA-g3hv-75wg-m249': [
    '@electron/asar', '@electron/universal', '@eslint-community/eslint-utils',
    '@eslint/config-array', '@eslint/eslintrc', '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser', '@typescript-eslint/type-utils',
    '@typescript-eslint/typescript-estree', '@typescript-eslint/utils',
    'app-builder-lib', 'dir-compare', 'dmg-builder', 'ejs', 'electron-builder',
    'electron-builder-squirrel-windows', 'electron-winstaller', 'eslint',
    'eslint-plugin-react-refresh', 'filelist', 'glob', 'jake', 'minimatch',
    'rimraf', 'sucrase', 'temp', 'typescript-eslint',
  ],
};
export const reviewedPackages = new Set(Object.values(reviewedAdvisories).flat());
export const reviewedVersions = {
  'node_modules/@electron/asar': '3.4.1',
  'node_modules/@electron/asar/node_modules/glob': '7.2.3',
  'node_modules/@electron/universal': '2.0.3',
  'node_modules/@electron/universal/node_modules/minimatch': '9.0.9',
  'node_modules/@eslint-community/eslint-utils': '4.10.1',
  'node_modules/@eslint/config-array': '0.21.0',
  'node_modules/@eslint/eslintrc': '3.3.1',
  'node_modules/@typescript-eslint/eslint-plugin': '8.71.1',
  'node_modules/@typescript-eslint/parser': '8.71.1',
  'node_modules/@typescript-eslint/type-utils': '8.71.1',
  'node_modules/@typescript-eslint/typescript-estree': '8.71.1',
  'node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch': '10.2.6',
  'node_modules/@typescript-eslint/utils': '8.71.1',
  'node_modules/app-builder-lib': '26.15.3',
  'node_modules/app-builder-lib/node_modules/minimatch': '10.2.6',
  'node_modules/dir-compare': '4.2.0',
  'node_modules/dmg-builder': '26.15.3',
  'node_modules/ejs': '3.1.10',
  'node_modules/electron-builder': '26.15.3',
  'node_modules/electron-builder-squirrel-windows': '26.15.3',
  'node_modules/electron-winstaller': '5.4.0',
  'node_modules/eslint': '9.34.0',
  'node_modules/eslint-plugin-react-refresh': '0.4.14',
  'node_modules/filelist': '1.0.6',
  'node_modules/filelist/node_modules/minimatch': '5.1.9',
  'node_modules/glob': '10.5.0',
  'node_modules/glob/node_modules/minimatch': '9.0.9',
  'node_modules/jake': '10.9.4',
  'node_modules/minimatch': '3.1.5',
  'node_modules/rimraf': '2.6.3',
  'node_modules/rimraf/node_modules/glob': '7.2.3',
  'node_modules/sucrase': '3.35.0',
  'node_modules/temp': '0.9.4',
  'node_modules/typescript-eslint': '8.71.1',
};

const normalized = (value) => value.replaceAll('\\', '/');
const packageName = (specifier) => specifier.startsWith('@')
  ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
const helperBuildEntry = 'packages/edit-helper/release.cjs';

export function assertReviewedLock(lock, now = Date.now()) {
  if (!Number.isFinite(now) || now >= Date.parse(reviewExpiresAt)) {
    throw new Error('Glob/minimatch build-only advisory review expired; upgrade or reassess exposure.');
  }
  const actual = Object.fromEntries(Object.entries(lock.packages ?? {})
    .filter(([location]) => reviewedPackages.has(location.split('node_modules/').at(-1)))
    .map(([location, value]) => [location, value.version]));
  const keys = new Set([...Object.keys(actual), ...Object.keys(reviewedVersions)]);
  for (const location of keys) {
    if (actual[location] !== reviewedVersions[location]) {
      throw new Error(`Unreviewed build-tool dependency version or location: ${location}`);
    }
  }
}

export function isReviewedAdvisory(packageName, advisoryId) {
  return reviewedAdvisories[advisoryId]?.includes(packageName) ?? false;
}

export function assertRuntimeSource(relativePath, source) {
  const file = normalized(relativePath);
  const imports = source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire(?:\.resolve)?\s*\(\s*)["']([^"']+)["']/g);
  for (const [, specifier] of imports) {
    const name = packageName(specifier);
    // This reviewed packaging CLI is not copied into the helper artifact.
    if (file === helperBuildEntry && name === 'electron-builder') continue;
    if (reviewedPackages.has(name)) {
      throw new Error(`Reviewed build tool imported by application code: ${file}: ${specifier}`);
    }
    const target = specifier.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) : '';
    if ((target === helperBuildEntry || specifier === '@repro/edit-helper/release.cjs')
      && !/(?:^|\/)test\/|\.test\.[cm]?[jt]sx?$/.test(file)) {
      throw new Error(`Packaging entry imported by application code: ${file}`);
    }
  }
}

export function reviewedBuildGlobGuard() {
  return {
    name: 'exclude-reviewed-build-glob-tools',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const id of Object.keys(output.modules)) {
          const modulePath = normalized(id);
          const marker = '/node_modules/';
          const offset = modulePath.lastIndexOf(marker);
          if (offset >= 0 && reviewedPackages.has(packageName(modulePath.slice(offset + marker.length)))) {
            throw new Error(`Reviewed build tool must not ship in an application bundle: ${id}`);
          }
        }
      }
    },
  };
}
