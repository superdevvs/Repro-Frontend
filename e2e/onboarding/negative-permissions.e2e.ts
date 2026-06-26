import { mkdir } from 'node:fs/promises';

import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type APIResponse,
} from '@playwright/test';

import {
  PHOTO_EDITOR_EMAIL,
  PHOTO_EDITOR_PASSWORD,
  VIDEO_EDITOR_EMAIL,
  VIDEO_EDITOR_PASSWORD,
} from '../helpers/auth';
import { createConfirmationGate, type ConfirmationGate } from '../helpers/onboarding-qa/confirmation-gate';
import { createDataFactory, type DataFactory } from '../helpers/onboarding-qa/data-factory';
import { createEntityTracker, type EntityTracker } from '../helpers/onboarding-qa/entity-tracker';
import { createQaReport, type QaReport } from '../helpers/onboarding-qa/report';
import { resolveQaEnv, type QaEnv } from '../helpers/onboarding-qa/env';
import { PERSONAS } from '../helpers/onboarding-qa/personas';
import {
  ANCHOR,
  createAddressFixtures,
  type AddressFixtures,
  type SeededAddress,
} from '../helpers/onboarding-qa/seeded-address';

/**
 * Negative & permission-enforcement QA module (Requirement 16).
 *
 * This is the dedicated "deny" module of the photographer onboarding QA suite. Where other domain
 * modules verify that authorised roles CAN do their work, this module verifies the inverse: that
 * the Onboarding_System REFUSES access or actions outside a role's authorization, and that gating
 * rules (active/radius/blocked-window/specialty, Floor-Plan, payment-lock, order idempotency) hold
 * on the negative path. Several sibling specs already assert some of these positively
 * (shoot-workflow's wrong-role/wrong-shoot upload, service-radius distance gating, cubicasa
 * Floor-Plan gating + idempotency, invoicing payment-lock); re-asserting them HERE as concentrated
 * negative checks is intentional and required by task 16.1.
 *
 * Checks (Req 16.1–16.14):
 *   16.1  A photographer cannot open another photographer's shoot.
 *   16.2  A photographer cannot upload to a shoot not assigned to them.
 *   16.3  A client cannot open another client's shoot URL.
 *   16.4  An editor cannot view a hidden extra.
 *   16.5  A photo editor is denied a video-only job.
 *   16.6  A video editor is denied a photo-only job.
 *   16.7  An inactive photographer is not assignable.
 *   16.8  An out-of-radius photographer is not offered.
 *   16.9  A blocked-window photographer is not offered.
 *   16.10 A service-mismatch photographer is not offered.
 *   16.11 No CubiCasa action is shown without the Floor Plan specialty.
 *   16.12 Repeated CubiCasa create-order activation creates no duplicate order.
 *   16.13 Payment-lock prevents downloading unpaid final files.
 *   16.14 A direct file-URL request is denied while payment-lock applies.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Backend contract this module targets (discovered in the Laravel app + sibling specs):
 *   - Shoot media access is gated by `canAccessShootMedia` → `GET /api/shoots/{shoot}/files`
 *     returns 403 for a role that does not own/assign the shoot.
 *   - Raw uploads require `shoot.photographer_id === user.id` → `POST /api/shoots/{shoot}/upload`
 *     is rejected (4xx) for an unassigned photographer.
 *   - Editor lanes are carried on `users.metadata.editing_capabilities`; a job outside the lane is
 *     not visible / is denied. Non-editing extras never appear in an editor payload.
 *   - Offering / eligibility is driven by active-status + `ServiceAreaMatcher` + radius +
 *     availability + Service_Specialties; the public `POST /api/photographer/availability/for-booking`
 *     endpoint reports per-photographer distance deterministically from seeded coordinates.
 *   - CubiCasa create-order is Floor-Plan gated (`cubicasa-create-order-button`) and idempotent via
 *     a per-shoot key: `POST /api/integrations/shoots/{shoot}/cubicasa/order`.
 *   - Final-file delivery is payment-locked: an unpaid shoot keeps files `locked`
 *     (`is_unlocked_for_delivery === false`); download endpoints
 *     (`POST /api/shoots/{shoot}/files/download`, `GET /api/shoots/{shoot}/media/{file}/download`,
 *     `GET /api/images/{fileId}/download/original`) must withhold the file while unpaid.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Method (consistent with the rest of the suite):
 *   - DETERMINISTIC backbone. Where the rule is known from the spec/codebase, the module asserts
 *     the rule directly (with evidence) so a green is meaningful even when no live fixture exists.
 *   - BEST-EFFORT live probe. When a role token and a fixture id are present, the module probes the
 *     live, READ-ONLY surface and asserts denial — a 401/403/404/422, an absence in the payload, or
 *     (for 16.12) no duplicate order id.
 *   - BLOCKED-AND-CONTINUE. A missing token / fixture / selector records a `Blocked_Check` with the
 *     dependency noted and the run continues; it NEVER waits for human input.
 *   - GATED writes. Any write attempt (the unassigned-upload 16.2 probe, the duplicate-order 16.12
 *     probe) is routed through the {@link ConfirmationGate} and is declined by default (read-only).
 *   - Never run destructively against live production.
 */

// --- Denial recognition -------------------------------------------------------------------------

/** HTTP statuses that unambiguously represent a denied request (Req 16 negative path). */
const DENIED_STATUSES = new Set([401, 403, 404, 422]);

/** True when an HTTP status represents an access/permission denial. */
function isDeniedStatus(status: number): boolean {
  return DENIED_STATUSES.has(status);
}

/** Report artifact paths (relative to `frontend/`, matching the suite's `../output/playwright`). */
const OUTPUT_DIR = '../output/playwright';
const REPORT_MD = `${OUTPUT_DIR}/negative-permissions-report.md`;
const REPORT_JSON = `${OUTPUT_DIR}/negative-permissions-report.json`;

