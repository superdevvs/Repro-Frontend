import type { Page } from '@playwright/test';

import type { QaReport } from './report';

/**
 * UI-consistency probe for the photographer onboarding QA harness.
 *
 * This is harness Component 9 from the design. Rather than relying on screenshots alone, it
 * captures a set of **measurable UI signals** on each navigated onboarding surface (Req 14.1–14.10)
 * and runs them across the four onboarding `Viewport`s — Desktop 1440x900, Laptop 1280x800,
 * Tablet 768x1024, and Mobile 390x844 (Req 14.11) — screenshotting each surface at each viewport
 * for inclusion in the `QA_Report` (Req 14.12).
 *
 * Signal collection has two halves:
 *  - **Event signals** (console errors, failed network requests) are gathered by wiring
 *    `console` / `pageerror` / `requestfailed` / `response` listeners onto the page. Because the
 *    page handed to {@link UiProbe.probe} is typically already navigated, the probe attaches the
 *    listeners and then waits for the surface to settle (`networkidle`, guarded) so in-flight and
 *    late events are still captured. Callers that need full navigation-time fidelity should open a
 *    fresh page inside the `open` callback of {@link UiProbe.probeAllViewports} so the surface
 *    settles under observation.
 *  - **DOM signals** (crash boundary, horizontal overflow, empty state, duplicate primary buttons,
 *    status-badge text, hidden required fields, stale data, action feedback) are derived from a
 *    single in-page evaluation against documented selector/text heuristics (see {@link UiSignals}).
 *
 * The probe **collects and attaches evidence** (screenshots + console logs + network failures)
 * under the `surfaceId` check id; it does not decide pass/fail. The owning spec module
 * (`onboarding/ui-consistency.e2e.ts`) inspects the returned {@link UiSignals} and records the
 * verdict on the {@link QaReport}.
 */

/** The four onboarding `Viewport`s the UI-consistency checks run at (Req 14.11). */
export const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

/** A single onboarding `Viewport` definition drawn from {@link VIEWPORTS}. */
export type Viewport = (typeof VIEWPORTS)[number];

/** The action-feedback state surfaced for a triggered action (Req 14.10). */
export type ActionFeedback = 'loading' | 'success' | 'error' | 'none';

/**
 * The measurable UI signal set captured for one surface at one viewport (Req 14.1–14.10).
 *
 * The probe reports raw signals; the spec module interprets them (e.g. a non-empty
 * `consoleErrors` fails Req 14.1, a true `horizontalOverflow` at the mobile viewport fails
 * Req 14.4). Heuristics for each DOM signal are documented inline in the probe implementation.
 */
export interface UiSignals {
  /** Viewport at which these signals were captured (`null` if it could not be read). */
  viewport: Viewport | null;
  /** Console `error` messages and uncaught page errors observed on the surface (Req 14.1). */
  consoleErrors: string[];
  /** Failed network requests/responses, excluding any URL matching the allow-list (Req 14.2). */
  failedRequests: string[];
  /** Whether a React error-boundary / crash marker is displayed (Req 14.3). */
  reactCrashBoundary: boolean;
  /** Whether the document overflows horizontally (meaningful at the mobile viewport, Req 14.4). */
  horizontalOverflow: boolean;
  /** Whether a defined empty state is rendered for a no-data surface (Req 14.5). */
  emptyStateRendered: boolean;
  /** Count of duplicated primary action buttons beyond the first of each label (Req 14.6). */
  duplicatePrimaryButtons: number;
  /** Trimmed status-badge text, used for cross-surface consistency (Req 14.7); `null` if absent. */
  statusBadgeText: string | null;
  /** Identifiers of required form fields that are present but hidden (Req 14.8). */
  hiddenRequiredFields: string[];
  /** Whether a stale-data marker lingers after a save (Req 14.9). */
  staleData: boolean;
  /** The action-feedback state presented on the surface (Req 14.10). */
  actionFeedback: ActionFeedback;
}

