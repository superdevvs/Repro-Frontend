import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { TrackedEntity } from './entity-tracker';

/**
 * Evidence-backed QA report collector for the photographer onboarding QA suite.
 *
 * This is harness Component 11 from the design. It accumulates exactly one entry per
 * check (Req 22.1), records a `pass`/`fail`/`blocked`/`skipped` result for each, requires
 * a `pass` to carry associated evidence (Req 22.3), supports continue-on-failure by never
 * throwing on a recorded failure (Req 22.4), and lets a re-run override a prior result so
 * the latest verified state wins (Req 22.6). On `write` it emits the full evidence bundle —
 * a Markdown report, a JSON report, and references to screenshots, the Playwright trace,
 * video-on-failure, console logs, the network-failure list, API response excerpts, the
 * created `QA_Entity` identifiers, and the per-entity cleanup status (Req 22.2, 21.5) — plus
 * a green/yellow/red summary.
 *
 * Artifacts are written under `../output/playwright/` by the caller (consistent with
 * `qa-acceptance.e2e.ts`), which passes the concrete Markdown and JSON paths to {@link QaReport.write}.
 */

/** The result recorded for a single check (Req 22.1). */
export type CheckResult = 'pass' | 'fail' | 'skipped' | 'blocked';

/** The outcome recorded for a single `QA_Entity` during run-scoped cleanup (Req 21.5). */
export type CleanupOutcome = 'removed' | 'skipped' | 'failed';

/**
 * The evidence bundle associated with a check. Screenshots are always an array (possibly
 * empty); the remaining channels are optional and only populated when captured. A
 * `videoPath` is present on failure (Req 22.2).
 */
export interface Evidence {
  screenshots: string[];
  consoleLogs?: string[];
  networkFailures?: string[];
  apiExcerpts?: string[];
  tracePath?: string;
  videoPath?: string;
}

/** One entry per check (Req 22.1), carrying its result, the requirement it covers, and evidence. */
export interface CheckEntry {
  id: string;
  requirement: string; // e.g. "8.3"
  result: CheckResult;
  evidence: Evidence;
  note?: string; // e.g. geocoding/selector dependency for blocked checks
}

/** A per-entity cleanup record included in the report (Req 21.5). */
export interface CleanupRecord {
  entity: TrackedEntity;
  outcome: CleanupOutcome;
}

/** The overall run summary colour (Req 22.1). */
export type ReportSummary = 'green' | 'yellow' | 'red';

export interface QaReport {
  /** Record (or update — latest wins) the result for a check id (Req 22.1, 22.6). */
  record(id: string, requirement: string, result: CheckResult, note?: string): void;
  /** Attach a screenshot path to a check's evidence bundle. */
  attachScreenshot(id: string, path: string): void;
  /** Merge additional evidence channels into a check's evidence bundle. */
  attachEvidence(id: string, evidence: Partial<Evidence>): void;
  /** Re-run override: the latest result for an id wins (Req 22.6). */
  override(id: string, result: CheckResult): void;
  /** Record the cleanup outcome for one `QA_Entity` (Req 21.5). */
  recordCleanup(entity: TrackedEntity, outcome: CleanupOutcome): void;
  /** All recorded check entries, in first-seen order. */
  entries(): CheckEntry[];
  /** All recorded cleanup records, in first-seen order. */
  cleanup(): CleanupRecord[];
  /** Green/yellow/red summary of the run (Req 22.1). */
  summary(): ReportSummary;
  /** Emit the Markdown + JSON evidence bundle to the supplied paths (Req 22.2). */
  write(markdownPath: string, jsonPath: string): Promise<void>;
}

function emptyEvidence(): Evidence {
  return { screenshots: [] };
}

/**
 * True when a check carries at least one piece of evidence on any channel. A `pass` without
 * evidence cannot prove its result (Req 22.3) and is treated as unproven by {@link QaReport.summary}.
 */
function hasEvidence(evidence: Evidence): boolean {
  return (
    evidence.screenshots.length > 0 ||
    (evidence.consoleLogs?.length ?? 0) > 0 ||
    (evidence.networkFailures?.length ?? 0) > 0 ||
    (evidence.apiExcerpts?.length ?? 0) > 0 ||
    Boolean(evidence.tracePath) ||
    Boolean(evidence.videoPath)
  );
}

/** A `pass` entry that lacks any associated evidence (violates the Req 22.3 evidence contract). */
function isUnprovenPass(entry: CheckEntry): boolean {
  return entry.result === 'pass' && !hasEvidence(entry.evidence);
}

