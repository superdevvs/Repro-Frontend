import path from 'node:path';

const buildOnlyPackages = new Set([
  '@electron/asar', '@electron/universal', '@eslint-community/eslint-utils',
  '@eslint/config-array', '@eslint/eslintrc', '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser', '@typescript-eslint/type-utils',
  '@typescript-eslint/typescript-estree', '@typescript-eslint/utils',
  'app-builder-lib', 'dir-compare', 'dmg-builder', 'ejs', 'electron-builder',
  'electron-builder-squirrel-windows', 'electron-winstaller', 'eslint',
  'eslint-plugin-react-refresh', 'filelist', 'glob', 'jake', 'minimatch',
  'rimraf', 'sucrase', 'temp', 'typescript-eslint',
]);

const normalized = (value) => value.replaceAll('\\', '/');
const packageName = (specifier) => specifier.startsWith('@')
  ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
const helperBuildEntry = 'packages/edit-helper/release.cjs';

export function assertRuntimeSource(relativePath, source) {
  const file = normalized(relativePath);
  const imports = source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire(?:\.resolve)?\s*\(\s*)["']([^"']+)["']/g);
  for (const [, specifier] of imports) {
    const name = packageName(specifier);
    // This reviewed packaging CLI is not copied into the helper artifact.
    if (file === helperBuildEntry && name === 'electron-builder') continue;
    if (buildOnlyPackages.has(name)) {
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
          if (offset >= 0 && buildOnlyPackages.has(packageName(modulePath.slice(offset + marker.length)))) {
            throw new Error(`Reviewed build tool must not ship in an application bundle: ${id}`);
          }
        }
      }
    },
  };
}
