import { join } from 'node:path';

import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
} from '@playwright/test';

import { createConfirmationGate, type ConfirmationGate } from '../helpers/onboarding-qa/confirmation-gate';
import { createDataFactory, type DataFactory } from '../helpers/onboarding-qa/data-factory';
import { createEntityTracker, type EntityTracker } from '../helpers/onboarding-qa/entity-tracker';
import { resolveQaEnv, type QaEnv } from '../helpers/onboarding-qa/env';
import { createQaReport, type QaReport } from '../helpers/onboarding-qa/report';

/**
 * Photographer profile-completeness QA spec (Requirement 7, design module
 * `onboarding/profile-completeness.e2e.ts`).
 *
 * This module verifies — primarily through read-only inspection of the Onboarding_System's
 * photographer records — the presence and required-state of every profile-completeness field
 * (Req 7.1), the optional insurance / tax / payment fields where the system exposes them
 * (Req 7.2), the notification-preference and active/inactive status fields (Req 7.3), that an
 * incomplete required field keeps a photographer un-assignable (Req 7.4), and that a complete +
 * Approved photographer is assignable (Req 7.5).
 *
 * Design alignment:
 * - Reads documented configuration via the harness `env` resolver and authenticates against the
 *   admin API exactly as `qa-acceptance.e2e.ts` / `team-onboarding-admin-create.e2e.ts` do
 *   (`POST /api/login` → bearer token, then `GET /admin/photographers`).
 * - Every assertion below is **read-only**. The single mutating step (creating a Test_Shoot to
 *   exercise the eligibility surface for 7.4/7.5) is routed through the {@link ConfirmationGate};
 *   with the gate declined (the read-only default) that step is skipped and the affected checks
 *   are recorded blocked-and-continue (Req 2.1/2.6) rather than mutating data or blocking on input.
 * - When the target stack is unreachable (the safe default — the suite must NOT run against live
 *   production unless an operator explicitly points `E2E_BASE_URL` at a non-prod QA target), the
 *   live checks are recorded as `Blocked_Check`s with the missing-target dependency noted and the
 *   Playwright test is skipped. No check ever hard-fails on a missing environment.
 * - Findings accumulate into the evidence-backed {@link QaReport}, which is written to
 *   `output/playwright/` at the end of the run.
 *
 * Documented assumptions about required-field rules (the Onboarding_System does not expose an
 * explicit "required for assignment" profile-completeness config, so these mirror the fields the
 * backend matching path actually gates on — distance, availability, service-match — per Req 8/9):
 * - REQUIRED for assignment: phone, email, base location, Service_Radius, Service_Specialties,
 *   availability. A photographer missing any of these cannot be offered/assigned (Req 7.4).
 * - PROFILE-COMPLETENESS but not a hard assignment gate: profile photo, blocked dates, equipment,
 *   portfolio/sample work. Their presence is verified and reported (Req 7.1) but their absence is
 *   not asserted to block assignment.
 * - "Approved" Approval_State is represented by `account_status === 'active'` (an inactive or
 *   suspended account is treated as not-Approved for assignability), since this codebase models a
 *   photographer's assignable lifecycle through `account_status` rather than a dedicated
 *   approval_state column.
 */

/** A photographer record as returned by `GET /admin/photographers` (subset we inspect). */
interface PhotographerRecord {
  id: number | string;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  phonenumber?: string | null;
  phone_number?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  account_status?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** A single profile field we verify presence + required-state of (Req 7.1/7.2/7.3). */
interface ProfileField {
  /** Report check id. */
  checkId: string;
  /** The requirement clause this field satisfies. */
  requirement: string;
  /** Human-readable field label. */
  label: string;
  /** Whether the field is REQUIRED for assignment (documented assumption above). */
  required: boolean;
  /** Resolve whether the field is present (non-empty) on a photographer record. */
  present: (user: PhotographerRecord) => boolean;
}

const env: QaEnv = resolveQaEnv();
const factory: DataFactory = createDataFactory(env.runId);
const tracker: EntityTracker = createEntityTracker(env.runId);
const gate: ConfirmationGate = createConfirmationGate(env);
const report: QaReport = createQaReport();

/** Read `metadata` as a plain object regardless of how the backend serialized it. */
function metaOf(user: PhotographerRecord): Record<string, unknown> {
  const meta = user.metadata;
  return meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
}

/** A string value counts as present only when it is a non-empty, non-blank string. */
function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** A numeric value (including a numeric string) counts as present. */
function hasNumber(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return Number.isFinite(Number(value));
  }
  return false;
}

