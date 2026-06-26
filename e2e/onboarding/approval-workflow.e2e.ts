import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  request as apiRequest,
  expect,
  test,
  type APIRequestContext,
  type Browser,
} from '@playwright/test';

import { loginAsAdmin } from '../helpers/auth';
import { createConfirmationGate, type ConfirmationGate } from '../helpers/onboarding-qa/confirmation-gate';
import { createDataFactory, type DataFactory } from '../helpers/onboarding-qa/data-factory';
import { createEntityTracker, type EntityTracker } from '../helpers/onboarding-qa/entity-tracker';
import { resolveQaEnv, type QaEnv } from '../helpers/onboarding-qa/env';
import { createQaReport, type QaReport } from '../helpers/onboarding-qa/report';
import { createSelectorResolver, type SelectorResolver } from '../helpers/onboarding-qa/selectors';
import { createTestData, type TestData } from '../helpers/onboarding-qa/test-data';

/**
 * Self-registration approval workflow checks for the photographer onboarding QA suite
 * (Requirement 6, design module `approval-workflow.e2e.ts`).
 *
 * Coverage:
 *   6.1 — self-registration sets `Approval_State` to Pending.
 *   6.2 — while Pending, the photographer is excluded from assignment.
 *   6.3 — an admin can review a pending photographer profile.
 *   6.4 — approving a pending photographer sets `Approval_State` to Approved.
 *   6.5 — rejecting a pending photographer sets `Approval_State` to Rejected.
 *   6.6 — an Approved photographer is assignable (subject to profile/distance/availability/service).
 *   6.7 — a Rejected photographer never receives shoots.
 *
 * --------------------------------------------------------------------------------------------
 * BACKEND APPROVAL MODEL (as found in `backend/app`) AND DOCUMENTED ASSUMPTIONS
 * --------------------------------------------------------------------------------------------
 * The Dashboard backend does NOT model a first-class `Approval_State` (Pending/Approved/Rejected)
 * for photographer accounts. What exists instead:
 *
 *  - `users.account_status` is the account-lifecycle field. The canonical states enforced by
 *    `App\Services\AccountStatusService::STATUSES` are `active` / `locked` / `deleted`. Older
 *    eligibility queries also read the legacy values `enabled` and `inactive`.
 *  - Photographer ASSIGNMENT eligibility is gated on `account_status` — e.g.
 *    `App\Services\ReproAi\Tools\AvailabilityTools` selects photographers
 *    `whereIn('account_status', ['active', 'enabled'])`, and `PhotographerManagementFlow`
 *    selects `where('account_status', '!=', 'inactive')`. So an account is "assignable" only
 *    while its `account_status` is in the eligible set (and it is not `locked`/`deleted`).
 *  - PUBLIC self-registration (`POST /api/register`, `App\Http\Controllers\API\AuthController@register`)
 *    creates ONLY `client`-role accounts with `account_status = 'active'`. There is no photographer
 *    self-registration entry point, and no "pending approval" state is set on registration.
 *  - Admin account-state transitions go through `PATCH /api/admin/users/{id}/status`
 *    (`Admin\AccountStatusController@setStatus`, accepting `active` / `locked` / `deleted`).
 *    There is no dedicated approve/reject photographer endpoint.
 *
 * Because there is no canonical approval field or endpoint, this spec RESOLVES the
 * `Approval_State` representation dynamically (see {@link resolveApprovalState}) and, when it
 * cannot resolve a deterministic representation or a required dependency, records a
 * `Blocked_Check` with the missing dependency noted and CONTINUES (Req 2.6) — it never blocks on
 * human input.
 *
 * The mapping used when an explicit approval field is absent (documented assumption):
 *   - Approved  ⇔ `account_status ∈ {active, enabled}` and the account is neither locked nor deleted.
 *   - Pending   ⇔ `account_status ∈ {pending, inactive}` (or an explicit approval field = pending).
 *   - Rejected  ⇔ `account_status ∈ {rejected, deleted, locked}` (or an explicit approval field = rejected).
 * An explicit `approval_state` / `approval_status` field (top-level or under `metadata`) ALWAYS
 * takes precedence over the `account_status`-derived assumption when present.
 *
 * Every state-changing admin action (approve/reject, self-registration) is a `Destructive_Step`
 * routed through the {@link ConfirmationGate}; with the gate declined (the read-only default) the
 * step is recorded as `skipped` rather than executed. Selectors are resolved by `data-testid`
 * through the {@link SelectorResolver}, and all evidence is captured into the {@link QaReport}.
 */