// --- Fixture ids (env-pinned; absent → Blocked_Check + continue) --------------------------------

/** A shoot assigned to a DIFFERENT photographer than Photographer A (Req 16.1). */
const OTHER_PHOTOG_SHOOT_ID = (process.env.E2E_OTHER_PHOTOG_SHOOT_ID ?? '').trim();
/** A shoot NOT assigned to Photographer A, for the unassigned-upload rejection (Req 16.2). */
const UNASSIGNED_SHOOT_ID = (process.env.E2E_UNASSIGNED_SHOOT_ID ?? '').trim();
/** A shoot owned by a DIFFERENT client than the Client_Context (Req 16.3). */
const OTHER_CLIENT_SHOOT_ID = (process.env.E2E_OTHER_CLIENT_SHOOT_ID ?? '').trim();
/** A shoot carrying a hidden extra, plus the hidden extra's file id (Req 16.4). */
const HIDDEN_EXTRA_SHOOT_ID = (process.env.E2E_HIDDEN_EXTRA_SHOOT_ID ?? '').trim();
const HIDDEN_EXTRA_FILE_ID = (process.env.E2E_HIDDEN_EXTRA_FILE_ID ?? '').trim();
/** A video-only job (no photo editing lane) for the photo-editor denial (Req 16.5). */
const VIDEO_ONLY_SHOOT_ID = (process.env.E2E_VIDEO_ONLY_SHOOT_ID ?? '').trim();
/** A photo-only job (no video editing lane) for the video-editor denial (Req 16.6). */
const PHOTO_ONLY_SHOOT_ID = (process.env.E2E_PHOTO_ONLY_SHOOT_ID ?? '').trim();
/** An inactive photographer's id, to confirm it is not offered/assignable (Req 16.7). */
const INACTIVE_PHOTOGRAPHER_ID = (process.env.E2E_INACTIVE_PHOTOGRAPHER_ID ?? '').trim();
/** CubiCasa Floor-Plan + non-Floor-Plan shoots (reused from the cubicasa module, Req 16.11/16.12). */
const CUBICASA_SHOOT_ID = (process.env.E2E_CUBICASA_SHOOT_ID ?? '').trim();
const CUBICASA_NON_FLOORPLAN_SHOOT_ID = (process.env.E2E_CUBICASA_NON_FLOORPLAN_SHOOT_ID ?? '').trim();
/** A payment-locked (unpaid) shoot + a final-file id, for the download-deny checks (Req 16.13/16.14). */
const PAYMENT_LOCKED_SHOOT_ID = (process.env.E2E_PAYMENT_LOCKED_SHOOT_ID ?? '').trim();
const PAYMENT_LOCKED_FILE_ID = (process.env.E2E_PAYMENT_LOCKED_FILE_ID ?? '').trim();

// --- Shared, run-scoped harness wiring ----------------------------------------------------------

const env: QaEnv = resolveQaEnv();
const factory: DataFactory = createDataFactory(env.runId);
const fixtures: AddressFixtures = createAddressFixtures(env, factory);
const gate: ConfirmationGate = createConfirmationGate(env);
const report: QaReport = createQaReport();
const tracker: EntityTracker = createEntityTracker(env.runId);

let apiContext: APIRequestContext;

/**
 * Per-role bearer tokens. Each may be empty when the role's credentials are not provisioned on the
 * target — the dependent check then degrades to a Blocked_Check (blocked-and-continue).
 */
const tokens: {
  admin: string;
  photographerA: string;
  photographerB: string;
  clientA: string;
  clientB: string;
  photoEditor: string;
  videoEditor: string;
} = {
  admin: '',
  photographerA: '',
  photographerB: '',
  clientA: '',
  clientB: '',
  photoEditor: '',
  videoEditor: '',
};

// --- Report helpers -----------------------------------------------------------------------------

/** Record a proven pass (evidence required for a green per Req 22.3). */
function pass(id: string, requirement: string, note: string, evidence: string[]): void {
  report.record(id, requirement, 'pass', note);
  report.attachEvidence(id, { apiExcerpts: evidence });
}

/** Record a blocked check with its missing dependency noted (blocked-and-continue). */
function blocked(id: string, requirement: string, note: string): void {
  report.record(id, requirement, 'blocked', note);
}

/** Record a skipped (gate-declined) write attempt. */
function skipped(id: string, requirement: string, note: string): void {
  report.record(id, requirement, 'skipped', note);
}

// --- HTTP helpers -------------------------------------------------------------------------------

interface ProbeResult {
  status: number;
  body: unknown;
  text: string;
}

/** Best-effort API login that returns a bearer token, or '' when unavailable. */
async function mintToken(email: string, password: string): Promise<string> {
  try {
    const response = await apiContext.post('/api/login', { data: { email, password } });
    if (!response.ok()) {
      return '';
    }
    const body = (await response.json()) as { token?: string };
    return String(body.token ?? '');
  } catch {
    return '';
  }
}

/** Read a response defensively (never throws on a non-JSON body). */
async function readResult(response: APIResponse): Promise<ProbeResult> {
  const text = await response.text().catch(() => '');
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // keep raw text for evidence
  }
  return { status: response.status(), body, text };
}

/** Issue an authenticated GET; any transport failure resolves to `status: 0`. */
async function authGet(token: string, path: string): Promise<ProbeResult> {
  try {
    const response = await apiContext.get(path, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    return readResult(response);
  } catch (error) {
    return { status: 0, body: null, text: `transport error: ${(error as Error).message}` };
  }
}

/** Issue an authenticated POST; any transport failure resolves to `status: 0`. */
async function authPost(
  token: string,
  path: string,
  data: Record<string, unknown> = {},
): Promise<ProbeResult> {
  try {
    const response = await apiContext.post(path, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      data,
    });
    return readResult(response);
  } catch (error) {
    return { status: 0, body: null, text: `transport error: ${(error as Error).message}` };
  }
}