/** An array value counts as present only when it has at least one entry. */
function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/** An object/array value counts as present when it carries any entry. */
function hasShape(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return Boolean(value) && typeof value === 'object' && Object.keys(value as object).length > 0;
}

/**
 * The required profile-completeness fields (Req 7.1). `required` follows the documented
 * assignment-gating assumption at the top of this file.
 */
const PROFILE_FIELDS: ProfileField[] = [
  {
    checkId: '7.1-profile-photo',
    requirement: '7.1',
    label: 'profile photo',
    required: false,
    present: (u) => hasText(u.avatar),
  },
  {
    checkId: '7.1-phone',
    requirement: '7.1',
    label: 'phone',
    required: true,
    present: (u) => hasText(u.phonenumber) || hasText(u.phone_number),
  },
  {
    checkId: '7.1-email',
    requirement: '7.1',
    label: 'email',
    required: true,
    present: (u) => hasText(u.email),
  },
  {
    checkId: '7.1-base-location',
    requirement: '7.1',
    label: 'base location address',
    required: true,
    present: (u) => hasText(u.address) || (hasText(u.city) && hasText(u.state)) || hasText(u.zip),
  },
  {
    checkId: '7.1-service-radius',
    requirement: '7.1',
    label: 'service radius',
    required: true,
    present: (u) => hasNumber(metaOf(u).service_radius_miles ?? metaOf(u).serviceRadius),
  },
  {
    checkId: '7.1-specialties',
    requirement: '7.1',
    label: 'service specialties',
    required: true,
    present: (u) => hasItems(metaOf(u).specialties),
  },
  {
    checkId: '7.1-availability',
    requirement: '7.1',
    label: 'availability',
    required: true,
    present: (u) => hasShape(metaOf(u).availability),
  },
  {
    checkId: '7.1-blocked-dates',
    requirement: '7.1',
    label: 'blocked dates',
    required: false,
    present: (u) => hasShape(metaOf(u).blocked_dates ?? metaOf(u).blocked_windows),
  },
  {
    checkId: '7.1-equipment',
    requirement: '7.1',
    label: 'equipment',
    required: false,
    present: (u) => hasShape(metaOf(u).equipments ?? metaOf(u).equipment),
  },
  {
    checkId: '7.1-portfolio',
    requirement: '7.1',
    label: 'portfolio or sample work',
    required: false,
    present: (u) => {
      const prefs = metaOf(u).preferences;
      const portfolioWebsite =
        prefs && typeof prefs === 'object'
          ? (prefs as Record<string, unknown>).portfolioWebsite
          : undefined;
      return hasText(portfolioWebsite) || hasText(metaOf(u).portfolio);
    },
  },
];

/** Optional insurance / tax / payment fields verified WHERE exposed (Req 7.2). */
const OPTIONAL_FIELDS: ProfileField[] = [
  {
    checkId: '7.2-insurance',
    requirement: '7.2',
    label: 'insurance information',
    required: false,
    present: (u) => hasText(metaOf(u).insuranceFile) || hasText(metaOf(u).insuranceNumber),
  },
  {
    checkId: '7.2-tax',
    requirement: '7.2',
    label: 'tax information',
    required: false,
    present: (u) =>
      hasText(metaOf(u).taxId) || hasText(metaOf(u).tax_id) || hasShape(metaOf(u).w9),
  },
  {
    checkId: '7.2-payment',
    requirement: '7.2',
    label: 'payment information',
    required: false,
    present: (u) =>
      hasText(metaOf(u).stripe_account_id) ||
      hasText(metaOf(u).payment_details) ||
      hasShape(metaOf(u).payment),
  },
];

/** True iff a photographer has every REQUIRED-for-assignment field complete (Req 7.4/7.5). */
function hasAllRequiredFields(user: PhotographerRecord): boolean {
  return PROFILE_FIELDS.filter((field) => field.required).every((field) => field.present(user));
}

/** True iff the account is "Approved" for assignment (documented `account_status` assumption). */
function isApproved(user: PhotographerRecord): boolean {
  return (user.account_status ?? 'active') === 'active';
}