export function createQaReport(): QaReport {
  // Map preserves insertion order and guarantees exactly one entry per check id (Req 22.1).
  const checks = new Map<string, CheckEntry>();
  const cleanupRecords: CleanupRecord[] = [];

  function ensureEntry(id: string): CheckEntry {
    let entry = checks.get(id);
    if (!entry) {
      entry = { id, requirement: '', result: 'blocked', evidence: emptyEvidence() };
      checks.set(id, entry);
    }
    return entry;
  }

  return {
    record(id, requirement, result, note) {
      const entry = ensureEntry(id);
      // Latest write wins so a re-run records the latest verified state (Req 22.6); previously
      // attached evidence is preserved unless explicitly overwritten via attachEvidence.
      entry.requirement = requirement;
      entry.result = result;
      if (note !== undefined) {
        entry.note = note;
      }
    },

    attachScreenshot(id, path) {
      const entry = ensureEntry(id);
      if (!entry.evidence.screenshots.includes(path)) {
        entry.evidence.screenshots.push(path);
      }
    },

    attachEvidence(id, evidence) {
      const entry = ensureEntry(id);
      const target = entry.evidence;

      if (evidence.screenshots) {
        for (const path of evidence.screenshots) {
          if (!target.screenshots.includes(path)) {
            target.screenshots.push(path);
          }
        }
      }
      if (evidence.consoleLogs) {
        target.consoleLogs = [...(target.consoleLogs ?? []), ...evidence.consoleLogs];
      }
      if (evidence.networkFailures) {
        target.networkFailures = [...(target.networkFailures ?? []), ...evidence.networkFailures];
      }
      if (evidence.apiExcerpts) {
        target.apiExcerpts = [...(target.apiExcerpts ?? []), ...evidence.apiExcerpts];
      }
      if (evidence.tracePath !== undefined) {
        target.tracePath = evidence.tracePath;
      }
      if (evidence.videoPath !== undefined) {
        target.videoPath = evidence.videoPath;
      }
    },

    override(id, result) {
      // Re-run override: set the latest verified result while keeping the accumulated evidence
      // (Req 22.6). Creating a stub if absent keeps the call order-independent.
      ensureEntry(id).result = result;
    },

    recordCleanup(entity, outcome) {
      cleanupRecords.push({ entity, outcome });
    },

    entries() {
      return [...checks.values()];
    },

    cleanup() {
      return [...cleanupRecords];
    },

    summary() {
      const all = [...checks.values()];
      // A real failure, or a `pass` that cannot be proven with evidence (Req 22.3), is red.
      if (all.some((entry) => entry.result === 'fail') || all.some(isUnprovenPass)) {
        return 'red';
      }
      // Blocked/skipped checks mean the run is incomplete but not failing → yellow.
      if (all.some((entry) => entry.result === 'blocked' || entry.result === 'skipped')) {
        return 'yellow';
      }
      return 'green';
    },

    async write(markdownPath, jsonPath) {
      const all = [...checks.values()];
      const summary = this.summary();
      const totals = {
        pass: all.filter((entry) => entry.result === 'pass').length,
        fail: all.filter((entry) => entry.result === 'fail').length,
        blocked: all.filter((entry) => entry.result === 'blocked').length,
        skipped: all.filter((entry) => entry.result === 'skipped').length,
        unprovenPass: all.filter(isUnprovenPass).length,
      };

      const json = {
        generatedAt: new Date().toISOString(),
        summary,
        totals,
        checks: all,
        createdEntities: cleanupRecords.map((record) => record.entity),
        cleanup: cleanupRecords,
      };

      await mkdir(dirname(jsonPath), { recursive: true });
      await writeFile(jsonPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');

      await mkdir(dirname(markdownPath), { recursive: true });
      await writeFile(markdownPath, renderMarkdown(json), 'utf8');
    },
  };
}

const SUMMARY_BADGE: Record<ReportSummary, string> = {
  green: '🟢 GREEN',
  yellow: '🟡 YELLOW',
  red: '🔴 RED',
};

const RESULT_BADGE: Record<CheckResult, string> = {
  pass: '✅ pass',
  fail: '❌ fail',
  blocked: '🚧 blocked',
  skipped: '⏭️ skipped',
};

interface ReportJson {
  generatedAt: string;
  summary: ReportSummary;
  totals: {
    pass: number;
    fail: number;
    blocked: number;
    skipped: number;
    unprovenPass: number;
  };
  checks: CheckEntry[];
  createdEntities: TrackedEntity[];
  cleanup: CleanupRecord[];
}

function renderMarkdown(report: ReportJson): string {
  const lines: string[] = [];

  lines.push('# Photographer Onboarding QA Report');
  lines.push('');
  lines.push(`**Summary:** ${SUMMARY_BADGE[report.summary]}`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(
    `Totals: ${report.totals.pass} pass · ${report.totals.fail} fail · ` +
      `${report.totals.blocked} blocked · ${report.totals.skipped} skipped`,
  );
  if (report.totals.unprovenPass > 0) {
    lines.push('');
    lines.push(
      `> ⚠️ ${report.totals.unprovenPass} pass(es) lack associated evidence and are counted ` +
        'against the summary (Req 22.3).',
    );
  }
  lines.push('');

  lines.push('## Checks');
  lines.push('');
  if (report.checks.length === 0) {
    lines.push('_No checks recorded._');
  } else {
    lines.push('| Check | Requirement | Result | Evidence | Note |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const entry of report.checks) {
      const evidenceCount = countEvidence(entry.evidence);
      lines.push(
        `| ${escapeCell(entry.id)} | ${escapeCell(entry.requirement)} | ` +
          `${RESULT_BADGE[entry.result]} | ${evidenceCount} item(s) | ${escapeCell(entry.note ?? '')} |`,
      );
    }
  }
  lines.push('');

  lines.push('## Evidence');
  lines.push('');
  if (report.checks.length === 0) {
    lines.push('_No evidence recorded._');
  } else {
    for (const entry of report.checks) {
      lines.push(`### ${entry.id} — ${RESULT_BADGE[entry.result]}`);
      lines.push('');
      renderEvidence(entry.evidence).forEach((line) => lines.push(line));
      lines.push('');
    }
  }

  lines.push('## Created entities');
  lines.push('');
  if (report.createdEntities.length === 0) {
    lines.push('_No QA entities recorded for this run._');
  } else {
    lines.push('| Type | Id | Label |');
    lines.push('| --- | --- | --- |');
    for (const entity of report.createdEntities) {
      lines.push(
        `| ${escapeCell(entity.type)} | ${escapeCell(String(entity.id))} | ` +
          `${escapeCell(entity.label ?? '')} |`,
      );
    }
  }
  lines.push('');

  lines.push('## Cleanup');
  lines.push('');
  if (report.cleanup.length === 0) {
    lines.push('_No cleanup outcomes recorded._');
  } else {
    lines.push('| Type | Id | Label | Outcome |');
    lines.push('| --- | --- | --- | --- |');
    for (const record of report.cleanup) {
      lines.push(
        `| ${escapeCell(record.entity.type)} | ${escapeCell(String(record.entity.id))} | ` +
          `${escapeCell(record.entity.label ?? '')} | ${escapeCell(record.outcome)} |`,
      );
    }
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function countEvidence(evidence: Evidence): number {
  return (
    evidence.screenshots.length +
    (evidence.consoleLogs?.length ?? 0) +
    (evidence.networkFailures?.length ?? 0) +
    (evidence.apiExcerpts?.length ?? 0) +
    (evidence.tracePath ? 1 : 0) +
    (evidence.videoPath ? 1 : 0)
  );
}

function renderEvidence(evidence: Evidence): string[] {
  const lines: string[] = [];

  if (evidence.screenshots.length > 0) {
    lines.push('- Screenshots:');
    evidence.screenshots.forEach((path) => lines.push(`  - \`${path}\``));
  }
  if (evidence.tracePath) {
    lines.push(`- Trace: \`${evidence.tracePath}\``);
  }
  if (evidence.videoPath) {
    lines.push(`- Video: \`${evidence.videoPath}\``);
  }
  if (evidence.consoleLogs && evidence.consoleLogs.length > 0) {
    lines.push(`- Console logs (${evidence.consoleLogs.length}):`);
    evidence.consoleLogs.forEach((log) => lines.push(`  - ${escapeInline(log)}`));
  }
  if (evidence.networkFailures && evidence.networkFailures.length > 0) {
    lines.push(`- Network failures (${evidence.networkFailures.length}):`);
    evidence.networkFailures.forEach((failure) => lines.push(`  - ${escapeInline(failure)}`));
  }
  if (evidence.apiExcerpts && evidence.apiExcerpts.length > 0) {
    lines.push(`- API excerpts (${evidence.apiExcerpts.length}):`);
    evidence.apiExcerpts.forEach((excerpt) => lines.push(`  - ${escapeInline(excerpt)}`));
  }

  if (lines.length === 0) {
    lines.push('_No evidence captured._');
  }

  return lines;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function escapeInline(value: string): string {
  return value.replace(/\n/g, ' ');
}
