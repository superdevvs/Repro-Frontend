import { join } from 'node:path';

import {
  expect,
  test,
  type Browser,
  type Page,
} from '@playwright/test';

import { loginAsAdmin } from '../helpers/auth';
import { resolveQaEnv, type QaEnv } from '../helpers/onboarding-qa/env';
import { createQaReport, type QaReport } from '../helpers/onboarding-qa/report';
import {
  VIEWPORTS,
  createUiProbe,
  type UiProbe,
  type UiSignals,
  type Viewport,
} from '../helpers/onboarding-qa/ui-probe';

/**
 * Measurable UI consistency & viewport QA module — Requirement 14, design module
 * `onboarding/ui-consistency.e2e.ts`.
 *
 * This module drives the shared `ui-probe` (harness Component 9) across the four onboarding
 * `Viewport`s (Desktop 1440x900, Laptop 1280x800, Tablet 768x1024, Mobile 390x844 — Req 14.11)
 * on a fixed set of **authenticated onboarding surfaces** and then **interprets** the raw
 * {@link UiSignals} the probe returns into per-criterion `pass`/`fail`/`blocked` verdicts recorded
 * on the evidence-backed {@link QaReport}. The probe captures signals and attaches the
 * screenshot/console/network evidence (Req 14.12 + supporting evidence); this SPEC owns the
 * verdict, exactly as the design splits the two responsibilities.
 *
 * Criteria interpreted from the signal set:
 *  - 14.1  no console error                       → `consoleErrors` is empty.
 *  - 14.2  no failed network request (allow-list)  → `failedRequests` is empty (the probe already
 *          excludes any URL matching the allow-list; see {@link ALLOWED_FAILURES}).
 *  - 14.3  no React crash boundary                 → `reactCrashBoundary` is false.
 *  - 14.4  no horizontal overflow @ mobile         → `horizontalOverflow` is false at Mobile 390x844.
 *  - 14.5  defined empty state (no-data surface)    → see "passive-navigation" note below.
 *  - 14.6  no duplicate primary action button      → `duplicatePrimaryButtons === 0`.
 *  - 14.7  consistent status-badge text            → `statusBadgeText` identical across viewports.
 *  - 14.8  no hidden required field                → `hiddenRequiredFields` is empty.
 *  - 14.9  no stale data after a save               → see "passive-navigation" note below.
 *  - 14.10 action feedback present                  → see "passive-navigation" note below.
 *  - 14.11 execute across the four viewports        → all four `VIEWPORTS` were probed.
 *  - 14.12 screenshot each surface at each viewport → a screenshot artifact per surface/viewport.
 *
 * Passive-navigation note (Req 14.5 / 14.9 / 14.10)
 * -------------------------------------------------
 * This module performs a **read-only** pass: it logs in as admin and navigates onboarding
 * surfaces, but it does NOT seed an empty data set, trigger a save, or fire an action. Three
 * signals are therefore not deterministically observable on a passive navigation and are recorded
 * as `Blocked_Check`s with the missing dependency noted (the observed signal value is still
 * captured as evidence), rather than failing:
 *  - 14.5 needs a surface guaranteed to have no data (an empty-state precondition).
 *  - 14.9 needs a completed save to assert the absence of stale data.
 *  - 14.10 needs a triggered action to assert loading/success/error feedback.
 * A later task (or the report-and-fix loop) can promote these to active checks once the relevant
 * actions are scripted.
 *
 * Safety
 * ------
 * Strictly READ-ONLY (login + navigate). The suite must NOT be pointed at live production; an
 * operator points `E2E_BASE_URL` at a non-prod QA target. When the target is unreachable the
 * affected surface/viewport checks are recorded `blocked` (blocked-and-continue, never blocking on
 * human input) and the Playwright test is skipped.
 */

const env: QaEnv = resolveQaEnv();
const report: QaReport = createQaReport();
const uiProbe: UiProbe = createUiProbe(report);

/** Where evidence artifacts are written (consistent with the rest of the suite). */
const OUTPUT_DIR = '../output/playwright';
const REPORT_MD = `${OUTPUT_DIR}/ui-consistency-report.md`;
const REPORT_JSON = `${OUTPUT_DIR}/ui-consistency-report.json`;

