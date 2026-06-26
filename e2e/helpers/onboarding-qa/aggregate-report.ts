import { readdir, readFile, mkdir } from 'node:fs/promises';
import { join, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createQaReport,
  type CheckEntry,
  type CheckResult,
  type CleanupOutcome,
  type CleanupRecord,
  type Evidence,
  type ReportSummary,
} from './report.ts';
import type { TrackedEntity } from './entity-tracker';

/**
 * Unified QA report aggregator for the photographer onboarding QA suite.
 *
 * This is the report-and-fix wiring from the design (Req 22.4, 22.5, 22.6). Every domain spec
 * module writes its own evidence-backed fragment to `../output/playwright/<module>-report.json`
 * via {@link createQaReport}. This utility reads all of those per-module fragments, merges their
 * check entries and cleanup outcomes into a single evidence-backed `QA_Report`, and writes a
 * unified `qa-report.md` + `qa-report.json` carrying the green/yellow/red summary.
 *
 * Behavior guarantees:
 * - **Continue-on-failure (Req 22.4):** aggregation never throws on a failing (or malformed) entry.
 *   Unreadable or non-conforming fragment files are skipped with a recorded warning rather than
 *   aborting the merge.
 * - **Re-run override / latest-wins (Req 22.5, 22.6):** when the same check `id` appears in more
 *   than one fragment (for example, a re-run after a code fix), the result from the fragment with
 *   the newest `generatedAt` timestamp wins. This mirrors the `override` semantics of
 *   {@link createQaReport} (the latest recorded result for an id wins) while accumulating every
 *   piece of evidence captured across runs.
 * - **Summary (Req 22.1, 22.3):** green only when every check passed *with* associated evidence;
 *   yellow when any check is blocked/skipped and none failed; red when any check failed or a pass
 *   lacks evidence. The summary computation is delegated to {@link createQaReport} so the unified
 *   report and the per-module fragments use identical rules.
 */

/** The on-disk shape written by {@link createQaReport.write} for each per-module fragment. */
interface ModuleReportJson {
  generatedAt?: string;
  summary?: ReportSummary;
  checks?: CheckEntry[];
  createdEntities?: TrackedEntity[];
  cleanup?: CleanupRecord[];
}

/** A per-module fragment paired with the file it came from (for diagnostics + ordering). */
interface LoadedFragment {
  file: string;
  generatedAt: string;
  report: ModuleReportJson;
}

/** The result of an aggregation run (returned to callers; also reflected in `qa-report.json`). */
export interface AggregateResult {
  summary: ReportSummary;
  totals: {
    pass: number;
    fail: number;
    blocked: number;
    skipped: number;
  };
  mergedChecks: number;
  fragments: string[];
  /** Files that could not be parsed/merged — recorded, never thrown (Req 22.4). */
  skippedFiles: { file: string; reason: string }[];
  markdownPath: string;
  jsonPath: string;
}

const VALID_RESULTS: ReadonlySet<CheckResult> = new Set(['pass', 'fail', 'skipped', 'blocked']);
const VALID_OUTCOMES: ReadonlySet<CleanupOutcome> = new Set(['removed', 'skipped', 'failed']);

/** The fragment file names this aggregator emits, so it never re-reads its own output. */
const SELF_OUTPUT_BASENAMES = new Set(['qa-report.json']);

/** True for any per-module fragment file (`*-report.json`) that is not this aggregator's output. */
function isFragmentFile(name: string): boolean {
  return name.endsWith('-report.json') && !SELF_OUTPUT_BASENAMES.has(name);
}

/**
 * Read and merge every per-module `*-report.json` fragment under `dir` into a single unified
 * `QA_Report`, then write `qa-report.md` + `qa-report.json` alongside the fragments.
 *
 * Never throws on a failing or malformed fragment (Req 22.4); problems are collected in
 * {@link AggregateResult.skippedFiles}.
 *
 * @param dir Directory containing the per-module fragments (default `../output/playwright`,
 *            relative to the `frontend/` working directory used by the Playwright suite).
 */
export async function aggregateReports(dir = '../output/playwright'): Promise<AggregateResult> {
  const baseDir = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
  const markdownPath = join(baseDir, 'qa-report.md');
  const jsonPath = join(baseDir, 'qa-report.json');

  const report = createQaReport();
  const skippedFiles: { file: string; reason: string }[] = [];

  // 1. Discover fragment files. A missing directory is itself a non-fatal condition — we still
  //    emit an (empty) unified report so downstream consumers always have a file to read.
  let fileNames: string[] = [];
  try {
    fileNames = (await readdir(baseDir)).filter(isFragmentFile);
  } catch (error) {
    skippedFiles.push({
      file: baseDir,
      reason: `Could not read report directory: ${describeError(error)}`,
    });
  }

  // 2. Load + parse each fragment. Continue-on-failure: a bad file is skipped, not thrown (22.4).
  const fragments: LoadedFragment[] = [];
  for (const name of fileNames.sort()) {
    const filePath = join(baseDir, name);
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as ModuleReportJson;
      fragments.push({
        file: name,
        generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '',
        report: parsed,
      });
    } catch (error) {
      skippedFiles.push({ file: name, reason: describeError(error) });
    }
  }

  // 3. Order fragments oldest → newest so the latest re-run wins on replay (Req 22.5, 22.6).
  //    `generatedAt` is an ISO timestamp; ties fall back to a stable file-name ordering.
  fragments.sort((a, b) => {
    if (a.generatedAt && b.generatedAt && a.generatedAt !== b.generatedAt) {
      return a.generatedAt < b.generatedAt ? -1 : 1;
    }
    return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
  });

  // 4. Replay every fragment's checks + cleanup into the unified report. Because we process in
  //    chronological order and `record` overwrites the result for a repeated id while
  //    `attachEvidence` accumulates, the newest result wins and all evidence is preserved.
  let mergedChecks = 0;
  for (const fragment of fragments) {
    mergeChecks(report, fragment, () => (mergedChecks += 1), skippedFiles);
    mergeCleanup(report, fragment, skippedFiles);
  }

  // 5. Emit the unified bundle. `write` is responsible for creating the directory if needed.
  await mkdir(baseDir, { recursive: true }).catch(() => undefined);
  await report.write(markdownPath, jsonPath);

  const entries = report.entries();
  return {
    summary: report.summary(),
    totals: {
      pass: entries.filter((entry) => entry.result === 'pass').length,
      fail: entries.filter((entry) => entry.result === 'fail').length,
      blocked: entries.filter((entry) => entry.result === 'blocked').length,
      skipped: entries.filter((entry) => entry.result === 'skipped').length,
    },
    mergedChecks,
    fragments: fragments.map((fragment) => fragment.file),
    skippedFiles,
    markdownPath,
    jsonPath,
  };
}

