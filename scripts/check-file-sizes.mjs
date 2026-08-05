import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The 1000-line policy still applies to every production source file. Files
 * recorded in quality-baseline.json are grandfathered at the exact line count
 * they had when the baseline was taken: they may shrink, but any growth beyond
 * the recorded count fails, and a file that is not in the baseline may never
 * cross the limit. Run with --update to re-record the baseline.
 */
const MAX_LINES = Number.parseInt(process.env.MAX_SOURCE_LINES ?? '1000', 10);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceRoot = path.join(repoRoot, 'src');
const baselinePath = path.join(repoRoot, 'quality-baseline.json');

const readBaseline = async () => {
  try {
    return JSON.parse(await fs.readFile(baselinePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

const isProductionSource = (fileName) => {
  if (!/\.(js|jsx|ts|tsx)$/.test(fileName)) return false;
  if (/\.d\.ts$/.test(fileName)) return false;
  return !/\.(test|spec)\.(js|jsx|ts|tsx)$/.test(fileName);
};

const collectSourceFiles = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'generated') return [];
        return collectSourceFiles(absolutePath);
      }
      return isProductionSource(entry.name) ? [absolutePath] : [];
    }),
  );
  return nested.flat();
};

const countLines = (contents) => {
  if (!contents) return 0;
  return contents.split(/\r\n|\r|\n/).length;
};

const main = async () => {
  const shouldUpdate = process.argv.includes('--update');
  const existingBaseline = await readBaseline();
  const allowances = existingBaseline?.fileSizes?.files ?? {};

  const sourceFiles = await collectSourceFiles(sourceRoot);
  const results = await Promise.all(
    sourceFiles.map(async (absolutePath) => ({
      relativePath: path.relative(repoRoot, absolutePath).replaceAll('\\', '/'),
      lineCount: countLines(await fs.readFile(absolutePath, 'utf8')),
    })),
  );

  const oversized = results
    .filter(({ lineCount }) => lineCount > MAX_LINES)
    .sort((a, b) => b.lineCount - a.lineCount);

  if (shouldUpdate) {
    const files = Object.fromEntries(
      oversized
        .map(({ relativePath, lineCount }) => [relativePath, lineCount])
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    const payload = {
      ...(existingBaseline ?? {}),
      fileSizes: {
        description:
          `Production files above the ${MAX_LINES}-line limit when the baseline was taken. ` +
          'Line counts may fall, never rise, and no new file may be added by growing past the limit.',
        maxLines: MAX_LINES,
        files,
      },
    };
    await fs.writeFile(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote file-size baseline for ${oversized.length} grandfathered file(s).`);
    return;
  }

  const newlyOversized = [];
  const grown = [];
  const grandfathered = [];
  const improved = [];

  for (const entry of oversized) {
    const allowed = allowances[entry.relativePath];
    if (allowed === undefined) {
      newlyOversized.push(entry);
    } else if (entry.lineCount > allowed) {
      grown.push({ ...entry, allowed });
    } else {
      grandfathered.push({ ...entry, allowed });
      if (entry.lineCount < allowed) improved.push({ ...entry, allowed });
    }
  }

  const resolved = Object.keys(allowances).filter(
    (relativePath) => !oversized.some((entry) => entry.relativePath === relativePath),
  );

  if (newlyOversized.length > 0) {
    console.error(`New file(s) over the ${MAX_LINES}-line limit — these block the build:`);
    newlyOversized.forEach(({ lineCount, relativePath }) => {
      console.error(`  FAIL\t${lineCount}\t${relativePath}`);
    });
    console.error('');
  }

  if (grown.length > 0) {
    console.error('File(s) grown beyond their recorded baseline — these block the build:');
    grown.forEach(({ lineCount, allowed, relativePath }) => {
      console.error(`  FAIL\t${lineCount}\t(baseline ${allowed})\t${relativePath}`);
    });
    console.error('');
  }

  if (newlyOversized.length > 0 || grown.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(
    `Checked ${results.length} production source files against the ${MAX_LINES}-line limit.`,
  );
  console.log(
    `${grandfathered.length} file(s) are grandfathered at or below their recorded baseline.`,
  );
  grandfathered
    .sort((a, b) => b.lineCount - a.lineCount)
    .forEach(({ lineCount, allowed, relativePath }) => {
      const suffix = lineCount < allowed ? ` (improved from ${allowed})` : '';
      console.log(`  BASELINE\t${lineCount}\t${relativePath}${suffix}`);
    });

  if (improved.length > 0 || resolved.length > 0) {
    resolved.forEach((relativePath) => {
      console.log(`  RESOLVED\t${relativePath} is now within the limit.`);
    });
    console.log(
      '\nBaseline can be tightened with:\n  node scripts/check-file-sizes.mjs --update',
    );
  }
};

main().catch((error) => {
  console.error('Failed to check file sizes:', error);
  process.exitCode = 1;
});
