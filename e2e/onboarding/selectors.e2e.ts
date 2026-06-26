import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from '../helpers/auth';
import { resolveQaEnv, type QaEnv } from '../helpers/onboarding-qa/env';
import { createQaReport, type QaReport } from '../helpers/onboarding-qa/report';
import {
  REQUIRED_TESTIDS,
  createSelectorResolver,
  type RequiredTestId,
  type SelectorResolver,
} from '../helpers/onboarding-qa/selectors';

/**
 * Stable-selector contract QA module — Requirement 13.
 *
 * This module verifies the named `data-testid` `Selector` contract the rest of the onboarding QA
 * suite depends on. It covers task 13.1:
 *
 *  - 13.2 — assert the named `data-testid` contract ({@link REQUIRED_TESTIDS}) is present on the
 *    authenticated surfaces where each selector belongs (admin / photographer / client surfaces).
 *  - 13.4 — record a `Blocked_Check` for any missing (or mismatched) required selector, with the
 *    missing/mismatched selector and its source location noted, and CONTINUE (never block on human
 *    input).
 *  - 13.1 / 13.3 — confirm the other domain spec modules consume the shared
 *    {@link SelectorResolver} (`createSelectorResolver(...).byTestId`) to target `data-testid`
 *    rather than brittle text/CSS/layout locators.
 *
 * Reconciliation note (carried into the report as evidence)
 * --------------------------------------------------------
 * A source scan of `frontend/src/**` shows the running UI does NOT currently expose most of the
 * contracted `data-testid`s, and two of them are MISMATCHED against the harness contract:
 *
 *  - `cubicasa-create-order-button` (contract) vs `create-cubicasa-order-button` (UI) in
 *    `frontend/src/components/shoots/tabs/CreateCubicasaOrderButton.tsx`.
 *  - `raw-upload-input` (contract) — the UI uses this string only as an HTML element `id`
 *    (`raw-upload-input-${shoot.id}`), NOT as a `data-testid`, in
 *    `frontend/src/components/shoots/tabs/media/MediaUploadSections.tsx`.
 *
 * Per the task scope this module DOES NOT modify any UI component. It records each missing/
 * mismatched selector as a `Blocked_Check` (with the exact source location noted) so the
 * report-and-fix loop / a later task can reconcile the contract with the UI. The
 * {@link SELECTOR_RECONCILIATION} table below is the authoritative source-derived finding; the
 * live navigation probes corroborate it against the running surfaces (and degrade to a
 * `Blocked_Check` whenever a surface is unreachable).
 *
 * Everything here is strictly READ-ONLY: it navigates authenticated surfaces and reads selectors.
 */

const env: QaEnv = resolveQaEnv();
const report: QaReport = createQaReport();
const selectors: SelectorResolver = createSelectorResolver(report);

/** Where evidence artifacts are written (consistent with the rest of the suite). */
const OUTPUT_DIR = '../output/playwright';
const REPORT_MD = `${OUTPUT_DIR}/selectors-report.md`;
const REPORT_JSON = `${OUTPUT_DIR}/selectors-report.json`;

/**
 * A shoot id used to reach the per-shoot surfaces (Tour tab / media / delivery) where several
 * selectors belong. Reuses `E2E_CUBICASA_SHOOT_ID` as a fallback so a single seeded shoot drives
 * every per-shoot selector probe. When unset, those probes are recorded as Blocked_Checks.
 */
const SELECTOR_SHOOT_ID = (
  process.env.E2E_SELECTOR_SHOOT_ID ??
  process.env.E2E_CUBICASA_SHOOT_ID ??
  ''
).trim();

/** The role context an authenticated surface requires. */
type SurfaceRole = 'admin' | 'photographer' | 'client';

/** The outcome of the `frontend/src` source scan for a contracted selector. */
type SourceStatus = 'present' | 'mismatch' | 'missing';

