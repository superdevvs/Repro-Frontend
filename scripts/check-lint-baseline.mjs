import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

/**
 * Baseline-aware lint gate.
 *
 * Linting itself is NOT relaxed: the full ESLint config still runs over the
 * whole repository with every rule enabled. What this script adds is a ratchet.
 *
 *  - Any violation of a rule that is not baselined below fails the build. That
 *    is the "no new lint violations" contract.
 *  - Rules listed in BASELINED_RULES carry a per-file allowance recorded in
 *    quality-baseline.json. Counts at or below the allowance pass; counts above
 *    it fail when the rule is blocking. This grandfathers the known backlog
 *    without letting it grow.
 *  - Files that improve on their allowance are reported so the baseline can be
 *    ratcheted down with `node scripts/check-lint-baseline.mjs --update`.
 */

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const baselinePath = path.join(repoRoot, 'quality-baseline.json');

// `blocking: true`  -> exceeding the recorded per-file count fails the build.
// `blocking: false` -> drift is reported only, and stays non-blocking for this
//                      release. Flip to true to start enforcing the ratchet.
const BASELINED_RULES = {
  '@typescript-eslint/no-explicit-any': { blocking: true },
  'react-hooks/exhaustive-deps': { blocking: false },
  'react-refresh/only-export-components': { blocking: false },
};

const toRelative = (absolutePath) =>
  path.relative(repoRoot, absolutePath).replaceAll('\\', '/');

const readBaseline = async () => {
  try {
    return JSON.parse(await fs.readFile(baselinePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

/** Collect per-file, per-rule violation counts for the whole repository. */
const collectCounts = async () => {
  const eslint = new ESLint({ cwd: repoRoot });
  const results = await eslint.lintFiles(['.']);

  const baselined = {};
  const blockingViolations = [];

  for (const result of results) {
    const relativePath = toRelative(result.filePath);

    for (const message of result.messages) {
      const ruleId = message.ruleId ?? '(fatal)';

      if (ruleId in BASELINED_RULES) {
        baselined[ruleId] ??= {};
        baselined[ruleId][relativePath] = (baselined[ruleId][relativePath] ?? 0) + 1;
        continue;
      }

      blockingViolations.push({
        relativePath,
        line: message.line,
        ruleId,
        message: message.message,
      });
    }
  }

  return { baselined, blockingViolations };
};

const sortObject = (record) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

const writeBaseline = async (baselined, existing) => {
  const rules = {};
  for (const [ruleId, options] of Object.entries(BASELINED_RULES)) {
    rules[ruleId] = {
      blocking: options.blocking,
      files: sortObject(baselined[ruleId] ?? {}),
    };
  }

  const payload = {
    ...(existing ?? {}),
    lint: {
      description:
        'Per-file allowances for pre-existing lint violations. Counts may fall, never rise.',
      rules,
    },
  };

  await fs.writeFile(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const main = async () => {
  const shouldUpdate = process.argv.includes('--update');
  const existingBaseline = await readBaseline();
  const { baselined, blockingViolations } = await collectCounts();

  if (shouldUpdate) {
    await writeBaseline(baselined, existingBaseline);
    const total = Object.values(baselined).reduce(
      (sum, files) => sum + Object.values(files).reduce((a, b) => a + b, 0),
      0,
    );
    console.log(`Wrote lint baseline for ${total} grandfathered violation(s).`);
    return;
  }

  if (!existingBaseline?.lint?.rules) {
    console.error(
      'No lint baseline found. Generate one with: node scripts/check-lint-baseline.mjs --update',
    );
    process.exitCode = 1;
    return;
  }

  let failed = false;

  // 1. Every non-baselined rule is enforced with zero tolerance.
  if (blockingViolations.length > 0) {
    failed = true;
    console.error(`New lint violations (${blockingViolations.length}) — these block the build:\n`);
    for (const violation of blockingViolations) {
      console.error(
        `  FAIL  ${violation.relativePath}:${violation.line}  ${violation.ruleId}  ${violation.message}`,
      );
    }
    console.error('');
  }

  // 2. Baselined rules are compared per file against their recorded allowance.
  const improvements = [];

  for (const [ruleId, options] of Object.entries(BASELINED_RULES)) {
    const allowances = existingBaseline.lint.rules[ruleId]?.files ?? {};
    const actual = baselined[ruleId] ?? {};
    const regressions = [];

    const paths = new Set([...Object.keys(allowances), ...Object.keys(actual)]);
    let actualTotal = 0;
    let allowedTotal = 0;

    for (const relativePath of [...paths].sort()) {
      const allowed = allowances[relativePath] ?? 0;
      const current = actual[relativePath] ?? 0;
      actualTotal += current;
      allowedTotal += allowed;

      if (current > allowed) {
        regressions.push({ relativePath, allowed, current });
      } else if (current < allowed) {
        improvements.push({ ruleId, relativePath, allowed, current });
      }
    }

    const label = options.blocking ? 'blocking' : 'report-only';
    console.log(`${ruleId} [${label}]: ${actualTotal} violation(s), baseline allows ${allowedTotal}.`);

    if (regressions.length === 0) continue;

    const heading = options.blocking
      ? `  Exceeds baseline in ${regressions.length} file(s) — blocking:`
      : `  Exceeds baseline in ${regressions.length} file(s) — reported only for this release:`;
    console[options.blocking ? 'error' : 'log'](heading);

    for (const regression of regressions) {
      const line = `    ${regression.relativePath}: ${regression.current} (baseline ${regression.allowed})`;
      console[options.blocking ? 'error' : 'log'](line);
    }

    if (options.blocking) failed = true;
  }

  if (improvements.length > 0) {
    console.log(
      `\n${improvements.length} file(s) now beat their baseline. Ratchet it down with:` +
        '\n  node scripts/check-lint-baseline.mjs --update',
    );
  }

  if (failed) {
    console.error('\nLint baseline gate failed.');
    process.exitCode = 1;
    return;
  }

  console.log('\nLint baseline gate passed: no new violations, no baseline regressions.');
};

main().catch((error) => {
  console.error('Failed to run the lint baseline gate:', error);
  process.exitCode = 1;
});
