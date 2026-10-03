import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const allowedAdvisory = 'GHSA-qwww-vcr4-c8h2';
const buildOnlyAdvisory = 'GHSA-vfj7-8cjw-p6xm';
const buildOnlyPackages = new Set([
  'braces', 'micromatch', 'fast-glob', 'chokidar', 'tailwindcss', 'lovable-tagger',
  'typescript-eslint', '@typescript-eslint/eslint-plugin', '@typescript-eslint/parser',
  '@typescript-eslint/type-utils', '@typescript-eslint/typescript-estree', '@typescript-eslint/utils',
]);
const allowedRouterVersion = '7.18.2';
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredDirectories = new Set(['__tests__', 'dist', 'node_modules']);

const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
);
const packageLock = JSON.parse(
  readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'),
);

const frameworkPackages = Object.keys({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
}).filter((name) => name.startsWith('@react-router/'));

if (frameworkPackages.length > 0) {
  throw new Error(
    `Router audit exception is SPA-only; framework packages are not allowed: ${frameworkPackages.join(', ')}`,
  );
}

const installedRouterDomVersion =
  packageLock.packages?.['node_modules/react-router-dom']?.version;
const installedRouterVersion = packageLock.packages?.['node_modules/react-router']?.version;

if (
  packageJson.dependencies?.['react-router-dom'] !== allowedRouterVersion ||
  installedRouterDomVersion !== allowedRouterVersion ||
  installedRouterVersion !== allowedRouterVersion
) {
  throw new Error(
    `The narrowly reviewed Router exception only covers react-router-dom/react-router ${allowedRouterVersion}.`,
  );
}

const sourceFiles = [];
const collectSourceFiles = (directory) => {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const absolutePath = path.join(directory, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      collectSourceFiles(absolutePath);
    } else if (sourceExtensions.has(path.extname(entry))) {
      sourceFiles.push(absolutePath);
    }
  }
};

collectSourceFiles(path.join(projectRoot, 'src'));
collectSourceFiles(path.join(projectRoot, 'packages'));

// Temporary exposure-based review, not a general high-severity exception.
// These tools consume repository-controlled build patterns only. See the review
// and the complementary Rollup module-graph guard in vite.config.ts.
if (Date.now() >= Date.parse('2026-11-03T00:00:00Z')) {
  throw new Error('Build-only braces advisory review expired; upgrade or reassess exposure.');
}
for (const [name, version] of [['braces', '3.0.3'], ['micromatch', '4.0.8']]) {
  if (packageLock.packages?.[`node_modules/${name}`]?.version !== version) {
    throw new Error(`Build-only advisory review requires ${name} ${version}.`);
  }
}
const buildToolImport = /(?:from\s*|import\s*\(|require\s*\()\s*["'](?:braces|micromatch|fast-glob|chokidar|tailwindcss|lovable-tagger|typescript-eslint|@typescript-eslint\/[^/"']+)(?:\/[^"']*)?["']/;
for (const file of sourceFiles) {
  if (buildToolImport.test(readFileSync(file, 'utf8'))) {
    throw new Error(`Build-only dependency imported by application code: ${file}`);
  }
}

const prohibitedImport = /(?:from\s*|import\s*\(|require\s*\()\s*["'](?:react-router(?:-dom)?\/(?:rsc|dom\/server|server)|@react-router\/)[^"']*["']/;
const prohibitedRscApi = /\b(?:RSCRouter|RSCStaticRouter|createCallServer|getRSCStream|routeRSCServerRequest|unstable_[A-Za-z0-9_]*RSC[A-Za-z0-9_]*)\b/;
const unsafeFiles = sourceFiles.filter((file) => {
  const source = readFileSync(file, 'utf8');
  return prohibitedImport.test(source) || prohibitedRscApi.test(source);
});

if (unsafeFiles.length > 0) {
  throw new Error(
    `Router audit exception is invalid when RSC/server APIs are imported:\n${unsafeFiles
      .map((file) => `- ${path.relative(projectRoot, file)}`)
      .join('\n')}`,
  );
}

let auditOutput;
try {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error('npm_execpath is unavailable; run this policy through npm run audit.');
  }
  auditOutput = execFileSync(process.execPath, [npmCli, 'audit', '--json'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  auditOutput = error.stdout;
  if (!auditOutput) {
    throw new Error(`npm audit did not return JSON: ${error.stderr || error.message}`);
  }
}

const report = JSON.parse(auditOutput);
const vulnerabilities = report.vulnerabilities ?? {};

const advisoryIdsFor = (packageName, seen = new Set()) => {
  if (seen.has(packageName)) return new Set();
  seen.add(packageName);

  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability) return new Set();

  const ids = new Set();
  for (const cause of vulnerability.via ?? []) {
    if (typeof cause === 'string') {
      for (const id of advisoryIdsFor(cause, seen)) ids.add(id);
      continue;
    }

    const match = cause.url?.match(/GHSA-[a-z0-9-]+/i);
    ids.add(match?.[0] ?? `npm-advisory-${cause.source ?? 'unknown'}`);
  }
  return ids;
};

const unexpected = [];
for (const packageName of Object.keys(vulnerabilities)) {
  const ids = advisoryIdsFor(packageName);
  if (ids.size === 0) {
    unexpected.push(`${packageName}: advisory cause could not be resolved`);
    continue;
  }
  for (const id of ids) {
    const routerAllowed = id === allowedAdvisory && ['react-router', 'react-router-dom'].includes(packageName);
    const buildAllowed = id === buildOnlyAdvisory && buildOnlyPackages.has(packageName);
    if (!routerAllowed && !buildAllowed) {
      unexpected.push(`${packageName}: ${id}`);
    }
  }
}

if (unexpected.length > 0) {
  throw new Error(`npm audit found unapproved advisories:\n${unexpected.map((item) => `- ${item}`).join('\n')}`);
}

// The approved packages are an upper bound, not an exact expectation: anything
// outside this set is unreviewed and must fail, but an empty report means the
// advisory has cleared upstream and is strictly better than the reviewed state.
const approvedPackages = new Set(['react-router', 'react-router-dom', ...buildOnlyPackages]);
const affectedPackages = Object.keys(vulnerabilities).sort();
const unapprovedPackages = affectedPackages.filter((name) => !approvedPackages.has(name));

if (unapprovedPackages.length > 0) {
  throw new Error(
    `Only the explicitly reviewed Router and build-tool packages are covered; ` +
      `also affected: ${unapprovedPackages.join(', ')}`,
  );
}

if (affectedPackages.length === 0) {
  console.log(
    `Audit policy passed. npm reports no vulnerabilities: ${allowedAdvisory} is no longer ` +
      `flagged for Router ${allowedRouterVersion}. The exception in this script is now dormant ` +
      'and can be deleted once upstream confirms the advisory no longer applies.',
  );
} else {
  console.log(
    'Audit policy passed with only explicitly reviewed, exposure-constrained advisories. ' +
      `Router ${allowedRouterVersion} is SPA-only; braces is restricted to repository-controlled build tools until 2026-11-03. ` +
      'Use npm run audit:raw to view the non-zero upstream report.',
  );
}
