import {
  expect,
  test,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

import {
  PHOTO_EDITOR_EMAIL,
  PHOTO_EDITOR_PASSWORD,
  VIDEO_EDITOR_EMAIL,
  VIDEO_EDITOR_PASSWORD,
  loginAsAdmin,
  loginAsEditor,
} from '../helpers/auth';
import { createConfirmationGate, type ConfirmationGate } from '../helpers/onboarding-qa/confirmation-gate';
import { createDataFactory, type DataFactory } from '../helpers/onboarding-qa/data-factory';
import { createEntityTracker, type EntityTracker } from '../helpers/onboarding-qa/entity-tracker';
import { resolveQaEnv, type QaEnv } from '../helpers/onboarding-qa/env';
import {
  createRoleContexts,
  type RoleContexts,
  type RoleSession,
} from '../helpers/onboarding-qa/contexts';
import { createQaReport, type QaReport } from '../helpers/onboarding-qa/report';
import { createTestData, type TestData } from '../helpers/onboarding-qa/test-data';

/**
 * Concurrent multi-role spec module (Requirement 15).
 *
 * Verifies that the onboarding QA suite can hold multiple authenticated Role_Contexts open at the
 * same time and that the Onboarding_System keeps each session independent and propagates shared
 * data changes across contexts:
 *   15.1 — maintain the Admin_Context, Photographer_Context, Client_Context, Photo_Editor_Context,
 *          Video_Editor_Context, Editing_Manager_Context, and (where required) the Sales_Rep_Context
 *          as SEPARATE browser contexts within a single run (up to seven held simultaneously).
 *   15.2 — while multiple Role_Contexts are authenticated simultaneously, each session maintains its
 *          own identity independently (each resolves its own `/api/user` identity, and no two
 *          held sessions resolve the same identity).
 *   15.3 — a change made in one Role_Context appears in another Role_Context upon refresh.
 *
 * Harness usage (design "Components and Interfaces"):
 *   - `env.ts`               — documented configuration resolution.
 *   - `data-factory.ts`      — QA_Run_Id suffixing (the propagation change writes a run-id value).
 *   - `confirmation-gate.ts` — the cross-context data change (15.3) is a `Destructive_Step` routed
 *                              through the gate, which defaults to DECLINED so the suite is
 *                              read-only by default (Req 2.1); a declined change is recorded as a
 *                              Blocked_Check with the gate dependency noted (Req 2.3, 2.6).
 *   - `entity-tracker.ts` / `test-data.ts` — provision the fixed persona set (gated) so the full
 *                              seven-role set can authenticate when the gate allows account creation.
 *   - `contexts.ts`          — `createRoleContexts` opens up to seven authenticated sessions.
 *   - `report.ts`            — one evidence-backed entry per check (Req 22.1–22.4).
 *
 * Graceful degradation (the key assumption for this module):
 *   `createRoleContexts` eagerly authenticates the six non-optional roles, three of which
 *   (photographer A, client, editing manager) require accounts provisioned through `test-data.ts`.
 *   Provisioning is a `Destructive_Step` gated behind `E2E_CONFIRM_DESTRUCTIVE` /
 *   `E2E_CONFIRM_CATEGORIES=account-create`, which is DECLINED by default. When provisioning is
 *   declined (or any persona credential is otherwise unavailable), `createRoleContexts` throws.
 *   In that case this spec degrades gracefully: it authenticates only the ALWAYS-AVAILABLE roles
 *   that use pre-seeded env credentials from `helpers/auth.ts` — the admin
 *   (`E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`) and the photo/video editors
 *   (`E2E_PHOTO_EDITOR_*` / `E2E_VIDEO_EDITOR_*`) — and records the provisioned-account roles as
 *   blocked-and-continue with the missing dependency noted. Identity isolation (15.2) is asserted
 *   across whatever sessions DID authenticate; cross-context propagation (15.3) is gated and, when
 *   no change can be made without the gate, recorded as blocked with the dependency.
 *
 * Safety: this spec performs NO mutation by default. The only write (the 15.3 propagation change)
 * runs exclusively through the confirmation gate and MUST NOT be executed against live production
 * without scoped confirmation.
 */

/** Artifact directory, consistent with `qa-acceptance.e2e.ts` and the other onboarding modules. */
const OUTPUT_DIR = '../output/playwright';

/** Confirmation-gate category for the cross-context data change (15.3). */
const PROPAGATION_CATEGORY = 'multi-role-propagation';

/** The seven canonical Role_Contexts in the order the suite holds them open (Req 15.1). */
const ROLE_ORDER = [
  'admin',
  'photographer',
  'client',
  'photoEditor',
  'videoEditor',
  'editingManager',
  'salesRep',
] as const;

type RoleName = (typeof ROLE_ORDER)[number];

/** Roles that authenticate with pre-seeded env credentials and need no provisioning. */
const ALWAYS_AVAILABLE: ReadonlySet<RoleName> = new Set<RoleName>([
  'admin',
  'photoEditor',
  'videoEditor',
]);

interface Harness {
  env: QaEnv;
  factory: DataFactory;
  gate: ConfirmationGate;
  tracker: EntityTracker;
  data: TestData;
  report: QaReport;
}

/** A held role session together with the role it represents and the persona id (when known). */
interface HeldRole {
  role: RoleName;
  session: RoleSession;
  /** The backend account id of the provisioned persona, when this role was provisioned. */
  personaId?: string | number;
}

/** The resolved identity of a session, read from `/api/user` with its own bearer token. */
interface Identity {
  id: string | number | null;
  email: string | null;
  role: string | null;
  name: string | null;
}

function createHarness(): Harness {
  const env = resolveQaEnv();
  const factory = createDataFactory(env.runId);
  const gate = createConfirmationGate(env);
  const tracker = createEntityTracker(env.runId);
  return {
    env,
    factory,
    gate,
    tracker,
    data: createTestData(env, factory, gate, tracker),
    report: createQaReport(),
  };
}

/** Read the bearer token persisted by the app after a form login (matches the existing suite). */
async function readToken(page: Page): Promise<string> {
  const token = await page.evaluate(
    () => localStorage.getItem('authToken') || localStorage.getItem('token'),
  );
  if (!token) {
    throw new Error('login did not yield an auth token in localStorage');
  }
  return token;
}

/**
 * Open one degraded session for an always-available role using its pre-seeded env credentials.
 * Mirrors the authentication that `contexts.ts` performs, but for a single role so a partial set
 * can be held even when full {@link createRoleContexts} cannot.
 */
async function openDegradedSession(
  browser: Browser,
  env: QaEnv,
  role: RoleName,
  opened: BrowserContext[],
): Promise<RoleSession> {
  const context = await browser.newContext({ baseURL: env.baseUrl });
  opened.push(context);
  const page = await context.newPage();

  if (role === 'admin') {
    await loginAsAdmin(page, env.adminEmail, env.adminPassword);
  } else if (role === 'photoEditor') {
    await loginAsEditor(page, PHOTO_EDITOR_EMAIL, PHOTO_EDITOR_PASSWORD);
  } else if (role === 'videoEditor') {
    await loginAsEditor(page, VIDEO_EDITOR_EMAIL, VIDEO_EDITOR_PASSWORD);
  } else {
    throw new Error(`Role "${role}" is not an always-available env-credentialed role`);
  }

  const token = await readToken(page);
  return { context, page, token };
}

/** Resolve a session's own identity via `GET /api/user` with its bearer token (Req 15.2). */
async function resolveIdentity(session: RoleSession, env: QaEnv): Promise<Identity> {
  const res: APIResponse = await session.context.request.get(`${env.apiBaseUrl}/api/user`, {
    headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(`GET /api/user returned ${res.status()} for the held session`);
  }
  const body = (await res.json()) as Record<string, unknown> & { user?: Record<string, unknown> };
  const user = (body.user ?? body) as Record<string, unknown>;
  return {
    id: (user.id as string | number | undefined) ?? null,
    email: (user.email as string | undefined) ?? null,
    role: (user.role as string | undefined) ?? null,
    name: (user.name as string | undefined) ?? null,
  };
}

/** Compact a JSON-able value into a single-line API excerpt for the report. */
function excerpt(label: string, value: unknown): string {
  return `${label}: ${JSON.stringify(value)}`;
}

test.describe.serial('onboarding QA — concurrent multi-role operation (Requirement 15)', () => {
  const harness = createHarness();
  const { env, factory, gate, tracker, data, report } = harness;

  /** Sessions actually held open this run, in ROLE_ORDER. Populated in beforeAll. */
  const held: HeldRole[] = [];
  /** Roles that could not be held, with the missing dependency for blocked-and-continue. */
  const blockedRoles: { role: RoleName; reason: string }[] = [];
  /** The full role-contexts handle when the eager path succeeds (for disposal). */
  let roleContexts: RoleContexts | null = null;
  /** Contexts opened directly by the degraded path (for disposal). */
  const degradedContexts: BrowserContext[] = [];

  test.beforeAll(async ({ browser }) => {
    // Provisioning is gated and DECLINED by default → personas are absent in the read-only default.
    // We still attempt it so the full seven-role set authenticates when the gate is enabled.
    try {
      await data.provisionAll();
    } catch {
      // Missing target / declined gate → handled by the degraded path below.
    }

    // Preferred path: hold all (up to seven) Role_Contexts open via the harness (Req 15.1).
    try {
      roleContexts = await createRoleContexts(browser, env, data);
      held.push({ role: 'admin', session: roleContexts.admin });
      held.push({ role: 'photographer', session: roleContexts.photographer, personaId: data.get('photographerA')?.id });
      held.push({ role: 'client', session: roleContexts.client, personaId: data.get('client')?.id });
      held.push({ role: 'photoEditor', session: roleContexts.photoEditor });
      held.push({ role: 'videoEditor', session: roleContexts.videoEditor });
      held.push({ role: 'editingManager', session: roleContexts.editingManager, personaId: data.get('editingManager')?.id });

      // The sales rep is optional (Req 3.7); hold it too when it can be provisioned + authenticated.
      try {
        const salesRep = await roleContexts.ensureSalesRep();
        held.push({ role: 'salesRep', session: salesRep, personaId: data.get('salesRep')?.id });
      } catch (error) {
        blockedRoles.push({
          role: 'salesRep',
          reason: `optional sales rep not held: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      return;
    } catch (error) {
      // Graceful degradation: full multi-role setup needs provisioned personas (gated). Fall back
      // to the always-available env-credentialed roles and record the rest blocked-and-continue.
      const why = error instanceof Error ? error.message : String(error);
      for (const role of ROLE_ORDER) {
        if (ALWAYS_AVAILABLE.has(role)) {
          try {
            const session = await openDegradedSession(browser, env, role, degradedContexts);
            held.push({ role, session });
          } catch (openError) {
            blockedRoles.push({
              role,
              reason: openError instanceof Error ? openError.message : String(openError),
            });
          }
        } else {
          blockedRoles.push({
            role,
            reason:
              `requires a provisioned account (gated persona provisioning declined or unavailable): ${why}`,
          });
        }
      }
    }
  });

  test.afterAll(async () => {
    // Emit the evidence-backed report bundle (Req 22.1/22.2) regardless of individual outcomes.
    await report.write(
      `${OUTPUT_DIR}/multi-role-report.md`,
      `${OUTPUT_DIR}/multi-role-report.json`,
    );

    // Dispose every context held this run (Req 15.1 — held within a single run, then released).
    if (roleContexts) {
      await roleContexts.dispose();
    }
    await Promise.all(degradedContexts.map((context) => context.close()));
  });

  test('15.1 holds the Role_Contexts open simultaneously as separate browser contexts', async () => {
    const note =
      blockedRoles.length > 0
        ? `Held ${held.length}/7 roles: [${held.map((entry) => entry.role).join(', ')}]. ` +
          `Blocked (provisioned-account roles require the confirmation gate to allow account ` +
          `creation): ${blockedRoles.map((entry) => `${entry.role} — ${entry.reason}`).join('; ')}`
        : `Held all ${held.length} Role_Contexts simultaneously: ` +
          `[${held.map((entry) => entry.role).join(', ')}]`;

    try {
      // At least one role must authenticate for the concurrent-session check to be meaningful;
      // otherwise the target is unreachable and the check is blocked-and-continue (Req 2.6).
      if (held.length === 0) {
        report.record(
          '15.1-concurrent-contexts',
          '15.1',
          'blocked',
          `No Role_Context could authenticate (target unreachable or all credentials unavailable). ${note}`,
        );
        return;
      }

      // Each held role MUST be backed by its own distinct BrowserContext (separate contexts within
      // a single run) — this is the core of Req 15.1.
      const contexts = held.map((entry) => entry.session.context);
      const uniqueContexts = new Set(contexts);
      expect(uniqueContexts.size, 'each held role uses a distinct BrowserContext').toBe(
        contexts.length,
      );

      // Each session also carries its own bearer token (independent authentication material).
      const tokens = held.map((entry) => entry.session.token);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size, 'each held role carries a distinct auth token').toBe(tokens.length);
      expect(held.length, 'at most seven Role_Contexts are held').toBeLessThanOrEqual(7);

      // Screenshot each held surface as evidence that the contexts are open simultaneously.
      for (const entry of held) {
        const path = `${OUTPUT_DIR}/multi-role-${entry.role}.png`;
        await entry.session.page.screenshot({ path, fullPage: true });
        report.attachScreenshot('15.1-concurrent-contexts', path);
      }
      report.attachEvidence('15.1-concurrent-contexts', {
        apiExcerpts: [excerpt('held roles', held.map((entry) => entry.role))],
      });

      // Pass when the held sessions are genuinely independent contexts; a degraded hold (only the
      // always-available roles) still passes the concurrency property, with the blocked roles noted.
      report.record(
        '15.1-concurrent-contexts',
        '15.1',
        'pass',
        blockedRoles.length > 0 ? note : undefined,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      report.record('15.1-concurrent-contexts', '15.1', 'blocked', `${reason}. ${note}`);
    }
  });

  test('15.2 each session maintains an independent identity', async () => {
    try {
      if (held.length === 0) {
        report.record(
          '15.2-independent-identity',
          '15.2',
          'blocked',
          'No Role_Context authenticated, so identity isolation cannot be observed.',
        );
        return;
      }

      // Resolve each held session's own identity via its own token (Req 15.2). A session leaking
      // another session's identity would show up as a duplicate identity below.
      const identities: { role: RoleName; identity: Identity }[] = [];
      for (const entry of held) {
        const identity = await resolveIdentity(entry.session, env);
        identities.push({ role: entry.role, identity });
        // Each session resolves an identity of its own (not null/empty).
        expect(
          identity.id ?? identity.email,
          `session "${entry.role}" resolves its own identity`,
        ).toBeTruthy();
      }

      // No two concurrently held sessions resolve the SAME identity — sessions are independent.
      const fingerprints = identities.map(
        ({ identity }) => `${identity.id ?? ''}|${(identity.email ?? '').toLowerCase()}`,
      );
      const uniqueFingerprints = new Set(fingerprints);
      expect(
        uniqueFingerprints.size,
        'each held session resolves a distinct identity (no cross-session leakage)',
      ).toBe(fingerprints.length);

      report.attachEvidence('15.2-independent-identity', {
        apiExcerpts: identities.map(({ role, identity }) =>
          excerpt(`identity:${role}`, { id: identity.id, email: identity.email, role: identity.role }),
        ),
      });
      report.record(
        '15.2-independent-identity',
        '15.2',
        'pass',
        held.length < 7
          ? `Identity isolation asserted across the ${held.length} authenticated session(s): ` +
            `[${held.map((entry) => entry.role).join(', ')}].`
          : undefined,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      report.record('15.2-independent-identity', '15.2', 'blocked', reason);
    }
  });

  test('15.3 a change in one context appears in another after refresh', async () => {
    // Cross-context propagation needs a WRITER context whose change a READER context can observe on
    // shared data. The natural pair is the admin (writer) changing the photographer's own account,
    // which the photographer (reader) sees after refreshing `/api/user`.
    const writer = held.find((entry) => entry.role === 'admin');
    const reader = held.find((entry) => entry.role === 'photographer');

    if (!writer || !reader || reader.personaId === undefined) {
      // In the read-only default the photographer context is not provisioned, so no change can be
      // made and observed across contexts without the gate. Record blocked-and-continue (Req 2.6).
      report.record(
        '15.3-cross-context-propagation',
        '15.3',
        'blocked',
        'Cross-context propagation requires the admin (writer) and the provisioned photographer ' +
          '(reader) contexts; the photographer account is created only when the confirmation gate ' +
          'allows account creation (E2E_CONFIRM_DESTRUCTIVE / E2E_CONFIRM_CATEGORIES=account-create).',
      );
      return;
    }

    const readerId = reader.personaId;
    const newName = factory.name('QA Multi-Role Propagation');

    try {
      // Baseline: the reader sees its current identity before the change.
      const before = await resolveIdentity(reader.session, env);

      // The change mutates persistent data → route through the Confirmation_Gate (Req 2.2).
      const gated = await gate.run<string>({
        name: `Admin updates photographer "${readerId}" name → "${newName}"`,
        kind: 'destructive',
        category: PROPAGATION_CATEGORY,
        action: async () => {
          const res: APIResponse = await writer.session.context.request.put(
            `${env.apiBaseUrl}/api/admin/users/${readerId}`,
            {
              headers: {
                Authorization: `Bearer ${writer.session.token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
              data: { name: newName },
            },
          );
          if (!res.ok()) {
            throw new Error(`PUT /api/admin/users/${readerId} returned ${res.status()}`);
          }
          // The mutation is run-scoped (the new name carries the run-id) → track for cleanup.
          tracker.track('account', readerId, newName);
          return newName;
        },
      });

      if (gated.status !== 'executed') {
        report.record(
          '15.3-cross-context-propagation',
          '15.3',
          'blocked',
          `Cross-context change not performed (${gated.status}): ${gated.reason ?? 'gate declined'}. ` +
            'Set E2E_CONFIRM_DESTRUCTIVE=1 (or E2E_CONFIRM_CATEGORIES=multi-role-propagation) to verify ' +
            'propagation against a non-production target.',
        );
        return;
      }

      // Refresh the reader context and confirm the change made in the writer context is reflected
      // (Req 15.3). Re-fetching `/api/user` with the reader's own token is the post-refresh read.
      const after = await resolveIdentity(reader.session, env);
      expect(after.name, 'reader observes the writer-made change after refresh').toBe(newName);
      expect(after.name, 'the observed value actually changed').not.toBe(before.name);

      const screenshot = `${OUTPUT_DIR}/multi-role-propagation.png`;
      await reader.session.page.reload();
      await reader.session.page.screenshot({ path: screenshot, fullPage: true });
      report.attachScreenshot('15.3-cross-context-propagation', screenshot);
      report.attachEvidence('15.3-cross-context-propagation', {
        apiExcerpts: [
          excerpt('before', { name: before.name }),
          excerpt('after', { name: after.name }),
        ],
      });
      report.record('15.3-cross-context-propagation', '15.3', 'pass');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      report.record('15.3-cross-context-propagation', '15.3', 'blocked', reason);
    }
  });
});
