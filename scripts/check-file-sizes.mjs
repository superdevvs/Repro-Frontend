import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LINES = 1000;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const targets = [
  'src/components/shoots/tabs/media/useShootDetailsMediaTab.tsx',
  'src/pages/ShootHistory.tsx',
  'src/components/shoots/history/ShootHistoryOperationalRows.tsx',
  'src/components/shoots/ShootDetailsModal.tsx',
  'src/components/shoots/tabs/ShootDetailsTourTab.tsx',
  'src/pages/ShootDetails.tsx',
];

const countLines = (contents) => {
  if (!contents) return 0;
  return contents.split(/\r\n|\r|\n/).length;
};

const checkTarget = async (relativePath) => {
  const absolutePath = path.join(repoRoot, relativePath);
  const contents = await fs.readFile(absolutePath, 'utf8');
  const lineCount = countLines(contents);
  return {
    relativePath,
    lineCount,
    exceedsLimit: lineCount > MAX_LINES,
  };
};

const main = async () => {
  const results = await Promise.all(targets.map(checkTarget));
  let hasFailure = false;

  for (const result of results) {
    const label = result.exceedsLimit ? 'FAIL' : 'PASS';
    console.log(`${label}\t${result.lineCount}\t${result.relativePath}`);
    if (result.exceedsLimit) {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    console.error(`\nOne or more tracked shoot-flow files exceed the ${MAX_LINES}-line limit.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll tracked shoot-flow files are within the ${MAX_LINES}-line limit.`);
};

main().catch((error) => {
  console.error('Failed to check file sizes:', error);
  process.exitCode = 1;
});