/** Replay one fragment's check entries into the unified report (latest-wins, evidence-merged). */
function mergeChecks(
  report: ReturnType<typeof createQaReport>,
  fragment: LoadedFragment,
  onMerged: () => void,
  skippedFiles: { file: string; reason: string }[],
): void {
  const checks = fragment.report.checks;
  if (!Array.isArray(checks)) {
    return;
  }

  for (const entry of checks) {
    // Defensive validation: a single malformed entry must not abort the whole merge (Req 22.4).
    if (!entry || typeof entry.id !== 'string' || !VALID_RESULTS.has(entry.result)) {
      skippedFiles.push({
        file: fragment.file,
        reason: `Skipped malformed check entry: ${safeStringify(entry)}`,
      });
      continue;
    }

    // Latest result wins for a repeated id (Req 22.6); record before evidence so an unproven
    // pass is still detectable by the summary if no evidence is ever attached (Req 22.3).
    report.record(entry.id, entry.requirement ?? '', entry.result, entry.note);
    if (entry.evidence) {
      report.attachEvidence(entry.id, normalizeEvidence(entry.evidence));
    }
    onMerged();
  }
}

/** Replay one fragment's cleanup outcomes into the unified report (Req 21.5, 22.2). */
function mergeCleanup(
  report: ReturnType<typeof createQaReport>,
  fragment: LoadedFragment,
  skippedFiles: { file: string; reason: string }[],
): void {
  const cleanup = fragment.report.cleanup;
  if (!Array.isArray(cleanup)) {
    return;
  }

  for (const record of cleanup) {
    if (!record || !record.entity || !VALID_OUTCOMES.has(record.outcome)) {
      skippedFiles.push({
        file: fragment.file,
        reason: `Skipped malformed cleanup record: ${safeStringify(record)}`,
      });
      continue;
    }
    report.recordCleanup(record.entity, record.outcome);
  }
}

/** Coerce an arbitrary parsed evidence object into the {@link Evidence} shape `attachEvidence` expects. */
function normalizeEvidence(evidence: Partial<Evidence>): Partial<Evidence> {
  const normalized: Partial<Evidence> = {};
  if (Array.isArray(evidence.screenshots)) normalized.screenshots = evidence.screenshots;
  if (Array.isArray(evidence.consoleLogs)) normalized.consoleLogs = evidence.consoleLogs;
  if (Array.isArray(evidence.networkFailures)) normalized.networkFailures = evidence.networkFailures;
  if (Array.isArray(evidence.apiExcerpts)) normalized.apiExcerpts = evidence.apiExcerpts;
  if (typeof evidence.tracePath === 'string') normalized.tracePath = evidence.tracePath;
  if (typeof evidence.videoPath === 'string') normalized.videoPath = evidence.videoPath;
  return normalized;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** CLI entry point: aggregate the default (or first-arg) directory and print a one-line summary. */
async function main(): Promise<void> {
  const dirArg = process.argv[2] ?? process.env.E2E_QA_OUTPUT_DIR ?? '../output/playwright';
  const result = await aggregateReports(dirArg);

  const badge = { green: '🟢 GREEN', yellow: '🟡 YELLOW', red: '🔴 RED' }[result.summary];
  // eslint-disable-next-line no-console
  console.log(
    `[onboarding-qa] ${badge} — ${result.mergedChecks} check(s) across ` +
      `${result.fragments.length} fragment(s); ` +
      `${result.totals.pass} pass · ${result.totals.fail} fail · ` +
      `${result.totals.blocked} blocked · ${result.totals.skipped} skipped`,
  );
  // eslint-disable-next-line no-console
  console.log(`[onboarding-qa] Wrote ${result.jsonPath} and ${result.markdownPath}`);

  if (result.skippedFiles.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[onboarding-qa] Skipped ${result.skippedFiles.length} item(s) during merge:`);
    for (const skipped of result.skippedFiles) {
      // eslint-disable-next-line no-console
      console.warn(`  - ${skipped.file}: ${skipped.reason}`);
    }
  }
}

// Runnable entry: invoke `main()` only when executed directly (e.g. `node aggregate-report.ts`),
// never when imported by a test or another module. We compare the resolved module file against the
// script Node was asked to run (`process.argv[1]`).
const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  main().catch((error) => {
    // Even the CLI wrapper honors continue-on-failure: report, set a non-zero code, never crash hard.
    // eslint-disable-next-line no-console
    console.error(`[onboarding-qa] Aggregation failed: ${describeError(error)}`);
    process.exitCode = 1;
  });
}