export interface UiProbe {
  /**
   * Capture the measurable {@link UiSignals} on a single navigated surface.
   *
   * Wires console/network listeners, settles the surface, derives the DOM signals, screenshots the
   * surface, and attaches the screenshot + console/network evidence to the {@link QaReport} under
   * `surfaceId`. Never throws on a flaky surface — capture failures degrade to empty/`none` signals.
   *
   * @param surfaceId The report check id under which evidence is attached.
   * @param allowList Substrings of request URLs that are expected to fail and must be ignored (Req 14.2).
   */
  probe(page: Page, surfaceId: string, allowList?: string[]): Promise<UiSignals>;
  /**
   * Run {@link UiProbe.probe} across all four {@link VIEWPORTS} (Req 14.11), opening a page per
   * viewport via `open` and screenshotting each (Req 14.12). Returns one {@link UiSignals} per
   * viewport, in {@link VIEWPORTS} order.
   */
  probeAllViewports(
    open: (vp: Viewport) => Promise<Page>,
    surfaceId: string,
  ): Promise<UiSignals[]>;
}

/** Default ceiling for settle/evaluate waits so the probe never blocks the run (ms). */
const SETTLE_TIMEOUT_MS = 5000;

/** Directory for probe screenshots, consistent with `qa-acceptance.e2e.ts`. */
const SCREENSHOT_DIR = '../output/playwright';

/** Turn a surface id into a filesystem-safe screenshot filename fragment. */
function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'surface';
}

/** True when a failed request URL is covered by an allow-list entry (substring match, Req 14.2). */
function isAllowed(url: string, allowList: string[]): boolean {
  return allowList.some((entry) => entry.length > 0 && url.includes(entry));
}

export function createUiProbe(report: QaReport): UiProbe {
  async function probe(page: Page, surfaceId: string, allowList: string[] = []): Promise<UiSignals> {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    // --- Wire event listeners (Req 14.1, 14.2) ------------------------------------------------
    // Attached now and removed before returning so repeated probes on a reused page do not
    // accumulate cross-surface signal noise.
    const onConsole = (msg: {
      type: () => string;
      text: () => string;
      location?: () => { url?: string };
    }): void => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // A console error tied to an allow-listed third-party host (e.g. a CORS / failed-resource
        // error for an opportunistic IP-geolocation call) is a third-party transport issue, not an
        // app defect — excluded for the same reason as the 14.2 network allow-list. Chromium often
        // reports a generic "Failed to load resource: net::ERR_FAILED" with the offending URL only
        // in `location().url`, so check both the text and the location.
        const locationUrl = msg.location?.()?.url ?? '';
        if (isAllowed(text, allowList) || isAllowed(locationUrl, allowList)) {
          return;
        }
        consoleErrors.push(text);
      }
    };
    const onPageError = (error: Error): void => {
      // Uncaught exceptions are console-error-equivalent for surface health (Req 14.1).
      if (isAllowed(error.message, allowList)) {
        return;
      }
      consoleErrors.push(`pageerror: ${error.message}`);
    };
    const onRequestFailed = (request: {
      url: () => string;
      method: () => string;
      failure: () => { errorText: string } | null;
    }): void => {
      const url = request.url();
      if (isAllowed(url, allowList)) {
        return;
      }
      const reason = request.failure()?.errorText ?? 'failed';
      // `net::ERR_ABORTED` is a CANCELLED request (component unmount, navigation, or context
      // teardown) — not a server/network failure. Counting it would flag healthy SPA behavior
      // (in-flight fetches cancelled on route change) as a defect, so it is excluded (Req 14.2).
      if (/ERR_ABORTED/i.test(reason)) {
        return;
      }
      failedRequests.push(`${request.method()} ${url} (${reason})`);
    };
    const onResponse = (response: { url: () => string; status: () => number }): void => {
      const status = response.status();
      // Treat 4xx/5xx as failed network requests, allow-list aware (Req 14.2).
      if (status < 400) {
        return;
      }
      const url = response.url();
      if (isAllowed(url, allowList)) {
        return;
      }
      failedRequests.push(`HTTP ${status} ${url}`);
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);

    let signals: UiSignals = {
      viewport: null,
      consoleErrors,
      failedRequests,
      reactCrashBoundary: false,
      horizontalOverflow: false,
      emptyStateRendered: false,
      duplicatePrimaryButtons: 0,
      statusBadgeText: null,
      hiddenRequiredFields: [],
      staleData: false,
      actionFeedback: 'none',
    };

    try {
      // Give in-flight requests and late console errors a bounded window to surface.
      await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }).catch(() => {
        // A surface that never reaches networkidle (e.g. long-polling) must not block the probe.
      });

      const dom = await evaluateDomSignals(page);
      signals = { ...signals, ...dom };
    } catch {
      // A flaky/destroyed surface degrades to the default (empty/none) signals rather than throwing,
      // keeping the probe non-blocking (the run continues and the spec records the verdict).
    } finally {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
    }

    // --- Evidence (Req 14.12 + supporting console/network evidence) ---------------------------
    const screenshotPath = `${SCREENSHOT_DIR}/ui-${sanitizeForFilename(surfaceId)}.png`;
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      report.attachScreenshot(surfaceId, screenshotPath);
    } catch {
      // Screenshot capture is best-effort; absence is reflected by the missing evidence path.
    }
    report.attachEvidence(surfaceId, {
      consoleLogs: consoleErrors.length > 0 ? consoleErrors : undefined,
      networkFailures: failedRequests.length > 0 ? failedRequests : undefined,
    });

    return signals;
  }

  async function probeAllViewports(
    open: (vp: Viewport) => Promise<Page>,
    surfaceId: string,
  ): Promise<UiSignals[]> {
    const results: UiSignals[] = [];
    for (const vp of VIEWPORTS) {
      const page = await open(vp);
      // The per-viewport check id keeps screenshots and evidence distinct per viewport (Req 14.12).
      const signals = await probe(page, `${surfaceId}@${vp.name}`);
      results.push({ ...signals, viewport: vp });
    }
    return results;
  }

  return { probe, probeAllViewports };
}