/**
 * Known-benign failing requests (analytics / third-party endpoints) that must NOT count against
 * Req 14.1/14.2. These are third-party hosts the app calls opportunistically (e.g. IP-geolocation)
 * that are CORS-blocked or unreachable from a localhost test origin — a third-party transport
 * failure, not an app defect. Defaults below are always applied; additional comma-separated URL
 * substrings can be supplied via `E2E_UI_ALLOWED_FAILURES`.
 */
const DEFAULT_ALLOWED_FAILURES: string[] = [
  'ipapi.co', // opportunistic IP-geolocation lookup; CORS-blocked from localhost test origin.
];

const ALLOWED_FAILURES: string[] = [
  ...DEFAULT_ALLOWED_FAILURES,
  ...(process.env.E2E_UI_ALLOWED_FAILURES ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0),
];

/** An authenticated onboarding surface to probe. */
interface Surface {
  /** Stable id used in check ids and screenshot filenames. */
  id: string;
  /** Route navigated relative to `baseURL` (verified to exist in `frontend/src/App.tsx`). */
  route: string;
  /** Human-readable surface label for report evidence. */
  label: string;
}

/**
 * The authenticated onboarding surfaces probed across every viewport. These are stable,
 * admin-reachable list/settings surfaces in the onboarding journey (verified against the route
 * table in `frontend/src/App.tsx`). Override any route via env without touching code.
 */
const SURFACES: readonly Surface[] = [
  {
    id: 'dashboard',
    route: process.env.E2E_UI_DASHBOARD_ROUTE ?? '/dashboard',
    label: 'Photographer/admin dashboard (onboarding landing surface)',
  },
  {
    id: 'shoots-list',
    route: process.env.E2E_UI_SHOOTS_ROUTE ?? '/shoot-history',
    label: 'Shoots list (shoot-history) surface',
  },
  {
    id: 'settings',
    route: process.env.E2E_UI_SETTINGS_ROUTE ?? '/settings',
    label: 'Settings surface',
  },
] as const;

/** Result of probing one surface at one viewport. */
interface ViewportResult {
  vp: Viewport;
  signals: UiSignals;
  /** False when the surface could not be reached at this viewport (blocked-and-continue). */
  reachable: boolean;
  /** Dependency note when not reachable. */
  note?: string;
}

/** Mirror the probe's screenshot-filename derivation so verdict checks can attach the artifact. */
function screenshotPathFor(surfaceCheckId: string): string {
  const sanitized =
    surfaceCheckId.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'surface';
  return `${OUTPUT_DIR}/ui-${sanitized}.png`;
}

/** A compact, human-readable summary of a viewport's signals for report evidence. */
function signalSummary(surface: Surface, vp: Viewport, signals: UiSignals): string {
  return (
    `${surface.label} @ ${vp.name} ${vp.width}x${vp.height}: ` +
    `consoleErrors=${signals.consoleErrors.length}, ` +
    `failedRequests=${signals.failedRequests.length}, ` +
    `reactCrashBoundary=${signals.reactCrashBoundary}, ` +
    `horizontalOverflow=${signals.horizontalOverflow}, ` +
    `emptyStateRendered=${signals.emptyStateRendered}, ` +
    `duplicatePrimaryButtons=${signals.duplicatePrimaryButtons}, ` +
    `statusBadgeText=${signals.statusBadgeText === null ? '<none>' : JSON.stringify(signals.statusBadgeText)}, ` +
    `hiddenRequiredFields=[${signals.hiddenRequiredFields.join(', ')}], ` +
    `staleData=${signals.staleData}, ` +
    `actionFeedback=${signals.actionFeedback}`
  );
}

/** Module-level auth state established once in beforeAll. */
let authReady = false;
let setupNote = '';
/** Reused authenticated storage state so each per-viewport context skips re-login. */
let storageState: Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['storageState']>> | undefined;