interface SourceFinding {
  status: SourceStatus;
  /** The `data-testid` (or element id) actually found in the UI when status is `mismatch`/`present`. */
  actual?: string;
  /** The exact source location (`path:line`) for a present/mismatched selector. */
  source?: string;
  /** Extra human-readable detail surfaced in the report note. */
  detail?: string;
}

interface SelectorSurface {
  testId: RequiredTestId;
  /** Plain-language description of the surface where this selector belongs (Req 13.2). */
  belongsOn: string;
  /** Best-effort navigation route for the live presence probe (relative to `baseURL`). */
  route: string;
  /** Whether the route is a per-shoot surface that requires {@link SELECTOR_SHOOT_ID}. */
  needsShootId?: boolean;
  role: SurfaceRole;
  /** Authoritative source-scan reconciliation finding (see the module-level note). */
  finding: SourceFinding;
}

/**
 * The named `data-testid` contract mapped to the surface each selector belongs on, together with
 * the authoritative source-scan reconciliation finding. Every entry in {@link REQUIRED_TESTIDS}
 * MUST appear here exactly once (asserted by the contract-coverage check below).
 */
const SELECTOR_SURFACES: readonly SelectorSurface[] = [
  {
    testId: 'create-photographer-button',
    belongsOn: 'Admin super-admin account-creation surface (create a photographer account).',
    route: process.env.E2E_SELECTOR_CREATE_PHOTOGRAPHER_ROUTE ?? '/settings',
    role: 'admin',
    finding: {
      status: 'missing',
      detail: 'No `data-testid="create-photographer-button"` found anywhere in frontend/src.',
    },
  },
  {
    testId: 'photographer-radius-input',
    belongsOn: 'Photographer profile / service-area settings (set the Service_Radius).',
    route: process.env.E2E_SELECTOR_RADIUS_ROUTE ?? '/settings?tab=service-areas',
    role: 'admin',
    finding: {
      status: 'missing',
      detail: 'No `data-testid="photographer-radius-input"` found anywhere in frontend/src.',
    },
  },
  {
    testId: 'booking-address-input',
    belongsOn: 'Client booking surface (enter the shoot/booking address).',
    route: process.env.E2E_SELECTOR_BOOK_ROUTE ?? '/book-shoot',
    role: 'admin',
    finding: {
      status: 'missing',
      detail: 'No `data-testid="booking-address-input"` found anywhere in frontend/src.',
    },
  },
  {
    testId: 'eligible-photographer-row',
    belongsOn: 'Booking eligible-photographer list / admin assignment list.',
    route: process.env.E2E_SELECTOR_ELIGIBLE_ROUTE ?? '/settings?tab=service-areas',
    role: 'admin',
    finding: {
      status: 'missing',
      actual: 'service-area-match-row',
      source:
        'frontend/src/components/photographers/ServiceAreaAssignmentTool.tsx:240',
      detail:
        'No `eligible-photographer-row`; the closest existing row selector is ' +
        '`service-area-match-row` on the service-area assignment tool (semantically related, ' +
        'different id).',
    },
  },
  {
    testId: 'cubicasa-create-order-button',
    belongsOn: 'Shoot Tour tab — the CubiCasa create-order control (admin-gated).',
    route: SELECTOR_SHOOT_ID ? `/shoots/${SELECTOR_SHOOT_ID}` : '/shoots',
    needsShootId: true,
    role: 'admin',
    finding: {
      status: 'mismatch',
      actual: 'create-cubicasa-order-button',
      source: 'frontend/src/components/shoots/tabs/CreateCubicasaOrderButton.tsx:128',
      detail:
        'The CubiCasa control exists but under `data-testid="create-cubicasa-order-button"` ' +
        '(word order differs from the contract `cubicasa-create-order-button`).',
    },
  },
  {
    testId: 'shoot-status-badge',
    belongsOn: 'Shoot details surface — the current shoot/booking status badge.',
    route: SELECTOR_SHOOT_ID ? `/shoots/${SELECTOR_SHOOT_ID}` : '/shoots',
    needsShootId: true,
    role: 'admin',
    finding: {
      status: 'missing',
      detail:
        'No `data-testid="shoot-status-badge"` found in frontend/src ' +
        '(a CubiCasa-specific `cubicasa-current-status` badge exists, but no general shoot-status badge).',
    },
  },
  {
    testId: 'raw-upload-input',
    belongsOn: 'Shoot media tab — the raw-files upload input (photographer).',
    route: SELECTOR_SHOOT_ID ? `/shoots/${SELECTOR_SHOOT_ID}` : '/shoots',
    needsShootId: true,
    role: 'admin',
    finding: {
      status: 'mismatch',
      actual: 'raw-upload-input-${shoot.id} (HTML element id, not a data-testid)',
      source: 'frontend/src/components/shoots/tabs/media/MediaUploadSections.tsx:1231',
      detail:
        'The string `raw-upload-input` is used only as an HTML element `id` prefix ' +
        '(`raw-upload-input-${shoot.id}`), not as a `data-testid`; it is also suffixed by the ' +
        'shoot id, so it is not a stable, exact `data-testid` match.',
    },
  },
  {
    testId: 'submit-to-editor-button',
    belongsOn: 'Shoot media tab — submit raw files to the editor.',
    route: SELECTOR_SHOOT_ID ? `/shoots/${SELECTOR_SHOOT_ID}` : '/shoots',
    needsShootId: true,
    role: 'admin',
    finding: {
      status: 'missing',
      detail: 'No `data-testid="submit-to-editor-button"` found anywhere in frontend/src.',
    },
  },
  {
    testId: 'finalize-delivery-button',
    belongsOn: 'Shoot delivery surface — finalize/deliver the completed shoot.',
    route: SELECTOR_SHOOT_ID ? `/shoots/${SELECTOR_SHOOT_ID}` : '/shoots',
    needsShootId: true,
    role: 'admin',
    finding: {
      status: 'missing',
      detail: 'No `data-testid="finalize-delivery-button"` found anywhere in frontend/src.',
    },
  },
] as const;