/**
 * Derive the DOM-based UI signals in a single in-page evaluation.
 *
 * Documented heuristics (all by stable markers first, then conservative text/structure fallbacks):
 *  - **reactCrashBoundary (14.3):** a `[data-testid="error-boundary"]` element, common boundary
 *    class names (`.error-boundary`), or visible text matching "something went wrong" /
 *    "unexpected error" / "application error".
 *  - **horizontalOverflow (14.4):** `documentElement.scrollWidth` exceeds `window.innerWidth` by
 *    more than a 1px rounding tolerance.
 *  - **emptyStateRendered (14.5):** a `[data-testid="empty-state"]` element or visible text
 *    matching "no … (found|yet|available)" / "nothing here".
 *  - **duplicatePrimaryButtons (14.6):** visible primary buttons (`[data-testid="primary-action"]`,
 *    `.btn-primary`, or `button[type="submit"]`) grouped by trimmed label; the signal is the sum of
 *    `(count - 1)` for each label appearing more than once (true duplicates, not distinct actions).
 *  - **statusBadgeText (14.7):** trimmed text of the first `[data-testid="shoot-status-badge"]`.
 *  - **hiddenRequiredFields (14.8):** elements with `required` or `aria-required="true"` that are
 *    not visible (zero box, `display:none`, `visibility:hidden`, or the `hidden` attribute);
 *    reported by `data-testid` / `name` / `id`.
 *  - **staleData (14.9):** a lingering `[data-stale="true"]` / `[data-testid="stale-data"]` marker
 *    or visible "out of date" / "refresh to see" text. (Value-level staleness is verified by the
 *    spec module, which knows the expected saved value.)
 *  - **actionFeedback (14.10):** `loading` when a busy/spinner indicator is visible; otherwise
 *    `error` when an alert/error toast is visible; otherwise `success` when a success toast/status
 *    is visible; otherwise `none`.
 */