test.describe.serial('Requirement 14 — measurable UI consistency across viewports', () => {
  test.beforeAll(async ({ browser }) => {
    try {
      const context = await browser.newContext({ baseURL: env.baseUrl });
      const page = await context.newPage();
      await loginAsAdmin(page, env.adminEmail, env.adminPassword);
      // Capture the authenticated storage state (localStorage bearer token) so each per-viewport
      // context navigates already authenticated without re-running the login form four times.
      storageState = await context.storageState();
      authReady = true;
      await context.close();
    } catch (error) {
      setupNote =
        `Admin authentication/target unreachable at ${env.baseUrl}: ${(error as Error).message}`;
      authReady = false;
    }
  });

  test.afterAll(async () => {
    // Repo-root output dir (matches the aggregator + every other module): ../output/playwright.
    const outDir = OUTPUT_DIR;
    await report
      .write(join(outDir, 'ui-consistency-report.md'), join(outDir, 'ui-consistency-report.json'))
      .catch(() => undefined);
  });

  for (const surface of SURFACES) {
    test(`14.x — measurable UI signals across viewports on the ${surface.id} surface`, async ({
      browser,
    }) => {
      // ---- Target unreachable → block every Req 14 criterion for this surface and continue. ----
      if (!authReady || !storageState) {
        blockAllCriteria(
          surface,
          setupNote || 'Admin context unavailable — UI surface not probed.',
        );
        test.skip(true, setupNote || 'Target unavailable.');
        return;
      }

      // ---- Probe the surface across all four viewports (Req 14.11). --------------------------
      const results = await collectSurfaceSignals(browser, surface);

      // ---- 14.1/14.2/14.3/14.6/14.8 — evaluated per viewport. --------------------------------
      for (const { vp, signals, reachable, note } of results) {
        const suffix = `${surface.id}-${vp.name}`;
        const surfaceCheckId = `${surface.id}@${vp.name}`;
        const screenshot = screenshotPathFor(surfaceCheckId);
        const summary = signalSummary(surface, vp, signals);

        if (!reachable) {
          for (const req of ['14.1', '14.2', '14.3', '14.6', '14.8']) {
            record(
              `${req}-${suffix}`,
              req,
              'blocked',
              note ?? `Surface "${surface.route}" unreachable at the ${vp.name} viewport.`,
              [summary],
            );
          }
          continue;
        }

        // 14.1 — no console error on navigation.
        record(
          `14.1-${suffix}`,
          '14.1',
          signals.consoleErrors.length === 0 ? 'pass' : 'fail',
          signals.consoleErrors.length === 0
            ? 'No console error on the navigated surface.'
            : `Console error(s) observed: ${signals.consoleErrors.join(' | ')}`,
          [summary],
          screenshot,
        );

        // 14.2 — no failed network request other than the allow-list (probe is allow-list aware).
        record(
          `14.2-${suffix}`,
          '14.2',
          signals.failedRequests.length === 0 ? 'pass' : 'fail',
          signals.failedRequests.length === 0
            ? `No failed network request (allow-list: ${ALLOWED_FAILURES.length} entr${ALLOWED_FAILURES.length === 1 ? 'y' : 'ies'}).`
            : `Failed network request(s) outside the allow-list: ${signals.failedRequests.join(' | ')}`,
          [summary],
          screenshot,
        );

        // 14.3 — no React crash boundary displayed.
        record(
          `14.3-${suffix}`,
          '14.3',
          signals.reactCrashBoundary ? 'fail' : 'pass',
          signals.reactCrashBoundary
            ? 'A React crash/error boundary is displayed on the surface.'
            : 'No React crash boundary displayed.',
          [summary],
          screenshot,
        );

        // 14.6 — no duplicate primary action button.
        record(
          `14.6-${suffix}`,
          '14.6',
          signals.duplicatePrimaryButtons === 0 ? 'pass' : 'fail',
          signals.duplicatePrimaryButtons === 0
            ? 'No duplicate primary action button.'
            : `${signals.duplicatePrimaryButtons} duplicate primary action button(s) rendered.`,
          [summary],
          screenshot,
        );

        // 14.8 — no hidden required field on the form.
        record(
          `14.8-${suffix}`,
          '14.8',
          signals.hiddenRequiredFields.length === 0 ? 'pass' : 'fail',
          signals.hiddenRequiredFields.length === 0
            ? 'No hidden required field exposed on the surface.'
            : `Hidden required field(s): ${signals.hiddenRequiredFields.join(', ')}`,
          [summary],
          screenshot,
        );

        // 14.4 — horizontal overflow is only meaningful at the Mobile 390x844 viewport.
        if (vp.name === 'mobile') {
          record(
            `14.4-${suffix}`,
            '14.4',
            signals.horizontalOverflow ? 'fail' : 'pass',
            signals.horizontalOverflow
              ? 'Horizontal overflow detected at the Mobile 390x844 viewport.'
              : 'No horizontal overflow at the Mobile 390x844 viewport.',
            [summary],
            screenshot,
          );
        }
      }

      const reachableResults = results.filter((result) => result.reachable);

      // ---- 14.7 — consistent status-badge text across viewports for this surface. ------------
      evaluateBadgeConsistency(surface, reachableResults);

      // ---- 14.5 / 14.9 / 14.10 — not observable on a passive read-only navigation. -----------
      evaluatePassiveSignals(surface, reachableResults);

      // ---- 14.11 — executed across all four viewports. ---------------------------------------
      const probedViewports = results.map((result) => result.vp.name);
      const allFour = VIEWPORTS.every((vp) => probedViewports.includes(vp.name));
      record(
        `14.11-${surface.id}`,
        '14.11',
        allFour ? 'pass' : 'fail',
        allFour
          ? `UI checks executed at all four viewports: ${probedViewports.join(', ')}.`
          : `Missing viewport(s); probed only: ${probedViewports.join(', ')}.`,
        [`viewports probed: ${probedViewports.join(', ')}`],
      );
      expect(probedViewports, 'all four onboarding viewports must be probed').toHaveLength(
        VIEWPORTS.length,
      );

      // ---- 14.12 — a screenshot per surface per viewport. ------------------------------------
      const shots = reachableResults.map((result) =>
        screenshotPathFor(`${surface.id}@${result.vp.name}`),
      );
      const checkId1412 = `14.12-${surface.id}`;
      for (const shot of shots) {
        report.attachScreenshot(checkId1412, shot);
      }
      if (reachableResults.length === 0) {
        record(
          checkId1412,
          '14.12',
          'blocked',
          'No viewport was reachable, so no screenshot could be captured.',
          [`surface=${surface.label}`],
        );
      } else {
        record(
          checkId1412,
          '14.12',
          reachableResults.length === VIEWPORTS.length ? 'pass' : 'blocked',
          reachableResults.length === VIEWPORTS.length
            ? `Captured a screenshot of the ${surface.id} surface at each of the four viewports.`
            : `Captured screenshots at ${reachableResults.length}/${VIEWPORTS.length} viewports ` +
                '(remaining viewports were unreachable).',
          [`screenshots: ${shots.join(', ')}`],
        );
      }
    });
  }
});