/** The sibling domain spec modules expected to consume the shared resolver (Req 13.1/13.3). */
const RESOLVER_CONSUMER_MODULES = [
  'cubicasa.e2e.ts',
  'service-radius.e2e.ts',
] as const;

/** Render a `path:line` reference (or a fallback) for a finding in report evidence. */
function sourceRef(finding: SourceFinding): string {
  return finding.source ?? 'frontend/src (no source location — selector absent)';
}

test.describe.serial('Requirement 13 — stable data-testid selector contract', () => {
  let adminPage: Page;
  let adminReady = false;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: env.baseUrl });
    adminPage = await context.newPage();
    try {
      await loginAsAdmin(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
      adminReady = true;
    } catch {
      // Surface unreachable / auth unavailable → live probes will be recorded as Blocked_Checks.
      adminReady = false;
    }
  });

  test.afterAll(async () => {
    await report.write(REPORT_MD, REPORT_JSON).catch(() => undefined);
    await adminPage?.context().close().catch(() => undefined);
  });

  // -------------------------------------------------------------------------------------------
  // 13.2 — the named contract is fully defined and every required id maps to a surface.
  // -------------------------------------------------------------------------------------------
  test('13.2 — the named data-testid contract is complete and mapped to surfaces', () => {
    const checkId = '13.2-contract-complete';

    const contract = [...REQUIRED_TESTIDS].sort();
    const mapped = SELECTOR_SURFACES.map((surface) => surface.testId).sort();

    // Each contracted selector is documented exactly once with the surface it belongs on (13.2).
    expect(mapped).toEqual(contract);
    expect(new Set(mapped).size).toBe(mapped.length);

    report.attachEvidence(checkId, {
      apiExcerpts: [
        `REQUIRED_TESTIDS (${contract.length}): ${contract.join(', ')}`,
        ...SELECTOR_SURFACES.map((s) => `${s.testId} → ${s.belongsOn} [${s.role}]`),
      ],
    });
    report.record(checkId, '13.2', 'pass', 'Named selector contract is fully mapped to surfaces.');
  });

  // -------------------------------------------------------------------------------------------
  // 13.2 / 13.4 — source-scan reconciliation: present → pass; missing/mismatch → Blocked_Check.
  // -------------------------------------------------------------------------------------------
  for (const surface of SELECTOR_SURFACES) {
    test(`13.4 — reconcile "${surface.testId}" against the UI source`, () => {
      const checkId = `13.4-reconcile-${surface.testId}`;
      const { finding } = surface;

      if (finding.status === 'present') {
        report.attachEvidence(checkId, {
          apiExcerpts: [
            `present as data-testid="${surface.testId}" at ${sourceRef(finding)}`,
            `belongs on: ${surface.belongsOn}`,
          ],
        });
        report.record(checkId, '13.2', 'pass', `Selector present on ${surface.belongsOn}`);
        return;
      }

      // Missing OR mismatched → recorded as a Blocked_Check with the dependency noted (Req 13.4).
      const kind = finding.status === 'mismatch' ? 'MISMATCH' : 'MISSING';
      const actual = finding.actual ? ` Actual UI selector: \`${finding.actual}\` (${sourceRef(finding)}).` : '';
      report.attachEvidence(checkId, {
        apiExcerpts: [
          `status=${finding.status}`,
          `contract data-testid="${surface.testId}"`,
          finding.actual ? `actual=${finding.actual}` : 'actual=<none>',
          `source=${sourceRef(finding)}`,
          `belongs on: ${surface.belongsOn}`,
        ],
      });
      report.record(
        checkId,
        '13.4',
        'blocked',
        `${kind}: required selector "${surface.testId}" is not exposed as a data-testid on its ` +
          `surface (${surface.belongsOn}).${actual} ${finding.detail ?? ''} ` +
          'UI not modified by this task — recorded for the report-and-fix loop.',
      );
    });
  }

  // -------------------------------------------------------------------------------------------
  // 13.2 / 13.4 — live presence probe on the authenticated surface using the shared resolver.
  // -------------------------------------------------------------------------------------------
  for (const surface of SELECTOR_SURFACES) {
    test(`13.2 — live presence probe for "${surface.testId}"`, async () => {
      const checkId = `13.2-live-${surface.testId}`;

      if (surface.role === 'admin' && !adminReady) {
        report.record(
          checkId,
          '13.4',
          'blocked',
          `Admin surface unauthenticated/unreachable; cannot probe "${surface.testId}".`,
        );
        return;
      }

      if (surface.needsShootId && !SELECTOR_SHOOT_ID) {
        report.record(
          checkId,
          '13.4',
          'blocked',
          `Per-shoot surface for "${surface.testId}" requires E2E_SELECTOR_SHOOT_ID ` +
            '(or E2E_CUBICASA_SHOOT_ID) — not provided.',
        );
        return;
      }

      // Navigate the surface where this selector belongs (best-effort; blocked-and-continue).
      try {
        await adminPage.goto(surface.route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      } catch {
        report.record(
          checkId,
          '13.4',
          'blocked',
          `Surface "${surface.route}" was not reachable while probing "${surface.testId}".`,
        );
        return;
      }

      // CubiCasa lives behind the shoot "Tour" tab — open it so the control can render.
      if (surface.testId === 'cubicasa-create-order-button') {
        const tourTab = adminPage.getByRole('tab', { name: /tour/i }).first();
        if (await tourTab.isVisible({ timeout: 10_000 }).catch(() => false)) {
          await tourTab.click().catch(() => undefined);
        }
      }

      // Resolve strictly by the contracted data-testid; a missing selector is a Blocked_Check
      // recorded by the resolver itself (Req 13.4) — no brittle text/CSS fallback is attempted.
      const locator = await selectors.byTestId(adminPage, surface.testId, checkId);

      if (!locator) {
        // The resolver recorded the Blocked_Check. Corroborate the mismatch by probing the ACTUAL
        // UI selector (where one is known) so the report proves the element exists under a
        // different id rather than being entirely absent.
        if (surface.finding.actual && surface.finding.status === 'mismatch') {
          // Only the CubiCasa control is a true data-testid (the raw-upload one is an element id).
          if (surface.testId === 'cubicasa-create-order-button') {
            const actualCount = await adminPage.getByTestId('create-cubicasa-order-button').count();
            report.attachEvidence(checkId, {
              apiExcerpts: [
                `contract "${surface.testId}" count=0; actual "create-cubicasa-order-button" count=${actualCount}`,
              ],
            });
          } else if (surface.testId === 'raw-upload-input') {
            const idCount = await adminPage
              .locator('[id^="raw-upload-input-"]')
              .count()
              .catch(() => 0);
            report.attachEvidence(checkId, {
              apiExcerpts: [
                `contract data-testid "${surface.testId}" count=0; element id^="raw-upload-input-" count=${idCount}`,
              ],
            });
          }
        }
        return;
      }

      // Contract selector is present on the surface → pass with screenshot evidence (Req 13.2).
      const shot = `${OUTPUT_DIR}/selectors-${surface.testId}-${env.runId}.png`;
      await adminPage.screenshot({ path: shot, fullPage: true }).catch(() => undefined);
      report.attachScreenshot(checkId, shot);
      report.record(
        checkId,
        '13.2',
        'pass',
        `Selector "${surface.testId}" present on ${surface.belongsOn}`,
      );
    });
  }

  // -------------------------------------------------------------------------------------------
  // 13.1 / 13.3 — confirm sibling domain modules consume the shared resolver to target data-testid.
  // -------------------------------------------------------------------------------------------
  test('13.1/13.3 — domain modules consume the shared selector resolver', async () => {
    const checkId = '13.3-modules-consume-resolver';
    const here = dirname(fileURLToPath(import.meta.url));

    const findings: string[] = [];
    let verified = 0;

    for (const moduleName of RESOLVER_CONSUMER_MODULES) {
      let source: string;
      try {
        source = await readFile(join(here, moduleName), 'utf8');
      } catch {
        findings.push(`${moduleName}: source unreadable — could not verify resolver consumption.`);
        continue;
      }

      const importsResolver = /createSelectorResolver/.test(source);
      const callsByTestId = /\.byTestId\(/.test(source) || /selectors\.byTestId/.test(source);

      if (importsResolver && callsByTestId) {
        verified += 1;
        findings.push(`${moduleName}: imports createSelectorResolver and calls byTestId ✓`);
      } else {
        findings.push(
          `${moduleName}: resolver consumption NOT detected ` +
            `(createSelectorResolver=${importsResolver}, byTestId=${callsByTestId}).`,
        );
      }
    }

    report.attachEvidence(checkId, { apiExcerpts: findings });

    if (verified === RESOLVER_CONSUMER_MODULES.length) {
      report.record(
        checkId,
        '13.3',
        'pass',
        'All inspected domain modules resolve onboarding-critical elements via the shared ' +
          'data-testid resolver (no brittle text/CSS/layout fallback).',
      );
    } else if (verified > 0) {
      report.record(
        checkId,
        '13.3',
        'blocked',
        `Only ${verified}/${RESOLVER_CONSUMER_MODULES.length} inspected modules were confirmed to ` +
          'consume the resolver; see evidence for the modules that could not be verified.',
      );
    } else {
      report.record(
        checkId,
        '13.3',
        'blocked',
        'No inspected module could be confirmed to consume the shared selector resolver.',
      );
    }

    // The check must be recorded regardless of outcome (blocked-and-continue).
    expect(report.entries().some((entry) => entry.id === checkId)).toBe(true);
  });
});