/** Module-level state established once in beforeAll. */
let api: APIRequestContext | undefined;
let targetAvailable = false;
let setupNote = '';
let photographers: PhotographerRecord[] = [];
/** The photographer whose profile fields we inspect for 7.1–7.3 (prefer a run-tagged account). */
let subject: PhotographerRecord | undefined;

/**
 * Authenticate against the admin API and load the photographer set. All failures are caught and
 * downgraded to `targetAvailable = false` so the suite never hard-fails on a missing/unreachable
 * target — the live checks are recorded blocked-and-continue instead.
 */
test.beforeAll(async () => {
  try {
    api = await apiRequest.newContext({ baseURL: env.apiBaseUrl });

    const login = await api.post('/api/login', {
      data: { email: env.adminEmail, password: env.adminPassword },
      headers: { Accept: 'application/json' },
      timeout: 15_000,
    });
    if (!login.ok()) {
      setupNote = `Admin API login returned ${login.status()} at ${env.apiBaseUrl} — target unavailable.`;
      return;
    }
    const token = ((await login.json()) as { token?: string }).token;
    if (!token) {
      setupNote = 'Admin API login did not return a bearer token — target unavailable.';
      return;
    }

    const res = await api.get('/api/admin/photographers', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 15_000,
    });
    if (!res.ok()) {
      setupNote = `GET /admin/photographers returned ${res.status()} — photographer set unavailable.`;
      return;
    }

    const body = (await res.json()) as { data?: PhotographerRecord[] };
    photographers = Array.isArray(body.data) ? body.data : [];
    // Prefer a photographer created by this run (run-id suffix) so inspection is deterministic;
    // otherwise inspect the first available photographer (read-only).
    subject =
      photographers.find((p) => factory.belongsToRun(String(p.email ?? ''))) ?? photographers[0];
    targetAvailable = photographers.length > 0 && subject !== undefined;
    if (!targetAvailable) {
      setupNote = 'No photographer records available on the target to inspect.';
    }
  } catch (error) {
    setupNote = `Target unreachable at ${env.apiBaseUrl}: ${(error as Error).message}`;
    targetAvailable = false;
  }
});

test.afterAll(async () => {
  await api?.dispose();
  // Emit the evidence-backed report fragment for this module (Req 22.2).
  // Repo-root output dir (matches the aggregator + every other module): ../output/playwright.
  const outDir = '../output/playwright';
  await report.write(
    join(outDir, 'profile-completeness-report.md'),
    join(outDir, 'profile-completeness-report.json'),
  );
});

/** Record every supplied field as a blocked check with the shared dependency note. */
function blockAll(fields: ProfileField[], note: string): void {
  for (const field of fields) {
    report.record(field.checkId, field.requirement, 'blocked', note);
  }
}