/**
 * Probe a single surface across all four {@link VIEWPORTS}, opening an authenticated context sized
 * to each viewport so signals (notably horizontal overflow) reflect the viewport. Navigation
 * failures degrade to an unreachable {@link ViewportResult} (blocked-and-continue) and never throw.
 */
async function collectSurfaceSignals(
  browser: Browser,
  surface: Surface,
): Promise<ViewportResult[]> {
  const results: ViewportResult[] = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      baseURL: env.baseUrl,
      storageState,
      viewport: { width: vp.width, height: vp.height },
    });
    const page: Page = await context.newPage();
    const surfaceCheckId = `${surface.id}@${vp.name}`;

    let reachable = true;
    let note: string | undefined;
    try {
      await page.goto(surface.route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    } catch {
      reachable = false;
      note = `Surface "${surface.route}" was not reachable at the ${vp.name} viewport.`;
    }

    // The probe captures signals + attaches screenshot/console/network evidence under the per
    // surface/viewport check id, and is allow-list aware for failed requests (Req 14.2). It never
    // throws on a flaky surface, degrading to empty/none signals instead.
    const signals = await uiProbe
      .probe(page, surfaceCheckId, ALLOWED_FAILURES)
      .catch(
        (): UiSignals => ({
          viewport: null,
          consoleErrors: [],
          failedRequests: [],
          reactCrashBoundary: false,
          horizontalOverflow: false,
          emptyStateRendered: false,
          duplicatePrimaryButtons: 0,
          statusBadgeText: null,
          hiddenRequiredFields: [],
          staleData: false,
          actionFeedback: 'none',
        }),
      );

    results.push({ vp, signals: { ...signals, viewport: vp }, reachable, note });
    await context.close().catch(() => undefined);
  }

  return results;
}

/**
 * 14.7 — a given surface must render the same status-badge text regardless of viewport
 * (responsive consistency). When no badge is present on the surface, the check is recorded
 * `blocked` with the dependency noted (no Booking_Status badge to compare).
 */