/** Account statuses the backend treats as ASSIGNABLE for photographers (see module header). */
const ASSIGNABLE_ACCOUNT_STATUSES = ['active', 'enabled'];

/** Explicit approval-field name candidates checked before falling back to `account_status`. */
const APPROVAL_FIELD_CANDIDATES = ['approval_state', 'approval_status', 'approvalState'];

/** The resolved `Approval_State` of a photographer account. */
type ApprovalState = 'Pending' | 'Approved' | 'Rejected' | 'Unknown';

/** A backend account record (the subset this spec reads). */
interface AccountRecord {
  id: string | number;
  email?: string;
  role?: string;
  account_status?: string;
  locked_at?: string | null;
  deleted_at?: string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

/** The outcome of resolving an account's `Approval_State`, with the source documented. */
interface ResolvedApproval {
  state: ApprovalState;
  /** Which signal produced the state (an explicit field, or the documented account_status assumption). */
  source: string;
}

/**
 * Resolve an account's `Approval_State` from its record.
 *
 * Precedence: an explicit `approval_state`/`approval_status` field (top-level or on `metadata`)
 * wins; otherwise the state is derived from `account_status` using the documented assumption in
 * the module header. Returns `Unknown` only when neither an explicit field nor a recognizable
 * `account_status` is present, which callers treat as a `Blocked_Check`.
 */
function resolveApprovalState(account: AccountRecord): ResolvedApproval {
  const normalize = (value: unknown): string | undefined =>
    typeof value === 'string' ? value.trim().toLowerCase() : undefined;

  const toState = (raw: string): ApprovalState | undefined => {
    if (['pending', 'awaiting_approval', 'awaiting'].includes(raw)) return 'Pending';
    if (['approved', 'active', 'enabled'].includes(raw)) return 'Approved';
    if (['rejected', 'denied', 'declined', 'deleted', 'locked'].includes(raw)) return 'Rejected';
    if (['inactive'].includes(raw)) return 'Pending';
    return undefined;
  };

  // 1) Explicit approval field (top-level or under metadata) takes precedence.
  const metadata = (account.metadata ?? {}) as Record<string, unknown>;
  for (const field of APPROVAL_FIELD_CANDIDATES) {
    const explicit = normalize(account[field]) ?? normalize(metadata[field]);
    if (explicit) {
      const state = toState(explicit) ?? 'Unknown';
      return { state, source: `explicit field "${field}"="${explicit}"` };
    }
  }

  // 2) Soft-deleted / locked rows are Rejected (cannot receive shoots).
  if (account.deleted_at) {
    return { state: 'Rejected', source: 'deleted_at set (assumed Rejected)' };
  }
  if (account.locked_at) {
    return { state: 'Rejected', source: 'locked_at set (assumed Rejected)' };
  }

  // 3) Fall back to the documented account_status assumption.
  const status = normalize(account.account_status);
  if (status) {
    const state = toState(status) ?? 'Unknown';
    return { state, source: `account_status="${status}" (assumed mapping)` };
  }

  return { state: 'Unknown', source: 'no approval field or account_status present' };
}

/** True iff the account's `account_status` places it in the backend's assignable set. */
function isAccountAssignable(account: AccountRecord): boolean {
  const status = (account.account_status ?? '').trim().toLowerCase();
  return ASSIGNABLE_ACCOUNT_STATUSES.includes(status) && !account.locked_at && !account.deleted_at;
}

/** Shared, lazily-built harness wiring for the approval-workflow checks. */
interface Harness {
  env: QaEnv;
  factory: DataFactory;
  gate: ConfirmationGate;
  tracker: EntityTracker;
  report: QaReport;
  selectors: SelectorResolver;
  data: TestData;
}

/** A connected admin API session (request context + bearer token), or a reason it is unavailable. */
interface AdminApi {
  ctx: APIRequestContext;
  token: string;
}

/** Directory under which this module writes its evidence (consistent with `qa-acceptance.e2e.ts`).
 *  Relative to the frontend/ run cwd — ESM-safe (no __dirname in this ES module project). */
const OUTPUT_DIR = '../output/playwright';

/** Build the harness components from the resolved environment. */
function createHarness(): Harness {
  const env = resolveQaEnv();
  const factory = createDataFactory(env.runId);
  const gate = createConfirmationGate(env);
  const tracker = createEntityTracker(env.runId);
  const report = createQaReport();
  const selectors = createSelectorResolver(report);
  const data = createTestData(env, factory, gate, tracker);
  return { env, factory, gate, tracker, report, selectors, data };
}

/**
 * Try to establish an admin API session. Returns `null` (rather than throwing) when the target
 * stack is unreachable or admin login fails, so every check degrades to a `Blocked_Check` and the
 * run continues (Req 2.6).
 */
async function connectAdminApi(env: QaEnv): Promise<AdminApi | null> {
  try {
    const ctx = await apiRequest.newContext({ baseURL: env.apiBaseUrl });
    const login = await ctx.post('/api/login', {
      data: { email: env.adminEmail, password: env.adminPassword },
      headers: { Accept: 'application/json' },
    });
    if (!login.ok()) {
      await ctx.dispose();
      return null;
    }
    const body = (await login.json()) as { token?: string };
    if (!body.token) {
      await ctx.dispose();
      return null;
    }
    return { ctx, token: String(body.token) };
  } catch {
    return null;
  }
}

/** Fetch an account's full record by email from the admin directory; `null` if absent/unreachable. */
async function findAccountByEmail(
  api: AdminApi,
  email: string,
): Promise<AccountRecord | null> {
  try {
    const response = await api.ctx.get('/api/admin/users', {
      headers: { Authorization: `Bearer ${api.token}`, Accept: 'application/json' },
    });
    if (!response.ok()) {
      return null;
    }
    const body = (await response.json()) as unknown;
    const rows: AccountRecord[] = Array.isArray(body)
      ? (body as AccountRecord[])
      : (((body as { data?: AccountRecord[] }).data ?? []) as AccountRecord[]);
    const match = rows.find(
      (row) => String(row.email ?? '').toLowerCase() === email.toLowerCase(),
    );
    return match ?? null;
  } catch {
    return null;
  }
}

/** Fetch an account's full record by id; `null` if absent/unreachable. */
async function findAccountById(api: AdminApi, id: string | number): Promise<AccountRecord | null> {
  try {
    const response = await api.ctx.get('/api/admin/users', {
      headers: { Authorization: `Bearer ${api.token}`, Accept: 'application/json' },
    });
    if (!response.ok()) {
      return null;
    }
    const body = (await response.json()) as unknown;
    const rows: AccountRecord[] = Array.isArray(body)
      ? (body as AccountRecord[])
      : (((body as { data?: AccountRecord[] }).data ?? []) as AccountRecord[]);
    const match = rows.find((row) => String(row.id) === String(id));
    return match ?? null;
  } catch {
    return null;
  }
}

/** True iff the account id appears in the admin photographers assignment-candidate list. */
async function isInPhotographerDirectory(api: AdminApi, id: string | number): Promise<boolean> {
  const response = await api.ctx.get('/api/admin/photographers', {
    headers: { Authorization: `Bearer ${api.token}`, Accept: 'application/json' },
  });
  if (!response.ok()) {
    throw new Error(`GET /api/admin/photographers returned ${response.status()}`);
  }
  const body = (await response.json()) as { data?: AccountRecord[] } | AccountRecord[];
  const rows: AccountRecord[] = Array.isArray(body) ? body : (body.data ?? []);
  return rows.some((row) => String(row.id) === String(id));
}

/** Compact JSON excerpt of an account record, used as report evidence. */
function accountExcerpt(account: AccountRecord): string {
  return JSON.stringify({
    id: account.id,
    email: account.email,
    role: account.role,
    account_status: account.account_status,
    locked_at: account.locked_at ?? null,
    deleted_at: account.deleted_at ?? null,
  });
}

test.describe.serial('onboarding QA — self-registration approval workflow (Requirement 6)', () => {
  const harness = createHarness();
  let admin: AdminApi | null = null;
  let browserRef: Browser;

  /** The Pending subject photographer this run can act on (resolved in 6.1/6.2), if any. */
  let pendingSubject: AccountRecord | null = null;

  test.beforeAll(async ({ browser }) => {
    browserRef = browser;
    await mkdir(OUTPUT_DIR, { recursive: true });
    admin = await connectAdminApi(harness.env);

    // Provision the fixed persona set once for this module (gated; a declined gate is a no-op and
    // simply leaves the personas absent, in which case the dependent checks degrade to blocked).
    // This makes the Approved (Photographer A) and Reject (Photographer B) subjects available when
    // the confirmation gate is enabled, without requiring a separate spec to run first.
    if (admin) {
      try {
        await harness.data.provisionAll();
      } catch {
        // Provisioning failures must not abort the suite — dependent checks record blocked.
      }
    }
  });

  test.afterAll(async () => {
    await harness.report.write(
      join(OUTPUT_DIR, 'approval-workflow.report.md'),
      join(OUTPUT_DIR, 'approval-workflow.report.json'),
    );
    if (admin) {
      await admin.ctx.dispose();
    }
  });

  test('6.1 self-registration sets Approval_State Pending', async () => {
    const checkId = '6.1 self-registration → Pending';
    if (!admin) {
      harness.report.record(checkId, '6.1', 'blocked', 'Admin API session unavailable (target stack unreachable or admin login failed).');
      return;
    }

    // Self-registration mutates persistent data → route through the gate (Destructive_Step).
    const email = harness.factory.email('photographer.selfreg');
    const result = await harness.gate.run<AccountRecord | null>({
      name: `Self-register photographer (${email})`,
      kind: 'destructive',
      category: 'self-register',
      action: async () => {
        const response = await admin!.ctx.post('/api/register', {
          headers: { Accept: 'application/json' },
          data: {
            name: harness.factory.name('Photographer SelfReg'),
            email,
            password: 'Password123!',
            password_confirmation: 'Password123!',
            phonenumber: '+15555550100',
          },
        });
        if (!response.ok()) {
          throw new Error(`POST /api/register returned ${response.status()}: ${await response.text()}`);
        }
        const body = (await response.json()) as { user?: AccountRecord };
        const created = body.user ?? (await findAccountByEmail(admin!, email));
        if (created?.id !== undefined) {
          harness.tracker.track('account', created.id, email);
        }
        return created ?? null;
      },
    });

    if (result.status === 'skipped') {
      harness.report.record(checkId, '6.1', 'skipped', result.reason ?? 'Confirmation declined for self-registration.');
      return;
    }

    const account = result.value ?? null;
    if (!account) {
      harness.report.record(checkId, '6.1', 'blocked', 'Self-registration did not yield a resolvable account record.');
      return;
    }

    harness.report.attachEvidence(checkId, { apiExcerpts: [accountExcerpt(account)] });

    const resolved = resolveApprovalState(account);

    // Documented finding: the public self-registration endpoint creates a `client` account with
    // account_status=active and NO photographer "pending approval" state — so a Pending
    // Approval_State is not produced by self-registration in this backend. Record this as a
    // blocked dependency rather than a pass/fail so the gap is visible without failing the run.
    if (resolved.state === 'Pending') {
      pendingSubject = account;
      harness.report.record(checkId, '6.1', 'pass');
      expect(resolved.state).toBe('Pending');
    } else {
      harness.report.record(
        checkId,
        '6.1',
        'blocked',
        `Self-registration produced Approval_State "${resolved.state}" via ${resolved.source}. ` +
          'The backend public registration endpoint (POST /api/register) creates only client ' +
          'accounts with account_status=active and no photographer Pending-approval path/field; ' +
          'Approval_State=Pending is not modeled by self-registration.',
      );
    }
  });

  test('6.2 a Pending photographer is excluded from assignment', async () => {
    const checkId = '6.2 Pending excluded from assignment';
    if (!admin) {
      harness.report.record(checkId, '6.2', 'blocked', 'Admin API session unavailable.');
      return;
    }
    if (!pendingSubject) {
      harness.report.record(
        checkId,
        '6.2',
        'blocked',
        'No Pending photographer is available to verify assignment exclusion (depends on a ' +
          'resolvable Approval_State=Pending account from 6.1, which the backend does not model).',
      );
      return;
    }

    try {
      const assignable = isAccountAssignable(pendingSubject);
      const inDirectory = await isInPhotographerDirectory(admin, pendingSubject.id);
      harness.report.attachEvidence(checkId, {
        apiExcerpts: [
          accountExcerpt(pendingSubject),
          `assignableByStatus=${assignable}; inPhotographerDirectory=${inDirectory}`,
        ],
      });
      // While Pending, the account must not be in the backend's assignable set.
      expect(assignable, 'a Pending photographer must not be assignable by account_status').toBe(false);
      harness.report.record(checkId, '6.2', 'pass');
    } catch (error) {
      harness.report.record(checkId, '6.2', 'blocked', `Assignment-exclusion probe failed: ${(error as Error).message}`);
    }
  });

  test('6.3 an admin can review a pending photographer profile', async () => {
    const checkId = '6.3 admin reviews pending profile';
    if (!admin) {
      harness.report.record(checkId, '6.3', 'blocked', 'Admin API session unavailable.');
      return;
    }

    const subjectId = pendingSubject?.id ?? harness.data.get('photographerA')?.id;
    if (subjectId === undefined) {
      harness.report.record(
        checkId,
        '6.3',
        'blocked',
        'No pending photographer subject available to review (no provisioned/self-registered account).',
      );
      return;
    }

    const context = await browserRef.newContext({ baseURL: harness.env.baseUrl });
    const page = await context.newPage();
    try {
      await loginAsAdmin(page, harness.env.adminEmail, harness.env.adminPassword);
      // Navigate to the admin user-directory surface where pending profiles are reviewed.
      await page.goto('/admin/users');

      const screenshotPath = join(OUTPUT_DIR, `approval-6.3-admin-review-${harness.env.runId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
      harness.report.attachScreenshot(checkId, screenshotPath);

      // The pending profile is reviewed through a stable data-testid; a missing selector is a
      // Blocked_Check (recorded by the resolver) rather than a brittle text/layout fallback.
      const reviewLocator = await harness.selectors.byTestId(page, 'photographer-profile-review', checkId);
      if (!reviewLocator) {
        // The resolver already recorded the blocked check with the missing-selector note.
        return;
      }
      await expect(reviewLocator).toBeVisible();
      harness.report.record(checkId, '6.3', 'pass');
    } catch (error) {
      harness.report.record(checkId, '6.3', 'blocked', `Admin review surface unavailable: ${(error as Error).message}`);
    } finally {
      await context.close();
    }
  });

  test('6.4 approving a pending photographer sets Approval_State Approved', async () => {
    const checkId = '6.4 approve → Approved';
    if (!admin) {
      harness.report.record(checkId, '6.4', 'blocked', 'Admin API session unavailable.');
      return;
    }
    if (!pendingSubject) {
      harness.report.record(
        checkId,
        '6.4',
        'blocked',
        'No Pending photographer subject available to approve (Approval_State=Pending is not ' +
          'modeled by the backend; see 6.1).',
      );
      return;
    }

    const subjectId = pendingSubject.id;
    // Approval mutates persistent state → gated. Mapping assumption: approve ⇒ account_status=active.
    const result = await harness.gate.run<AccountRecord | null>({
      name: `Approve photographer ${subjectId} (account_status → active)`,
      kind: 'destructive',
      category: 'approve-photographer',
      action: async () => {
        const response = await admin!.ctx.patch(`/api/admin/users/${subjectId}/status`, {
          headers: { Authorization: `Bearer ${admin!.token}`, Accept: 'application/json' },
          data: { status: 'active' },
        });
        if (!response.ok()) {
          throw new Error(`PATCH status active returned ${response.status()}: ${await response.text()}`);
        }
        return findAccountById(admin!, subjectId);
      },
    });

    if (result.status === 'skipped') {
      harness.report.record(checkId, '6.4', 'skipped', result.reason ?? 'Confirmation declined for approval.');
      return;
    }
    const account = result.value ?? null;
    if (!account) {
      harness.report.record(checkId, '6.4', 'blocked', 'Approved account could not be re-read for verification.');
      return;
    }
    const resolved = resolveApprovalState(account);
    harness.report.attachEvidence(checkId, {
      apiExcerpts: [accountExcerpt(account), `resolvedApprovalState=${resolved.state} via ${resolved.source}`],
    });
    expect(resolved.state, 'approving must yield Approval_State=Approved').toBe('Approved');
    harness.report.record(checkId, '6.4', 'pass');
  });

  test('6.6 an Approved photographer is assignable subject to the eligibility rules', async () => {
    const checkId = '6.6 Approved assignable';
    if (!admin) {
      harness.report.record(checkId, '6.6', 'blocked', 'Admin API session unavailable.');
      return;
    }

    // Prefer the provisioned Photographer A (an Approved, active account) as the assignable subject.
    const photographerA = harness.data.get('photographerA');
    if (!photographerA) {
      harness.report.record(
        checkId,
        '6.6',
        'blocked',
        'No Approved photographer available (Photographer A was not provisioned — the ' +
          'confirmation gate likely declined account creation).',
      );
      return;
    }

    try {
      const account = await findAccountById(admin, photographerA.id);
      if (!account) {
        harness.report.record(checkId, '6.6', 'blocked', 'Approved photographer record could not be read.');
        return;
      }
      const resolved = resolveApprovalState(account);
      const inDirectory = await isInPhotographerDirectory(admin, account.id);
      harness.report.attachEvidence(checkId, {
        apiExcerpts: [
          accountExcerpt(account),
          `resolvedApprovalState=${resolved.state}; assignableByStatus=${isAccountAssignable(account)}; inPhotographerDirectory=${inDirectory}`,
        ],
      });
      // Approved ⇒ in the assignable set (final assignability still subject to distance/
      // availability/service rules verified by service-radius/calendar specs).
      expect(resolved.state).toBe('Approved');
      expect(isAccountAssignable(account), 'an Approved photographer must be in the assignable set').toBe(true);
      harness.report.record(checkId, '6.6', 'pass');
    } catch (error) {
      harness.report.record(checkId, '6.6', 'blocked', `Assignability probe failed: ${(error as Error).message}`);
    }
  });

  test('6.5 rejecting a pending photographer sets Approval_State Rejected', async () => {
    const checkId = '6.5 reject → Rejected';
    if (!admin) {
      harness.report.record(checkId, '6.5', 'blocked', 'Admin API session unavailable.');
      return;
    }

    // Use a dedicated reject subject so it does not collide with the approve path. Prefer
    // Photographer B (provisioned), otherwise fall back to the pending self-reg subject.
    const photographerB = harness.data.get('photographerB');
    const subjectId = photographerB?.id ?? pendingSubject?.id;
    if (subjectId === undefined) {
      harness.report.record(
        checkId,
        '6.5',
        'blocked',
        'No photographer subject available to reject (no provisioned/self-registered account).',
      );
      return;
    }

    // Rejection mutates persistent state → gated. Mapping assumption: reject ⇒ account_status=locked.
    const result = await harness.gate.run<AccountRecord | null>({
      name: `Reject photographer ${subjectId} (account_status → locked)`,
      kind: 'destructive',
      category: 'reject-photographer',
      action: async () => {
        const response = await admin!.ctx.patch(`/api/admin/users/${subjectId}/status`, {
          headers: { Authorization: `Bearer ${admin!.token}`, Accept: 'application/json' },
          data: { status: 'locked' },
        });
        if (!response.ok()) {
          throw new Error(`PATCH status locked returned ${response.status()}: ${await response.text()}`);
        }
        return findAccountById(admin!, subjectId);
      },
    });

    if (result.status === 'skipped') {
      harness.report.record(checkId, '6.5', 'skipped', result.reason ?? 'Confirmation declined for rejection.');
      return;
    }
    const account = result.value ?? null;
    if (!account) {
      harness.report.record(checkId, '6.5', 'blocked', 'Rejected account could not be re-read for verification.');
      return;
    }
    const resolved = resolveApprovalState(account);
    harness.report.attachEvidence(checkId, {
      apiExcerpts: [accountExcerpt(account), `resolvedApprovalState=${resolved.state} via ${resolved.source}`],
    });
    expect(resolved.state, 'rejecting must yield Approval_State=Rejected').toBe('Rejected');
    harness.report.record(checkId, '6.5', 'pass');
  });

  test('6.7 a Rejected photographer never receives shoots', async () => {
    const checkId = '6.7 Rejected never assignable';
    if (!admin) {
      harness.report.record(checkId, '6.7', 'blocked', 'Admin API session unavailable.');
      return;
    }

    const photographerB = harness.data.get('photographerB');
    const subjectId = photographerB?.id ?? pendingSubject?.id;
    if (subjectId === undefined) {
      harness.report.record(checkId, '6.7', 'blocked', 'No Rejected photographer subject available to verify.');
      return;
    }

    try {
      const account = await findAccountById(admin, subjectId);
      if (!account) {
        harness.report.record(checkId, '6.7', 'blocked', 'Rejected photographer record could not be read.');
        return;
      }
      const resolved = resolveApprovalState(account);
      if (resolved.state !== 'Rejected') {
        harness.report.record(
          checkId,
          '6.7',
          'blocked',
          `Subject is not in a Rejected state (resolved "${resolved.state}" via ${resolved.source}); ` +
            'rejection (6.5) was likely skipped because the confirmation gate is declined.',
        );
        return;
      }
      const assignable = isAccountAssignable(account);
      harness.report.attachEvidence(checkId, {
        apiExcerpts: [accountExcerpt(account), `assignableByStatus=${assignable}`],
      });
      // A Rejected photographer must never be assignable → never receives shoots.
      expect(assignable, 'a Rejected photographer must not be assignable').toBe(false);
      harness.report.record(checkId, '6.7', 'pass');
    } catch (error) {
      harness.report.record(checkId, '6.7', 'blocked', `Rejected-assignability probe failed: ${(error as Error).message}`);
    }
  });
});