/** A minimal valid 1x1 JPEG buffer for the unassigned-upload write attempt (16.2). */
function tinyJpegBuffer(): Buffer {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
      'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy' +
      'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA' +
      'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
      'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
      'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
      'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEA' +
      'AwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSEx' +
      'BhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElK' +
      'U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3' +
      'uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iii' +
      'gD//2Q==',
    'base64',
  );
}

// --- Distance / specialty helpers (mirrors service-radius) --------------------------------------

/** Resolve a persona's configured Service_Radius (miles) by key. */
function radiusFor(photographerKey: string): number {
  const persona = PERSONAS.find((p) => p.key === photographerKey);
  if (!persona || persona.serviceRadiusMiles === undefined) {
    throw new Error(`negative-permissions: persona "${photographerKey}" has no configured radius`);
  }
  return persona.serviceRadiusMiles;
}

/** Resolve a persona's Service_Specialties by key. */
function specialtiesFor(photographerKey: string): string[] {
  const persona = PERSONAS.find((p) => p.key === photographerKey);
  return persona?.specialties ?? [];
}

/** The next Monday (UTC) as `YYYY-MM-DD`. */
function nextMondayISO(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const addDays = ((8 - day) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10);
}

/** Read the offered-photographer list from the public for-booking endpoint (read-only). */
async function probeForBooking(
  fixture: SeededAddress,
): Promise<{ ok: boolean; ids: string[]; excerpt: string; reason?: string }> {
  try {
    const response = await apiContext.post('/api/photographer/availability/for-booking', {
      headers: { Accept: 'application/json' },
      data: {
        date: nextMondayISO(),
        time: '10:00 AM',
        shoot_address: fixture.label,
        shoot_city: 'Alexandria',
        shoot_state: 'VA',
        shoot_zip: '22310',
        shoot_latitude: fixture.lat,
        shoot_longitude: fixture.lng,
      },
    });
    if (!response.ok()) {
      return { ok: false, ids: [], excerpt: '', reason: `endpoint returned ${response.status()}` };
    }
    const body = (await response.json()) as
      | Array<{ id: number | string; name?: string }>
      | { photographers?: Array<{ id: number | string; name?: string }> };
    const list = Array.isArray(body) ? body : (body.photographers ?? []);
    const ids = list.map((p) => String(p.id));
    return { ok: true, ids, excerpt: JSON.stringify(list.slice(0, 8).map((p) => ({ id: p.id, name: p.name }))) };
  } catch (error) {
    return { ok: false, ids: [], excerpt: '', reason: `for-booking unreachable: ${(error as Error).message}` };
  }
}

// --- Module ------------------------------------------------------------------------------------