function evaluateBadgeConsistency(surface: Surface, results: ViewportResult[]): void {
  const checkId = `14.7-${surface.id}`;
  const badges = results
    .map((result) => ({ vp: result.vp.name, text: result.signals.statusBadgeText }))
    .filter((entry): entry is { vp: string; text: string } => entry.text !== null);

  if (results.length === 0) {
    record(checkId, '14.7', 'blocked', 'Surface unreachable — status badge not inspected.');
    return;
  }
  if (badges.length === 0) {
    record(
      checkId,
      '14.7',
      'blocked',
      'No status badge present on this surface; cross-surface Booking_Status consistency needs a ' +
        'seeded shoot in a known Booking_Status.',
      [`${surface.label}: statusBadgeText=<none> at all viewports`],
    );
    return;
  }

  const distinct = [...new Set(badges.map((entry) => entry.text))];
  record(
    checkId,
    '14.7',
    distinct.length === 1 ? 'pass' : 'fail',
    distinct.length === 1
      ? `Status-badge text is consistent across viewports: ${JSON.stringify(distinct[0])}.`
      : `Status-badge text differs across viewports: ${badges
          .map((entry) => `${entry.vp}=${JSON.stringify(entry.text)}`)
          .join(', ')}`,
    badges.map((entry) => `${entry.vp}: ${JSON.stringify(entry.text)}`),
  );
}

/**
 * 14.5 / 14.9 / 14.10 — these signals require, respectively, a guaranteed no-data surface, a
 * completed save, and a triggered action. None are deterministically observable on this module's
 * passive read-only navigation, so each is recorded `blocked` with the dependency noted while the
 * observed signal value (from the desktop probe) is still captured as evidence.
 */
function evaluatePassiveSignals(surface: Surface, results: ViewportResult[]): void {
  const desktop = results.find((result) => result.vp.name === 'desktop') ?? results[0];

  const emptyObserved = desktop ? desktop.signals.emptyStateRendered : false;
  record(
    `14.5-${surface.id}`,
    '14.5',
    'blocked',
    'Empty-state verification requires a surface guaranteed to have no data; not observable on a ' +
      `read-only navigation (observed emptyStateRendered=${emptyObserved}).`,
    [`${surface.label}: emptyStateRendered=${emptyObserved}`],
  );

  const staleObserved = desktop ? desktop.signals.staleData : false;
  record(
    `14.9-${surface.id}`,
    '14.9',
    'blocked',
    'Stale-data-after-save verification requires a completed save; not triggered by this read-only ' +
      `navigation (observed staleData=${staleObserved}).`,
    [`${surface.label}: staleData=${staleObserved}`],
  );

  const feedbackObserved = desktop ? desktop.signals.actionFeedback : 'none';
  record(
    `14.10-${surface.id}`,
    '14.10',
    'blocked',
    'Action-feedback verification requires a triggered action; not fired by this read-only ' +
      `navigation (observed actionFeedback=${feedbackObserved}).`,
    [`${surface.label}: actionFeedback=${feedbackObserved}`],
  );
}

/** Record every Req 14 criterion for a surface as blocked (used when the target is unreachable). */
function blockAllCriteria(surface: Surface, note: string): void {
  const perViewport = ['14.1', '14.2', '14.3', '14.6', '14.8'];
  for (const vp of VIEWPORTS) {
    for (const req of perViewport) {
      record(`${req}-${surface.id}-${vp.name}`, req, 'blocked', note);
    }
    if (vp.name === 'mobile') {
      record(`14.4-${surface.id}-${vp.name}`, '14.4', 'blocked', note);
    }
  }
  for (const req of ['14.5', '14.7', '14.9', '14.10', '14.11', '14.12']) {
    record(`${req}-${surface.id}`, req, 'blocked', note);
  }
}

/**
 * Record a verdict on the shared report, always attaching evidence so a `pass` satisfies the
 * report's evidence contract (Req 22.3). An optional screenshot path is attached for 14.12 support.
 */
function record(
  id: string,
  requirement: string,
  result: 'pass' | 'fail' | 'blocked' | 'skipped',
  note: string,
  apiExcerpts?: string[],
  screenshot?: string,
): void {
  if (apiExcerpts && apiExcerpts.length > 0) {
    report.attachEvidence(id, { apiExcerpts });
  }
  if (screenshot) {
    report.attachScreenshot(id, screenshot);
  }
  report.record(id, requirement, result, note);
}