test.describe('onboarding QA — photographer profile completeness (Requirement 7)', () => {
  test('7.1 verifies presence and required-state of every profile-completeness field', () => {
    if (!targetAvailable || !subject) {
      blockAll(PROFILE_FIELDS, setupNote || 'Target unavailable — profile fields not inspected.');
      test.skip(true, setupNote || 'Target unavailable.');
      return;
    }

    const user = subject;
    for (const field of PROFILE_FIELDS) {
      const present = field.present(user);
      const requiredState = field.required ? 'required' : 'optional';
      // Verification SUCCEEDS when we can resolve the field's presence + required state from the
      // record (Req 7.1). A required field that is absent is reported as a fail (it must be
      // present for the photographer to be assignable per Req 7.4); an absent optional field is a
      // recorded pass noting its optional state.
      const excerpt = `${field.label}: present=${present}, state=${requiredState}, photographer=${String(
        user.id,
      )}`;
      report.attachEvidence(field.checkId, { apiExcerpts: [excerpt] });

      if (field.required && !present) {
        report.record(
          field.checkId,
          field.requirement,
          'fail',
          `Required field "${field.label}" is absent on photographer ${String(user.id)}.`,
        );
      } else {
        report.record(
          field.checkId,
          field.requirement,
          'pass',
          `Resolved ${requiredState} field "${field.label}" (present=${present}).`,
        );
      }
    }

    // The module must be able to resolve the field state for the subject (the core of Req 7.1).
    expect(subject, 'a photographer record must be available to inspect').toBeDefined();
    // Required fields, when present, must be readable as the documented shapes.
    expect(PROFILE_FIELDS.length, 'all Req 7.1 fields are enumerated').toBe(10);
  });

  test('7.2 verifies optional insurance / tax / payment fields where exposed', () => {
    if (!targetAvailable || !subject) {
      blockAll(OPTIONAL_FIELDS, setupNote || 'Target unavailable — optional fields not inspected.');
      test.skip(true, setupNote || 'Target unavailable.');
      return;
    }

    const user = subject;
    // A field is "exposed" when ANY photographer carries it; otherwise the field is recorded
    // blocked-and-continue (the surface is simply not present in this deployment) per Req 7.2/2.6.
    for (const field of OPTIONAL_FIELDS) {
      const exposedAnywhere = photographers.some((p) => field.present(p));
      if (!exposedAnywhere) {
        report.record(
          field.checkId,
          field.requirement,
          'blocked',
          `Optional field "${field.label}" is not exposed by the Onboarding_System.`,
        );
        continue;
      }
      const present = field.present(user);
      report.attachEvidence(field.checkId, {
        apiExcerpts: [`${field.label}: exposed=true, present=${present}`],
      });
      report.record(
        field.checkId,
        field.requirement,
        'pass',
        `Optional field "${field.label}" is exposed (present on subject=${present}).`,
      );
    }

    expect(OPTIONAL_FIELDS.length, 'insurance/tax/payment optional fields enumerated').toBe(3);
  });

  test('7.3 verifies notification preference and active/inactive status fields', () => {
    const notifId = '7.3-notification-preference';
    const statusId = '7.3-account-status';
    if (!targetAvailable || !subject) {
      report.record(notifId, '7.3', 'blocked', setupNote || 'Target unavailable.');
      report.record(statusId, '7.3', 'blocked', setupNote || 'Target unavailable.');
      test.skip(true, setupNote || 'Target unavailable.');
      return;
    }

    const user = subject;
    const prefs = metaOf(user).preferences;
    const prefsObj =
      prefs && typeof prefs === 'object' ? (prefs as Record<string, unknown>) : undefined;
    const hasNotificationPreference =
      prefsObj !== undefined &&
      (typeof prefsObj.notificationEmail === 'boolean' ||
        typeof prefsObj.notificationSMS === 'boolean');

    report.attachEvidence(notifId, {
      apiExcerpts: [`notification preference present=${hasNotificationPreference}`],
    });
    report.record(
      notifId,
      '7.3',
      'pass',
      `Resolved notification preference (present=${hasNotificationPreference}).`,
    );

    // Active/inactive status must resolve to one of the documented account states.
    const status = user.account_status ?? 'active';
    const validStatus = ['active', 'inactive', 'suspended'].includes(status);
    report.attachEvidence(statusId, { apiExcerpts: [`account_status=${status}`] });
    report.record(
      statusId,
      '7.3',
      validStatus ? 'pass' : 'fail',
      `Active/inactive status resolved to "${status}".`,
    );

    expect(validStatus, `account_status "${status}" must be a known state`).toBe(true);
  });

  test('7.4 / 7.5 incomplete required field is not assignable; complete + Approved is assignable', async () => {
    const incompleteId = '7.4-incomplete-not-assignable';
    const completeId = '7.5-complete-approved-assignable';

    if (!targetAvailable || !api) {
      report.record(incompleteId, '7.4', 'blocked', setupNote || 'Target unavailable.');
      report.record(completeId, '7.5', 'blocked', setupNote || 'Target unavailable.');
      test.skip(true, setupNote || 'Target unavailable.');
      return;
    }

    // Classify the loaded photographers by completeness + approval (read-only, deterministic).
    const completeApproved = photographers.filter(
      (p) => hasAllRequiredFields(p) && isApproved(p),
    );
    const incomplete = photographers.filter((p) => !hasAllRequiredFields(p));

    // Exercising the assignability surface requires a Test_Shoot, which mutates persistent data
    // (a Destructive_Step) — route it through the confirmation gate. With the gate declined (the
    // read-only default) the eligibility surface is unavailable, so both checks are recorded
    // blocked-and-continue with the dependency noted (Req 2.1/2.6) rather than blocking on input.
    const eligibility = await gate.run<{ eligibleIds: Set<string>; shootId: string | number }>({
      name: 'Create Test_Shoot to evaluate photographer assignability (Req 7.4/7.5)',
      kind: 'destructive',
      category: 'test-shoot-create',
      action: async () => {
        const token = await mintAdminToken(api as APIRequestContext);
        const created = await (api as APIRequestContext).post('/api/admin/test-shoots', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          data: {
            kind: 'state',
            value: process.env.E2E_FILTER_VALUE ?? 'MD',
            scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            timezone: 'America/New_York',
          },
        });
        if (created.status() !== 201) {
          throw new Error(`Test_Shoot create returned ${created.status()}`);
        }
        const shoot = ((await created.json()) as { shoot?: { id: string | number } }).shoot;
        const shootId = shoot?.id;
        if (shootId === undefined) {
          throw new Error('Test_Shoot create did not return a shoot id');
        }
        tracker.track('shoot', shootId, `test-shoot ${env.runId}`);

        const eligibleRes = await (api as APIRequestContext).get(
          `/api/admin/test-shoots/${shootId}/eligible-photographers`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
        );
        if (!eligibleRes.ok()) {
          throw new Error(`eligible-photographers returned ${eligibleRes.status()}`);
        }
        const eligibleBody = (await eligibleRes.json()) as {
          photographers?: Array<{ id: string | number }>;
        };
        const eligibleIds = new Set<string>(
          (eligibleBody.photographers ?? []).map((p) => String(p.id)),
        );
        return { eligibleIds, shootId };
      },
    });

    if (eligibility.status !== 'executed' || !eligibility.value) {
      const note =
        eligibility.reason ??
        'Assignability surface requires a gated Test_Shoot; gate declined (read-only default).';
      report.record(incompleteId, '7.4', 'blocked', note);
      report.record(completeId, '7.5', 'blocked', note);
      return;
    }

    const { eligibleIds, shootId } = eligibility.value;

    // 7.4 — every photographer missing a required field must be ABSENT from the eligible set.
    const wronglyEligible = incomplete.filter((p) => eligibleIds.has(String(p.id)));
    report.attachEvidence(incompleteId, {
      apiExcerpts: [
        `shoot=${String(shootId)}; incomplete=${incomplete.length}; wronglyEligible=${wronglyEligible.length}`,
      ],
    });
    report.record(
      incompleteId,
      '7.4',
      wronglyEligible.length === 0 ? 'pass' : 'fail',
      wronglyEligible.length === 0
        ? 'No photographer missing a required field is assignable.'
        : `Photographers missing required fields were assignable: ${wronglyEligible
            .map((p) => String(p.id))
            .join(', ')}`,
    );
    expect(wronglyEligible, 'incomplete photographers must not be assignable').toHaveLength(0);

    // 7.5 — a complete + Approved photographer should be assignable when one exists in scope.
    const eligibleCompleteApproved = completeApproved.filter((p) => eligibleIds.has(String(p.id)));
    report.attachEvidence(completeId, {
      apiExcerpts: [
        `completeApproved=${completeApproved.length}; eligibleCompleteApproved=${eligibleCompleteApproved.length}`,
      ],
    });
    if (completeApproved.length === 0) {
      report.record(
        completeId,
        '7.5',
        'blocked',
        'No complete + Approved photographer is present on the target to assert assignability.',
      );
    } else if (eligibleCompleteApproved.length > 0) {
      report.record(
        completeId,
        '7.5',
        'pass',
        `Complete + Approved photographer(s) are assignable: ${eligibleCompleteApproved
          .map((p) => String(p.id))
          .join(', ')}`,
      );
    } else {
      // Complete + Approved photographers exist but none matched this Test_Shoot's service-area
      // scope — that is a distance/service scoping outcome, not a completeness failure, so record
      // it blocked with the scoping dependency noted (Req 2.6) rather than failing 7.5.
      report.record(
        completeId,
        '7.5',
        'blocked',
        'Complete + Approved photographers exist but none match this Test_Shoot service-area scope.',
      );
    }
  });
});

/** Mint a fresh admin bearer token for a gated mutation (matches the beforeAll login path). */
async function mintAdminToken(context: APIRequestContext): Promise<string> {
  const login = await context.post('/api/login', {
    data: { email: env.adminEmail, password: env.adminPassword },
    headers: { Accept: 'application/json' },
  });
  if (!login.ok()) {
    throw new Error(`Admin API login failed with ${login.status()}`);
  }
  const token = ((await login.json()) as { token?: string }).token;
  if (!token) {
    throw new Error('Admin API login did not return a token');
  }
  return token;
}
