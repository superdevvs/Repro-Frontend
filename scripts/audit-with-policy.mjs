import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const allowedAdvisory = 'GHSA-qwww-vcr4-c8h2';
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
    if (id.toLowerCase() !== allowedAdvisory.toLowerCase()) {
      unexpected.push(`${packageName}: ${id}`);
    }
  }
}

if (unexpected.length > 0) {
  throw new Error(`npm audit found unapproved advisories:\n${unexpected.map((item) => `- ${item}`).join('\n')}`);
}

const affectedPackages = Object.keys(vulnerabilities).sort();
if (
  affectedPackages.length !== 2 ||
  affectedPackages[0] !== 'react-router' ||
  affectedPackages[1] !== 'react-router-dom'
) {
  throw new Error(
    `Expected only react-router and react-router-dom to be affected; found: ${affectedPackages.join(', ') || 'none'}`,
  );
}

console.log(
  `Audit policy passed. npm reports only ${allowedAdvisory} for Router ${allowedRouterVersion}; ` +
    'the app is a React 18 browser SPA and contains no React Router RSC/framework-mode imports. ' +
    'Use npm run audit:raw to view the non-zero upstream report.',
);
