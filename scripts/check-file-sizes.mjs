import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LINES = Number.parseInt(process.env.MAX_SOURCE_LINES ?? '1000', 10);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceRoot = path.join(repoRoot, 'src');

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

  if (oversized.length > 0) {
    oversized.forEach(({ lineCount, relativePath }) => {
      console.error(`FAIL\t${lineCount}\t${relativePath}`);
    });
    console.error(
      `\n${oversized.length} production source file(s) exceed the ${MAX_LINES}-line limit.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Checked ${results.length} production source files; all are within the ${MAX_LINES}-line limit.`,
  );
};

main().catch((error) => {
  console.error('Failed to check file sizes:', error);
  process.exitCode = 1;
});