async function evaluateDomSignals(page: Page): Promise<Omit<UiSignals, 'viewport' | 'consoleErrors' | 'failedRequests'>> {
  return page.evaluate(() => {
    const isVisible = (el: Element): boolean => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return false;
      }
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };

    const bodyText = (document.body?.innerText ?? '').toLowerCase();

    // --- 14.3 React crash boundary -----------------------------------------------------------
    const crashSelectors = ['[data-testid="error-boundary"]', '.error-boundary', '#error-boundary'];
    const crashByMarker = crashSelectors.some((sel) => {
      const el = document.querySelector(sel);
      return el !== null && isVisible(el);
    });
    const crashByText =
      /something went wrong|unexpected error|application error|an error has occurred/.test(bodyText);
    const reactCrashBoundary = crashByMarker || crashByText;

    // --- 14.4 horizontal overflow ------------------------------------------------------------
    const scrollWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    const horizontalOverflow = scrollWidth - viewportWidth > 1;

    // --- 14.5 empty state --------------------------------------------------------------------
    const emptyMarker = document.querySelector('[data-testid="empty-state"]');
    const emptyByMarker = emptyMarker !== null && isVisible(emptyMarker);
    const emptyByText = /no [\w\s]+ (found|yet|available)|nothing here|no results/.test(bodyText);
    const emptyStateRendered = emptyByMarker || emptyByText;

    // --- 14.6 duplicate primary buttons ------------------------------------------------------
    const primarySelector = '[data-testid="primary-action"], .btn-primary, button[type="submit"]';
    const primaryButtons = Array.from(document.querySelectorAll(primarySelector)).filter(isVisible);
    const labelCounts = new Map<string, number>();
    for (const btn of primaryButtons) {
      const label = (btn.textContent ?? '').trim().toLowerCase();
      if (label.length === 0) {
        continue;
      }
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
    let duplicatePrimaryButtons = 0;
    for (const count of labelCounts.values()) {
      if (count > 1) {
        duplicatePrimaryButtons += count - 1;
      }
    }

    // --- 14.7 status badge text --------------------------------------------------------------
    const badge = document.querySelector('[data-testid="shoot-status-badge"]');
    const statusBadgeText = badge ? (badge.textContent ?? '').trim() || null : null;

    // --- 14.8 hidden required fields ---------------------------------------------------------
    const requiredFields = Array.from(
      document.querySelectorAll('[required], [aria-required="true"]'),
    );
    const hiddenRequiredFields: string[] = [];
    for (const field of requiredFields) {
      if (isVisible(field)) {
        continue;
      }
      const id =
        field.getAttribute('data-testid') ||
        field.getAttribute('name') ||
        field.getAttribute('id') ||
        field.tagName.toLowerCase();
      hiddenRequiredFields.push(id);
    }

    // --- 14.9 stale data ---------------------------------------------------------------------
    const staleMarker = document.querySelector('[data-stale="true"], [data-testid="stale-data"]');
    const staleByMarker = staleMarker !== null && isVisible(staleMarker);
    const staleByText = /out of date|refresh to see|data may be stale/.test(bodyText);
    const staleData = staleByMarker || staleByText;

    // --- 14.10 action feedback ---------------------------------------------------------------
    const visibleMatch = (selector: string): boolean =>
      Array.from(document.querySelectorAll(selector)).some(isVisible);
    let actionFeedback: 'loading' | 'success' | 'error' | 'none' = 'none';
    if (
      visibleMatch('[aria-busy="true"], [data-testid="loading"], [role="progressbar"], .spinner')
    ) {
      actionFeedback = 'loading';
    } else if (
      visibleMatch('[data-testid="toast-error"], .toast-error, [role="alert"], .alert-error')
    ) {
      actionFeedback = 'error';
    } else if (
      visibleMatch('[data-testid="toast-success"], .toast-success, [role="status"], .alert-success')
    ) {
      actionFeedback = 'success';
    }

    return {
      reactCrashBoundary,
      horizontalOverflow,
      emptyStateRendered,
      duplicatePrimaryButtons,
      statusBadgeText,
      hiddenRequiredFields,
      staleData,
      actionFeedback,
    };
  });
}