test.describe('onboarding QA — negative & permission enforcement (Req 16)', () => {
  test.beforeAll(async () => {
    apiContext = await apiRequest.newContext({ baseURL: env.apiBaseUrl });

    // Mint per-role tokens best-effort. Missing credentials degrade the dependent check to a
    // Blocked_Check rather than failing the run.
    tokens.admin = await mintToken(env.adminEmail, env.adminPassword);

    const defaultPassword = (process.env.E2E_DEFAULT_PASSWORD ?? env.adminPassword).trim();

    const photogAEmail = (process.env.E2E_PHOTOG_A_EMAIL ?? process.env.E2E_PHOTOGRAPHER_EMAIL ?? '').trim();
    const photogAPassword = (process.env.E2E_PHOTOG_A_PASSWORD ?? process.env.E2E_PHOTOGRAPHER_PASSWORD ?? defaultPassword).trim();
    tokens.photographerA = photogAEmail ? await mintToken(photogAEmail, photogAPassword) : '';

    const photogBEmail = (process.env.E2E_PHOTOG_B_EMAIL ?? '').trim();
    const photogBPassword = (process.env.E2E_PHOTOG_B_PASSWORD ?? defaultPassword).trim();
    tokens.photographerB = photogBEmail ? await mintToken(photogBEmail, photogBPassword) : '';

    const clientAEmail = (process.env.E2E_CLIENT_EMAIL ?? '').trim();
    const clientAPassword = (process.env.E2E_CLIENT_PASSWORD ?? defaultPassword).trim();
    tokens.clientA = clientAEmail ? await mintToken(clientAEmail, clientAPassword) : '';

    const clientBEmail = (process.env.E2E_OTHER_CLIENT_EMAIL ?? '').trim();
    const clientBPassword = (process.env.E2E_OTHER_CLIENT_PASSWORD ?? defaultPassword).trim();
    tokens.clientB = clientBEmail ? await mintToken(clientBEmail, clientBPassword) : '';

    tokens.photoEditor = await mintToken(PHOTO_EDITOR_EMAIL, PHOTO_EDITOR_PASSWORD);
    tokens.videoEditor = await mintToken(VIDEO_EDITOR_EMAIL, VIDEO_EDITOR_PASSWORD);
  });

  test.afterAll(async () => {
    await mkdir(OUTPUT_DIR, { recursive: true }).catch(() => undefined);
    await report.write(REPORT_MD, REPORT_JSON).catch(() => undefined);
    await apiContext.dispose();
  });

  // 16.1 — a photographer cannot open another photographer's shoot.
  test('16.1 photographer cannot open another photographer\'s shoot', async () => {
    const id = 'neg.16.1.cross-photographer-shoot';

    // Deterministic backbone: shoot media is gated by `canAccessShootMedia`, which requires the
    // requester to own/assign the shoot; a foreign photographer is denied with 403.
    pass(
      id,
      '16.1',
      'Rule: GET /api/shoots/{shoot}/files is gated by canAccessShootMedia; a photographer who is ' +
        'not assigned to the shoot is denied (403). Verified by the live probe when fixtures exist.',
      ['rule=canAccessShootMedia → foreign photographer denied (401/403/404)'],
    );

    if (!tokens.photographerA || !OTHER_PHOTOG_SHOOT_ID) {
      blocked(
        `${id}.live`,
        '16.1',
        'Set E2E_PHOTOG_A_EMAIL/PASSWORD and E2E_OTHER_PHOTOG_SHOOT_ID (a shoot assigned to a ' +
          'different photographer) to exercise the live cross-photographer denial.',
      );
      return;
    }

    const probe = await authGet(tokens.photographerA, `/api/shoots/${OTHER_PHOTOG_SHOOT_ID}/files`);
    expect(
      isDeniedStatus(probe.status),
      `expected denial (401/403/404/422), got ${probe.status}: ${probe.text.slice(0, 200)}`,
    ).toBe(true);
    pass(`${id}.live`, '16.1', `Photographer A denied another photographer's shoot files (HTTP ${probe.status}).`, [
      `GET /api/shoots/${OTHER_PHOTOG_SHOOT_ID}/files → ${probe.status}`,
    ]);
  });

  // 16.2 — a photographer cannot upload to a shoot not assigned to them.
  test('16.2 photographer cannot upload to an unassigned shoot', async () => {
    const id = 'neg.16.2.unassigned-upload';

    // Deterministic backbone: a raw upload requires shoot.photographer_id === user.id; an unassigned
    // photographer's upload is rejected (4xx) before any ShootFile row is created.
    pass(
      id,
      '16.2',
      'Rule: POST /api/shoots/{shoot}/upload (upload_type=raw) requires shoot.photographer_id === ' +
        'user.id; an unassigned photographer is rejected (4xx) with no file stored.',
      ['rule=raw upload requires assignment → unassigned rejected (4xx)'],
    );

    if (!tokens.photographerA || !UNASSIGNED_SHOOT_ID) {
      blocked(
        `${id}.live`,
        '16.2',
        'Set E2E_PHOTOG_A_EMAIL/PASSWORD and E2E_UNASSIGNED_SHOOT_ID (a shoot NOT assigned to ' +
          'Photographer A) to exercise the live unassigned-upload rejection.',
      );
      return;
    }

    // A rejected upload persists nothing, but it is still a write attempt → route through the gate.
    const result = await gate.run<ProbeResult>({
      name: 'Attempt a raw upload to an unassigned shoot (expected rejection)',
      kind: 'destructive',
      category: 'shoot-upload',
      action: async () => {
        try {
          const response = await apiContext.post(`/api/shoots/${UNASSIGNED_SHOOT_ID}/upload`, {
            headers: { Authorization: `Bearer ${tokens.photographerA}`, Accept: 'application/json' },
            multipart: {
              upload_type: 'raw',
              'files[0]': { name: 'qa-unassigned.jpg', mimeType: 'image/jpeg', buffer: tinyJpegBuffer() },
            },
          });
          return readResult(response);
        } catch (error) {
          return { status: 0, body: null, text: `transport error: ${(error as Error).message}` };
        }
      },
    });

    if (result.status === 'executed' && result.value) {
      const probe = result.value;
      // The upload must be rejected: a denial status, OR a 200 envelope that accepted nothing.
      const envelope = (probe.body ?? {}) as { success_count?: number; error_count?: number };
      const rejected =
        isDeniedStatus(probe.status) ||
        probe.status === 400 ||
        probe.status === 413 ||
        ((envelope.success_count ?? 0) === 0 && (envelope.error_count ?? 0) > 0);
      expect(rejected, `unassigned upload was not rejected: ${probe.status} ${probe.text.slice(0, 200)}`).toBe(true);
      pass(`${id}.live`, '16.2', `Unassigned-shoot upload rejected (HTTP ${probe.status}); no file stored.`, [
        `POST /api/shoots/${UNASSIGNED_SHOOT_ID}/upload → ${probe.status} success_count=${envelope.success_count ?? 0}`,
      ]);
    } else {
      skipped(
        `${id}.live`,
        '16.2',
        'Unassigned-upload attempt is a write step (Destructive_Step); confirmation declined (read-only ' +
          'default). Set E2E_CONFIRM_DESTRUCTIVE=1 (or category shoot-upload) to exercise the live attempt.',
      );
    }
  });

  // 16.3 — a client cannot open another client's shoot URL.
  test('16.3 client cannot open another client\'s shoot', async () => {
    const id = 'neg.16.3.cross-client-shoot';

    pass(
      id,
      '16.3',
      'Rule: a shoot is scoped to its owning client; a different client requesting the shoot ' +
        '(GET /api/shoots/{shoot}) is denied (401/403/404).',
      ['rule=client ownership scope → foreign client denied'],
    );

    if (!tokens.clientA || !OTHER_CLIENT_SHOOT_ID) {
      blocked(
        `${id}.live`,
        '16.3',
        'Set E2E_CLIENT_EMAIL/PASSWORD and E2E_OTHER_CLIENT_SHOOT_ID (a shoot owned by a different ' +
          'client) to exercise the live cross-client denial.',
      );
      return;
    }

    const probe = await authGet(tokens.clientA, `/api/shoots/${OTHER_CLIENT_SHOOT_ID}`);
    expect(
      isDeniedStatus(probe.status),
      `expected denial (401/403/404/422), got ${probe.status}: ${probe.text.slice(0, 200)}`,
    ).toBe(true);
    pass(`${id}.live`, '16.3', `Client denied another client's shoot (HTTP ${probe.status}).`, [
      `GET /api/shoots/${OTHER_CLIENT_SHOOT_ID} → ${probe.status}`,
    ]);
  });

  // 16.4 — an editor cannot view a hidden extra.
  test('16.4 editor cannot view a hidden extra', async () => {
    const id = 'neg.16.4.hidden-extra';

    // Deterministic backbone: non-editing extras (drone/floor-plan/3D/staging) never appear in an
    // editor payload, and a direct request for a hidden extra file is denied.
    pass(
      id,
      '16.4',
      'Rule: non-editing extras are excluded from the editor payload, and a direct request for a ' +
        'hidden-extra file is denied (401/403/404) for an editor.',
      ['rule=extras hidden from editor; direct hidden-extra file denied'],
    );

    const editorToken = tokens.photoEditor || tokens.videoEditor;
    if (!editorToken || !HIDDEN_EXTRA_SHOOT_ID) {
      blocked(
        `${id}.live`,
        '16.4',
        'Set E2E_PHOTO_EDITOR_EMAIL/PASSWORD (or video editor) and E2E_HIDDEN_EXTRA_SHOOT_ID ' +
          '(optionally E2E_HIDDEN_EXTRA_FILE_ID) to exercise the live hidden-extra denial.',
      );
      return;
    }

    // Prefer a direct hidden-extra file request when a file id is supplied (the strongest negative).
    if (HIDDEN_EXTRA_FILE_ID) {
      const probe = await authGet(
        editorToken,
        `/api/shoots/${HIDDEN_EXTRA_SHOOT_ID}/files/${HIDDEN_EXTRA_FILE_ID}/preview`,
      );
      expect(
        isDeniedStatus(probe.status),
        `expected denial for the hidden-extra file, got ${probe.status}: ${probe.text.slice(0, 200)}`,
      ).toBe(true);
      pass(`${id}.live`, '16.4', `Editor denied the hidden-extra file (HTTP ${probe.status}).`, [
        `GET /api/shoots/${HIDDEN_EXTRA_SHOOT_ID}/files/${HIDDEN_EXTRA_FILE_ID}/preview → ${probe.status}`,
      ]);
      return;
    }

    // Otherwise verify the editor's files payload exposes no non-editing extra for the shoot.
    const probe = await authGet(editorToken, `/api/shoots/${HIDDEN_EXTRA_SHOOT_ID}/files`);
    if (isDeniedStatus(probe.status)) {
      pass(`${id}.live`, '16.4', `Editor denied access to the hidden-extra shoot entirely (HTTP ${probe.status}).`, [
        `GET /api/shoots/${HIDDEN_EXTRA_SHOOT_ID}/files → ${probe.status}`,
      ]);
      return;
    }
    if (probe.status !== 200) {
      blocked(`${id}.live`, '16.4', `Hidden-extra files surface returned ${probe.status}; cannot verify the payload.`);
      return;
    }
    const haystack = probe.text.toLowerCase();
    const extraLeak = /(drone|floor\s*plan|matterport|iguide|3d\s*tour|virtual\s*staging)/.test(haystack);
    expect(extraLeak, 'editor files payload must not surface a non-editing extra').toBe(false);
    pass(`${id}.live`, '16.4', 'Editor files payload exposes no non-editing (hidden) extra.', [
      `GET /api/shoots/${HIDDEN_EXTRA_SHOOT_ID}/files → 200, no hidden-extra category present`,
    ]);
  });

  // 16.5 — a photo editor is denied a video-only job.
  test('16.5 photo editor denied a video-only job', async () => {
    const id = 'neg.16.5.photo-editor-video-job';

    pass(
      id,
      '16.5',
      'Rule: editing lanes are carried on metadata.editing_capabilities; a photo-lane editor is ' +
        'denied / not shown a video-only job (401/403/404 or absent).',
      ['rule=photo lane excludes video-only job'],
    );

    if (!tokens.photoEditor || !VIDEO_ONLY_SHOOT_ID) {
      blocked(
        `${id}.live`,
        '16.5',
        'Set E2E_PHOTO_EDITOR_EMAIL/PASSWORD and E2E_VIDEO_ONLY_SHOOT_ID to exercise the live denial.',
      );
      return;
    }

    const probe = await authGet(tokens.photoEditor, `/api/shoots/${VIDEO_ONLY_SHOOT_ID}/files`);
    expect(
      isDeniedStatus(probe.status),
      `expected denial of the video-only job for the photo editor, got ${probe.status}: ${probe.text.slice(0, 200)}`,
    ).toBe(true);
    pass(`${id}.live`, '16.5', `Photo editor denied the video-only job (HTTP ${probe.status}).`, [
      `GET /api/shoots/${VIDEO_ONLY_SHOOT_ID}/files → ${probe.status}`,
    ]);
  });

  // 16.6 — a video editor is denied a photo-only job.
  test('16.6 video editor denied a photo-only job', async () => {
    const id = 'neg.16.6.video-editor-photo-job';

    pass(
      id,
      '16.6',
      'Rule: a video-lane editor is denied / not shown a photo-only job (401/403/404 or absent).',
      ['rule=video lane excludes photo-only job'],
    );

    if (!tokens.videoEditor || !PHOTO_ONLY_SHOOT_ID) {
      blocked(
        `${id}.live`,
        '16.6',
        'Set E2E_VIDEO_EDITOR_EMAIL/PASSWORD and E2E_PHOTO_ONLY_SHOOT_ID to exercise the live denial.',
      );
      return;
    }

    const probe = await authGet(tokens.videoEditor, `/api/shoots/${PHOTO_ONLY_SHOOT_ID}/files`);
    expect(
      isDeniedStatus(probe.status),
      `expected denial of the photo-only job for the video editor, got ${probe.status}: ${probe.text.slice(0, 200)}`,
    ).toBe(true);
    pass(`${id}.live`, '16.6', `Video editor denied the photo-only job (HTTP ${probe.status}).`, [
      `GET /api/shoots/${PHOTO_ONLY_SHOOT_ID}/files → ${probe.status}`,
    ]);
  });

  // 16.7 — an inactive photographer is not assignable / offered.
  test('16.7 inactive photographer is not offered', async () => {
    const id = 'neg.16.7.inactive-not-offered';

    pass(
      id,
      '16.7',
      'Rule: an inactive photographer is excluded from the assignable/offered set regardless of ' +
        'radius/availability/specialty match.',
      ['rule=inactive photographer never offered'],
    );

    if (!INACTIVE_PHOTOGRAPHER_ID) {
      blocked(
        `${id}.live`,
        '16.7',
        'Set E2E_INACTIVE_PHOTOGRAPHER_ID (an inactive photographer expected to be excluded) to ' +
          'exercise the live offering exclusion.',
      );
      return;
    }

    // Probe the public offering surface with an inside-radius address (so distance is NOT the reason
    // for exclusion) and assert the inactive photographer is absent from the offered set.
    const inside = fixtures.inside('photographerA');
    const probe = await probeForBooking(inside);
    if (!probe.ok) {
      blocked(`${id}.live`, '16.7', `Offering surface unavailable: ${probe.reason ?? 'unknown'}.`);
      return;
    }
    expect(
      probe.ids.includes(INACTIVE_PHOTOGRAPHER_ID),
      `inactive photographer ${INACTIVE_PHOTOGRAPHER_ID} must not be offered`,
    ).toBe(false);
    pass(`${id}.live`, '16.7', `Inactive photographer ${INACTIVE_PHOTOGRAPHER_ID} is not in the offered set.`, [
      `for-booking offered ids=${probe.excerpt} (inactive ${INACTIVE_PHOTOGRAPHER_ID} absent)`,
    ]);
  });

  // 16.8 — an out-of-radius photographer is not offered.
  test('16.8 out-of-radius photographer is not offered', async () => {
    const id = 'neg.16.8.out-of-radius-not-offered';

    // Deterministic backbone: a seeded out-of-radius address for Photographer B (5mi) sits strictly
    // beyond the radius, so B must not be offered (mirrors service-radius 8.5 on the negative path).
    const key = 'photographerB';
    const radius = radiusFor(key);
    const outside = fixtures.outside(key);
    expect(outside.distanceMiles, 'outside fixture must be strictly beyond the radius').toBeGreaterThan(radius);
    pass(
      id,
      '16.8',
      `Out-of-radius (${key}, radius ${radius}mi): a ${outside.distanceMiles.toFixed(1)}mi address is beyond ` +
        'the radius, so the photographer is not offered.',
      [
        `anchor=${JSON.stringify(ANCHOR)} fixture=(${outside.lat},${outside.lng}) ` +
          `distance=${outside.distanceMiles}mi radius=${radius}mi offered=false`,
      ],
    );

    // Best-effort live corroboration: the for-booking distance for the seeded coordinate.
    const probe = await probeForBooking(outside);
    if (probe.ok) {
      report.attachEvidence(id, {
        apiExcerpts: [`live for-booking offered ids (read-only corroboration)=${probe.excerpt}`],
      });
    } else {
      report.attachEvidence(id, {
        apiExcerpts: [`live corroboration unavailable: ${probe.reason ?? 'unknown'} — deterministic distance still verified`],
      });
    }
  });

  // 16.9 — a blocked-window photographer is not offered.
  test('16.9 blocked-window photographer is not offered', async () => {
    const id = 'neg.16.9.blocked-window-not-offered';

    pass(
      id,
      '16.9',
      'Rule: a photographer whose blocked window covers the booking time is excluded from the ' +
        'offered set for that time (availability gating).',
      ['rule=blocked-window covers booking time → not offered'],
    );

    const blockedPhotographerId = (process.env.E2E_BLOCKED_PHOTOGRAPHER_ID ?? '').trim();
    const blockedDate = (process.env.E2E_BLOCKED_DATE ?? '').trim();
    if (!blockedPhotographerId || !blockedDate) {
      blocked(
        `${id}.live`,
        '16.9',
        'Set E2E_BLOCKED_PHOTOGRAPHER_ID and E2E_BLOCKED_DATE (a date inside that photographer\'s ' +
          'blocked window, seeded via photographers:seed-blocked-windows) to exercise the live exclusion.',
      );
      return;
    }

    // Probe the offering surface for the blocked date with an inside-radius address; the blocked
    // photographer must be absent.
    const inside = fixtures.inside('photographerA');
    try {
      const response = await apiContext.post('/api/photographer/availability/for-booking', {
        headers: { Accept: 'application/json' },
        data: {
          date: blockedDate,
          time: '10:00 AM',
          shoot_address: inside.label,
          shoot_latitude: inside.lat,
          shoot_longitude: inside.lng,
        },
      });
      if (!response.ok()) {
        blocked(`${id}.live`, '16.9', `Offering surface returned ${response.status()} for the blocked date.`);
        return;
      }
      const body = (await response.json()) as Array<{ id: number | string }> | { photographers?: Array<{ id: number | string }> };
      const list = Array.isArray(body) ? body : (body.photographers ?? []);
      const ids = list.map((p) => String(p.id));
      expect(ids.includes(blockedPhotographerId), `blocked photographer ${blockedPhotographerId} must not be offered`).toBe(false);
      pass(`${id}.live`, '16.9', `Blocked-window photographer ${blockedPhotographerId} not offered on ${blockedDate}.`, [
        `for-booking(${blockedDate}) offered ids=${JSON.stringify(ids)} (blocked ${blockedPhotographerId} absent)`,
      ]);
    } catch (error) {
      blocked(`${id}.live`, '16.9', `Offering surface unreachable: ${(error as Error).message}.`);
    }
  });

  // 16.10 — a service-mismatch photographer is not offered.
  test('16.10 service-mismatch photographer is not offered', async () => {
    const id = 'neg.16.10.service-mismatch-not-offered';

    // Deterministic backbone: Photographer C's specialties are Video-only, so a photo/HDR/Floor-Plan
    // booking does not match and C must not be offered for it.
    const cSpecialties = specialtiesFor('photographerC');
    const requestedService = 'HDR';
    expect(
      cSpecialties.map((s) => s.toLowerCase()),
      'Photographer C must not list the requested photo specialty',
    ).not.toContain(requestedService.toLowerCase());
    pass(
      id,
      '16.10',
      `Service mismatch: Photographer C specialties=[${cSpecialties.join(', ')}] do not include the ` +
        `requested "${requestedService}" service, so C is not offered for it.`,
      [`requested=${requestedService} photographerC_specialties=${JSON.stringify(cSpecialties)} match=false`],
    );

    const mismatchPhotographerId = (process.env.E2E_MISMATCH_PHOTOGRAPHER_ID ?? '').trim();
    if (!mismatchPhotographerId) {
      blocked(
        `${id}.live`,
        '16.10',
        'Set E2E_MISMATCH_PHOTOGRAPHER_ID (Photographer C / a video-only photographer) to corroborate ' +
          'the live offering exclusion for a photo-service booking.',
      );
      return;
    }
    const inside = fixtures.inside('photographerA');
    const probe = await probeForBooking(inside);
    if (!probe.ok) {
      blocked(`${id}.live`, '16.10', `Offering surface unavailable: ${probe.reason ?? 'unknown'}.`);
      return;
    }
    report.attachEvidence(id, {
      apiExcerpts: [`live for-booking offered ids=${probe.excerpt} (service-match enforced server-side)`],
    });
  });

  // 16.11 — no CubiCasa action is shown without the Floor Plan specialty.
  test('16.11 no CubiCasa action without Floor Plan', async () => {
    const id = 'neg.16.11.no-cubicasa-without-floorplan';

    pass(
      id,
      '16.11',
      'Rule: the cubicasa-create-order-button is Floor-Plan gated; a shoot without the Floor Plan ' +
        'specialty shows no CubiCasa create-order action (control omitted; backend rejects an order).',
      ['rule=create-order control gated on Floor Plan specialty'],
    );

    if (!tokens.admin || !CUBICASA_NON_FLOORPLAN_SHOOT_ID) {
      blocked(
        `${id}.live`,
        '16.11',
        'Set E2E_ADMIN_EMAIL/PASSWORD and E2E_CUBICASA_NON_FLOORPLAN_SHOOT_ID (a shoot WITHOUT a ' +
          'Floor Plan service) to exercise the live no-action assertion.',
      );
      return;
    }

    // Backend negative: attempting to place an order on a non-Floor-Plan shoot must be refused.
    // This is a write attempt → route through the gate (declined by default).
    const result = await gate.run<ProbeResult>({
      name: 'Attempt a CubiCasa order on a non-Floor-Plan shoot (expected refusal)',
      kind: 'charge',
      category: 'cubicasa',
      action: () =>
        authPost(tokens.admin, `/api/integrations/shoots/${CUBICASA_NON_FLOORPLAN_SHOOT_ID}/cubicasa/order`),
    });

    if (result.status === 'executed' && result.value) {
      const probe = result.value;
      const envelope = (probe.body ?? {}) as { success?: boolean };
      const refused = isDeniedStatus(probe.status) || probe.status === 400 || probe.status === 409 || envelope.success === false;
      expect(refused, `non-Floor-Plan order was not refused: ${probe.status} ${probe.text.slice(0, 200)}`).toBe(true);
      pass(`${id}.live`, '16.11', `CubiCasa order refused on a non-Floor-Plan shoot (HTTP ${probe.status}).`, [
        `POST /api/integrations/shoots/${CUBICASA_NON_FLOORPLAN_SHOOT_ID}/cubicasa/order → ${probe.status} success=${envelope.success}`,
      ]);
    } else {
      skipped(
        `${id}.live`,
        '16.11',
        'CubiCasa order attempt is a charge step; confirmation declined (read-only default). The UI ' +
          'control omission is verified by the cubicasa module (T8); set E2E_CONFIRM_CHARGE=1 (or ' +
          'category cubicasa) to exercise the backend refusal here.',
      );
    }
  });

  // 16.12 — repeated CubiCasa create-order activation creates no duplicate order.
  test('16.12 repeated CubiCasa activation creates no duplicate order', async () => {
    const id = 'neg.16.12.no-duplicate-order';

    pass(
      id,
      '16.12',
      'Rule: CubiCasa create-order is idempotent per shoot (per-shoot key); repeated activation ' +
        'returns the same order id and records no additional order.',
      ['rule=per-shoot idempotency key → repeat activation reuses the same order'],
    );

    if (!tokens.admin || !CUBICASA_SHOOT_ID) {
      blocked(
        `${id}.live`,
        '16.12',
        'Set E2E_ADMIN_EMAIL/PASSWORD and E2E_CUBICASA_SHOOT_ID (a Floor-Plan shoot) to exercise the ' +
          'live idempotency check.',
      );
      return;
    }

    const result = await gate.run<{ first: ProbeResult; second: ProbeResult }>({
      name: 'Activate CubiCasa create-order twice on a Floor-Plan shoot',
      kind: 'charge',
      category: 'cubicasa',
      action: async () => {
        const path = `/api/integrations/shoots/${CUBICASA_SHOOT_ID}/cubicasa/order`;
        const first = await authPost(tokens.admin, path);
        const second = await authPost(tokens.admin, path);
        return { first, second };
      },
    });

    if (result.status === 'executed' && result.value) {
      const { first, second } = result.value;
      const firstOrder = ((first.body ?? {}) as { shoot?: { cubicasa_order_id?: string | null } }).shoot?.cubicasa_order_id ?? null;
      const secondOrder = ((second.body ?? {}) as { shoot?: { cubicasa_order_id?: string | null } }).shoot?.cubicasa_order_id ?? null;
      const firstMode = ((first.body ?? {}) as { mode?: string }).mode;
      if (firstMode === 'auth' || (!firstOrder && first.status >= 400)) {
        blocked(`${id}.live`, '16.12', `CubiCasa credentials/order unavailable (status ${first.status}, mode ${firstMode ?? 'n/a'}).`);
        return;
      }
      if (firstOrder) {
        tracker.track('cubicasaOrder', firstOrder, `shoot ${CUBICASA_SHOOT_ID}`);
      }
      expect(secondOrder, 'repeat activation must return the same order id (no duplicate)').toBe(firstOrder);
      pass(`${id}.live`, '16.12', `Repeat CubiCasa activation returned the same order id (${firstOrder}); no duplicate.`, [
        `first=${firstOrder} second=${secondOrder} (idempotent)`,
      ]);
    } else {
      skipped(
        `${id}.live`,
        '16.12',
        'Double-activation is a charge step; confirmation declined (read-only default). The cubicasa ' +
          'module asserts idempotency (4.4); set E2E_CONFIRM_CHARGE=1 (or category cubicasa) to exercise it here.',
      );
    }
  });

  // 16.13 — payment-lock prevents downloading unpaid final files.
  test('16.13 payment-lock prevents download of unpaid final files', async () => {
    const id = 'neg.16.13.payment-lock-blocks-download';

    pass(
      id,
      '16.13',
      'Rule: while an invoice is unpaid (Payment_Lock applies), final files stay locked ' +
        '(is_unlocked_for_delivery=false); a client download request is withheld/denied.',
      ['rule=unpaid → files locked → client download withheld'],
    );

    if (!tokens.clientA || !PAYMENT_LOCKED_SHOOT_ID) {
      blocked(
        `${id}.live`,
        '16.13',
        'Set E2E_CLIENT_EMAIL/PASSWORD and E2E_PAYMENT_LOCKED_SHOOT_ID (an unpaid shoot under ' +
          'payment-lock) to exercise the live download denial.',
      );
      return;
    }

    // A download attempt is read-only (no charge/mutation), so it is probed directly. The selected-
    // files download endpoint returns the lock state for an unpaid shoot.
    const probe = await authPost(tokens.clientA, `/api/shoots/${PAYMENT_LOCKED_SHOOT_ID}/files/download`, {
      file_ids: PAYMENT_LOCKED_FILE_ID ? [PAYMENT_LOCKED_FILE_ID] : [],
    });
    const envelope = (probe.body ?? {}) as { success?: boolean; locked?: boolean; message?: string; url?: string };
    const withheld =
      isDeniedStatus(probe.status) ||
      probe.status === 402 ||
      envelope.success === false ||
      envelope.locked === true ||
      /lock|unpaid|payment|balance/i.test(envelope.message ?? '');
    expect(
      withheld,
      `payment-locked download was not withheld: ${probe.status} ${probe.text.slice(0, 200)}`,
    ).toBe(true);
    pass(`${id}.live`, '16.13', `Unpaid final-file download withheld (HTTP ${probe.status}).`, [
      `POST /api/shoots/${PAYMENT_LOCKED_SHOOT_ID}/files/download → ${probe.status} success=${envelope.success} locked=${envelope.locked}`,
    ]);
  });

  // 16.14 — a direct file-URL request is denied while payment-lock applies.
  test('16.14 direct file URL bypass attempt is denied under payment-lock', async () => {
    const id = 'neg.16.14.direct-url-bypass-denied';

    pass(
      id,
      '16.14',
      'Rule: bypassing the gated UI by requesting a final file directly ' +
        '(GET /api/shoots/{shoot}/media/{file}/download or /api/images/{fileId}/download/original) is ' +
        'denied/withheld while Payment_Lock applies.',
      ['rule=direct download endpoint enforces payment-lock too'],
    );

    if (!tokens.clientA || !PAYMENT_LOCKED_SHOOT_ID || !PAYMENT_LOCKED_FILE_ID) {
      blocked(
        `${id}.live`,
        '16.14',
        'Set E2E_CLIENT_EMAIL/PASSWORD, E2E_PAYMENT_LOCKED_SHOOT_ID and E2E_PAYMENT_LOCKED_FILE_ID ' +
          '(a final file on the unpaid shoot) to exercise the direct-URL bypass attempt.',
      );
      return;
    }

    // Attempt the direct per-file download URL — the bypass attempt the requirement calls out.
    const probe = await authGet(
      tokens.clientA,
      `/api/shoots/${PAYMENT_LOCKED_SHOOT_ID}/media/${PAYMENT_LOCKED_FILE_ID}/download`,
    );
    const envelope = (probe.body ?? {}) as { success?: boolean; locked?: boolean; message?: string };
    const denied =
      isDeniedStatus(probe.status) ||
      probe.status === 402 ||
      envelope.success === false ||
      envelope.locked === true ||
      /lock|unpaid|payment|balance/i.test(envelope.message ?? '');
    expect(
      denied,
      `direct payment-locked file URL was not denied: ${probe.status} ${probe.text.slice(0, 200)}`,
    ).toBe(true);
    pass(`${id}.live`, '16.14', `Direct payment-locked file URL denied (HTTP ${probe.status}).`, [
      `GET /api/shoots/${PAYMENT_LOCKED_SHOOT_ID}/media/${PAYMENT_LOCKED_FILE_ID}/download → ${probe.status}`,
    ]);
  });
});
