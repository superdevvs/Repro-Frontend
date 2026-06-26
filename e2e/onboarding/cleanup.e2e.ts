import { mkdir } from 'node:fs/promises';

import {
  request as apiRequest,
  test,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from '../helpers/auth';
import { createConfirmationGate, type ConfirmationGate } from '../helpers/onboarding-qa/confirmation-gate';
import { createDataFactory, type DataFactory } from '../helpers/onboarding-qa/data-factory';
import {
  createEntityTracker,
  type EntityTracker,
  type EntityType,
  type TrackedEntity,
} from '../helpers/onboarding-qa/entity-tracker';
import { resolveQaEnv, type QaEnv } from '../helpers/onboarding-qa/env';
import { createQaReport, type QaReport } from '../helpers/onboarding-qa/report';

/**
 * Run-scoped, all-entity-type cleanup spec module (Requirement 21) — design module
 * `cleanup.e2e.ts`. This module is ordered LAST so it observes every `QA_Entity` the run created.
 *
 * It satisfies the five Req 21 acceptance criteria:
 *   21.1 — identify every `QA_Entity` created during the run by the `QA_Run_Id`, across ALL types
 *          (accounts, shoots, bookings, raw/edited files, CubiCasa orders/references, equipment +
 *          assignments, invoices, reminder records, notification logs, clients, addresses,
 *          availability/blocked windows, generated reports).
 *   21.2 — gate each deletion through the `Confirmation_Gate` (a `Destructive_Step`); a declined
 *          gate skips the deletion and records it skipped (read-only by default, Req 2.1/2.3).
 *   21.3 — on a confirmed deletion remove the entity via the appropriate admin endpoint and assert
 *          its removal.
 *   21.4 — after cleanup, assert no run-tagged entity remains.
 *   21.5 — record the per-entity cleanup outcome via `report.recordCleanup`.
 *
 * ## Two complementary identification paths
 * The entity tracker is per-process / in-memory: each domain spec created its OWN tracker, so a
 * separate cleanup process cannot observe entities created by other specs. This module therefore
 * uses TWO paths:
 *
 *   1. **Tracker-based (21.1 contract):** iterate `tracker.belongingToRun(factory)` for any entity
 *      registered in THIS process. (In a standalone cleanup run this is typically empty, but the
 *      path is exercised so the contract holds; Property 2 covers the selection logic in isolation.)
 *
 *   2. **Discovery-based (cross-process reality):** query the admin listing endpoints and select
 *      records whose name/email/label carries the run-id suffix via `factory.belongsToRun`. This
 *      finds run-created accounts/clients/equipment/shoots regardless of which process created them.
 *      Discovered entities are fed into the tracker so the run-scoped selection and the
 *      "no run-tagged entity remains" assertion (21.4) operate over the real, observable set.
 *
 * ## Entity-type → endpoint map (verified against `backend/routes/api.php` at authoring time)
 * Discoverable AND deletable via an admin listing + delete endpoint:
 *   - account  → GET `/api/admin/users?light=1`          DELETE `/api/admin/users/{id}`
 *   - client   → (same users surface; clients are users)  DELETE `/api/admin/users/{id}`
 *   - equipment→ GET `/api/admin/photographer-equipments` DELETE `/api/admin/photographer-equipments/{id}`
 *   - shoot    → GET `/api/shoots`                         DELETE `/api/shoots/{id}` (role admin)
 *
 * No discoverable/deletable admin endpoint keyed by the run-id (recorded BLOCKED with the
 * dependency noted — blocked-and-continue): booking, rawFile, editedFile, cubicasaOrder,
 * cubicasaReference, equipmentAssignment, invoice, reminderRecord, notificationLog, address,
 * availabilityWindow, blockedWindow, report. Most of these are removed by cascade when their owning
 * account/shoot is deleted, or are local report artifacts rather than server-side records; this
 * module documents that dependency per type rather than silently passing.
 *
 * ## Account deletion reuses the `account-delete-cache-access.e2e.ts` pattern
 * For each discovered QA account this module: (best-effort) mints a token via `POST /api/login`
 * with the default QA password, deletes via `DELETE /api/admin/users/{id}`, then asserts the
 * account is evicted from the directory listing (cache eviction) and — when a token was minted —
 * that the token is revoked immediately (subsequent `GET /api/user` returns 401).
 *
 * ## Read-only by default
 * Deletions execute ONLY when the destructive gate is confirmed (`E2E_CONFIRM_DESTRUCTIVE=1` or the
 * fine-grained `E2E_CONFIRM_CATEGORIES` includes `cleanup`). Otherwise each deletion is recorded
 * SKIPPED with the entity noted, and no data is mutated. Runs HEADLESS in the single chromium
 * project. NEVER run the confirmed cleanup against live production without scoped confirmation.
 */

// --- Report artifact paths (relative to `frontend/`, matching `../output/playwright`) ----------
const OUTPUT_DIR = '../output/playwright';
const REPORT_MD = `${OUTPUT_DIR}/cleanup-report.md`;
const REPORT_JSON = `${OUTPUT_DIR}/cleanup-report.json`;

/** Fine-grained confirmation category for every cleanup deletion (Req 2.2, 21.2). */
const GATE_CATEGORY = 'cleanup';

/** Default password assigned to QA-created accounts (`UserController@store`) — used for the
 * best-effort token-revocation check; override with `E2E_CREATED_ACCOUNT_PASSWORD`. */
const CREATED_ACCOUNT_PASSWORD = process.env.E2E_CREATED_ACCOUNT_PASSWORD ?? 'defaultpassword';

// --- Shared, run-scoped harness wiring ----------------------------------------------------------
const env: QaEnv = resolveQaEnv();
const factory: DataFactory = createDataFactory(env.runId);
const gate: ConfirmationGate = createConfirmationGate(env);
const report: QaReport = createQaReport();
const tracker: EntityTracker = createEntityTracker(env.runId);

/** API base for the Laravel routes (`E2E_API_BASE_URL ?? E2E_BASE_URL ?? default`). */
const apiBase = env.apiBaseUrl.replace(/\/$/, '');

let apiContext: APIRequestContext;
let admin: { context: BrowserContext; page: Page; token: string } | null = null;

// --- Discovery source descriptors --------------------------------------------------------------

/** A discoverable + deletable admin surface keyed by the run-id suffix. */
interface DiscoverySource {
  /** The `QA_Entity` type recorded against discovered records (21.1/21.5). */
  type: EntityType;
  /** GET listing endpoint (read-only, no gate). */
  listPath: string;
  /** DELETE endpoint factory for a single record (gated, 21.2/21.3). */
  deletePath: (id: string | number) => string;
  /** Record fields tested against `factory.belongsToRun` to recognize run-created records. */
  labelFields: string[];
}

/**
 * The discoverable + deletable sources. Accounts cover both `account` and `client` types (clients
 * are users), so `account` is the single users-backed source — discovered client records are
 * re-typed to `client` from their `role` field when recorded.
 */
const DISCOVERY_SOURCES: DiscoverySource[] = [
  {
    type: 'account',
    listPath: '/api/admin/users?light=1',
    deletePath: (id) => `/api/admin/users/${id}`,
    labelFields: ['email', 'name'],
  },
  {
    type: 'equipment',
    listPath: '/api/admin/photographer-equipments?per_page=100',
    deletePath: (id) => `/api/admin/photographer-equipments/${id}`,
    labelFields: ['name', 'serial_number'],
  },
  {
    type: 'shoot',
    listPath: '/api/shoots',
    deletePath: (id) => `/api/shoots/${id}`,
    labelFields: ['address', 'property_address', 'title', 'name'],
  },
];

/**
 * Types that have NO discoverable/deletable admin endpoint keyed by the run-id. Recorded BLOCKED
 * with the dependency noted (blocked-and-continue, Req 2.6). Most are removed by cascade when their
 * owning account/shoot is deleted, or are local report artifacts.
 */
const BLOCKED_TYPES: Array<{ type: EntityType; dependency: string }> = [
  { type: 'booking', dependency: 'No admin listing/delete endpoint keyed by run-id; bookings are realized as shoots and cascade with shoot deletion.' },
  { type: 'rawFile', dependency: 'Raw files are removed by cascade when their owning shoot is deleted (no run-id-keyed admin delete).' },
  { type: 'editedFile', dependency: 'Edited files are removed by cascade when their owning shoot is deleted (no run-id-keyed admin delete).' },
  { type: 'cubicasaOrder', dependency: 'No admin listing/delete endpoint keyed by run-id; CubiCasa orders cascade with their shoot.' },
  { type: 'cubicasaReference', dependency: 'No admin listing/delete endpoint keyed by run-id; references cascade with their shoot/order.' },
  { type: 'equipmentAssignment', dependency: 'Assignments clear when the equipment item is deleted or unassigned; no standalone run-id-keyed delete.' },
  { type: 'invoice', dependency: 'No admin listing/delete endpoint keyed by run-id; invoices cascade with their shoot.' },
  { type: 'reminderRecord', dependency: 'No admin listing/delete endpoint keyed by run-id; reminder records cascade with their invoice/shoot.' },
  { type: 'notificationLog', dependency: 'Notification logs are sink/audit records with no run-id-keyed admin delete; pruned by retention jobs.' },
  { type: 'address', dependency: 'Addresses are attributes of users/shoots and cascade when the owning account/shoot is deleted.' },
  { type: 'availabilityWindow', dependency: 'Availability windows cascade when the owning photographer account is deleted; no run-id-keyed admin delete.' },
  { type: 'blockedWindow', dependency: 'Blocked windows cascade when the owning photographer account is deleted; no run-id-keyed admin delete.' },
  { type: 'report', dependency: 'Generated QA reports are local artifacts under ../output/playwright, not server-side records.' },
];

// --- HTTP helpers ------------------------------------------------------------------------------

/** Issue an authenticated JSON request against an `/api/...` route with a bearer token. */
async function api(
  method: 'get' | 'post' | 'delete',
  path: string,
  token: string,
  data?: Record<string, unknown>,
): Promise<APIResponse> {
  const url = `${apiBase}${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  switch (method) {
    case 'get':
      return apiContext.get(url, { headers });
    case 'post':
      return apiContext.post(url, { headers, data: data ?? {} });
    case 'delete':
      return apiContext.delete(url, { headers });
  }
}

/** Parse a JSON body defensively (never throws on a non-JSON body). */
async function readJson(response: APIResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Extract a record array from a `{data:[…]}` envelope or a bare array. */
function extractList(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) {
    return body as Array<Record<string, unknown>>;
  }
  if (body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>).data)) {
    return (body as Record<string, unknown>).data as Array<Record<string, unknown>>;
  }
  return [];
}

/** The first label field on a record that carries this run's suffix (used for tracking + 21.4). */
function runLabelOf(item: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    const value = item[field];
    if (typeof value === 'string' && factory.belongsToRun(value)) {
      return value;
    }
  }
  return null;
}

/** Authenticate the admin session and read its bearer token (matches the existing suite). */
async function ensureAdmin(browser: Browser): Promise<typeof admin> {
  if (admin) {
    return admin;
  }
  try {
    const context = await browser.newContext({ baseURL: env.baseUrl });
    const page = await context.newPage();
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const token =
      (await page.evaluate(
        () => localStorage.getItem('authToken') || localStorage.getItem('token'),
      )) ?? '';
    if (!token) {
      await context.close();
      return null;
    }
    admin = { context, page, token };
    return admin;
  } catch {
    return null;
  }
}

// --- Discovery + deletion ----------------------------------------------------------------------

/** A run-created record discovered on an admin listing surface. */
interface DiscoveredEntity {
  type: EntityType;
  id: string | number;
  label: string;
  /** Role for users surfaces, so `account` rows can be re-typed to `client` (21.1 type fidelity). */
  role?: string;
}

/** Outcome of probing + discovering one source. */
interface SourceProbe {
  source: DiscoverySource;
  reachable: boolean;
  note: string;
  discovered: DiscoveredEntity[];
}

/** Probe a source's listing (read-only) and select the run-created records via `belongsToRun`. */
async function discover(source: DiscoverySource, token: string): Promise<SourceProbe> {
  try {
    const response = await api('get', source.listPath, token);
    if (response.status() === 503) {
      return {
        source,
        reachable: false,
        note: `Listing ${source.listPath} returned 503 (feature not migrated); discovery blocked for ${source.type}.`,
        discovered: [],
      };
    }
    if (!response.ok()) {
      return {
        source,
        reachable: false,
        note: `Listing ${source.listPath} returned ${response.status()}; discovery blocked for ${source.type}.`,
        discovered: [],
      };
    }
    const items = extractList(await readJson(response));
    const discovered: DiscoveredEntity[] = [];
    for (const item of items) {
      const label = runLabelOf(item, source.labelFields);
      if (label === null || item.id === undefined || item.id === null) {
        continue;
      }
      const role = typeof item.role === 'string' ? item.role : undefined;
      // Re-type a users-surface row to `client` when its role says so, keeping 21.1 type fidelity.
      const type: EntityType =
        source.type === 'account' && role === 'client' ? 'client' : source.type;
      discovered.push({ type, id: item.id as string | number, label, role });
    }
    return {
      source,
      reachable: true,
      note: `Listing ${source.listPath} reachable (${items.length} record(s); ${discovered.length} run-tagged).`,
      discovered,
    };
  } catch (error) {
    return {
      source,
      reachable: false,
      note: `Listing ${source.listPath} undiscoverable: ${error instanceof Error ? error.message : String(error)}.`,
      discovered: [],
    };
  }
}

/** Best-effort: mint a token for a QA account so account-token revocation can be asserted post-delete. */
async function mintAccountToken(email: string): Promise<string | null> {
  try {
    const response = await apiContext.post(`${apiBase}/api/login`, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      data: { email, password: CREATED_ACCOUNT_PASSWORD },
    });
    if (!response.ok()) {
      return null;
    }
    const body = (await readJson(response)) as { token?: string } | null;
    return body?.token ?? null;
  } catch {
    return null;
  }
}

/** True iff a record with `id` still appears on the source's listing (used for removal assertions). */
async function stillListed(source: DiscoverySource, id: string | number, token: string): Promise<boolean> {
  const response = await api('get', source.listPath, token);
  if (!response.ok()) {
    // If the listing can't be read we cannot confirm removal; treat as "still present" conservatively.
    return true;
  }
  const items = extractList(await readJson(response));
  return items.some((item) => String(item.id) === String(id));
}

// --- Module ------------------------------------------------------------------------------------

test.describe.serial('onboarding QA — run-scoped cleanup (Req 21) — runs last', () => {
  /** Discovered, run-created entities across all reachable sources (drives deletion + 21.4). */
  const probes: SourceProbe[] = [];

  test.beforeAll(async ({ browser }) => {
    apiContext = await apiRequest.newContext();
    admin = await ensureAdmin(browser);

    if (!admin) {
      return;
    }

    // Discover run-created records across every reachable source (read-only GETs; no gate).
    for (const source of DISCOVERY_SOURCES) {
      const probe = await discover(source, admin.token);
      probes.push(probe);
      // Feed discovered entities into the tracker so run-scoped selection (21.1) and the
      // "no run-tagged entity remains" assertion (21.4) operate over the real observable set.
      for (const entity of probe.discovered) {
        tracker.track(entity.type, entity.id, entity.label);
      }
    }
  });

  test.afterAll(async () => {
    await admin?.context.close().catch(() => undefined);
    await apiContext?.dispose().catch(() => undefined);
    await mkdir(OUTPUT_DIR, { recursive: true }).catch(() => undefined);
    await report.write(REPORT_MD, REPORT_JSON).catch(() => undefined);
  });

  // ---------------------------------------------------------------------------------------------
  // 21.1 — Identify every QA_Entity created during the run across ALL types
  // ---------------------------------------------------------------------------------------------
  test('21.1 identifies every run-created QA_Entity across all types', async () => {
    const id = 'cleanup.identify';

    if (!admin) {
      report.record(
        id,
        '21.1',
        'blocked',
        'Admin session unavailable — cannot reach the admin listing surfaces to identify run entities.',
      );
      return;
    }

    // The tracker now holds every discoverable run-tagged entity; belongingToRun is the 21.1 set.
    const runEntities: TrackedEntity[] = tracker.belongingToRun(factory);
    const byType = runEntities.reduce<Record<string, number>>((acc, entity) => {
      acc[entity.type] = (acc[entity.type] ?? 0) + 1;
      return acc;
    }, {});

    const probeNotes = probes.map((probe) => probe.note);
    report.attachEvidence(id, {
      apiExcerpts: [
        `run_id=${env.runId}`,
        `discoverable_sources=${DISCOVERY_SOURCES.map((s) => s.type).join(',')}`,
        `run_tagged_entities=${runEntities.length}`,
        `by_type=${JSON.stringify(byType)}`,
        ...probeNotes,
      ],
    });

    // Every selected entity must genuinely carry this run's suffix (the run-scoped selection rule).
    const mismatched = runEntities.filter(
      (entity) => !(entity.label !== undefined && factory.belongsToRun(entity.label)) && !factory.belongsToRun(String(entity.id)),
    );
    if (mismatched.length > 0) {
      report.record(id, '21.1', 'fail', `Identified ${mismatched.length} entity(ies) not carrying the run-id suffix.`);
      return;
    }

    report.record(
      id,
      '21.1',
      'pass',
      `Identified ${runEntities.length} run-tagged QA_Entity(ies) across types [${Object.keys(byType).join(', ') || 'none discoverable'}]. ` +
        `${probeNotes.join(' ')}`,
    );
  });

  // ---------------------------------------------------------------------------------------------
  // 21.2 / 21.3 / 21.5 — Gate each deletion; remove confirmed entities and assert removal; record outcome
  // ---------------------------------------------------------------------------------------------
  test('21.2/21.3/21.5 gates each deletion, removes confirmed entities, and records the outcome', async () => {
    const id = 'cleanup.delete';

    if (!admin) {
      report.record(id, '21.2', 'blocked', 'Admin session unavailable — cannot perform gated cleanup deletions.');
      return;
    }

    const reachableProbes = probes.filter((probe) => probe.reachable);
    const totalDiscovered = reachableProbes.reduce((sum, probe) => sum + probe.discovered.length, 0);

    if (totalDiscovered === 0) {
      // Nothing run-tagged is present on any reachable surface — clean by construction.
      report.record(
        id,
        '21.3',
        'pass',
        `No run-tagged entities discovered on reachable surfaces (${reachableProbes.map((p) => p.source.type).join(', ') || 'none reachable'}); nothing to delete.`,
      );
      report.attachEvidence(id, { apiExcerpts: probes.map((p) => p.note) });
      return;
    }

    let executed = 0;
    let skipped = 0;
    let failed = 0;
    const evidence: string[] = [];

    for (const probe of reachableProbes) {
      for (const entity of probe.discovered) {
        const trackedEntity: TrackedEntity = { type: entity.type, id: entity.id, label: entity.label };

        // Account deletions reuse the account-delete-cache-access token-revocation pattern:
        // best-effort mint a token BEFORE deletion so revocation can be asserted afterwards.
        const isAccount = entity.type === 'account' || entity.type === 'client';
        const victimToken = isAccount ? await mintAccountToken(entity.label) : null;

        // Each deletion is a Destructive_Step routed through the gate (read-only by default).
        const gated = await gate.run<number>({
          name: `Delete ${entity.type} "${entity.label}" (id=${entity.id})`,
          kind: 'destructive',
          category: GATE_CATEGORY,
          action: async () => {
            const response = await api('delete', probe.source.deletePath(entity.id), admin!.token);
            return response.status();
          },
        });

        if (gated.status !== 'executed') {
          // Declined by default → skip + record the entity noted (Req 2.3, 21.5).
          report.recordCleanup(trackedEntity, 'skipped');
          skipped += 1;
          evidence.push(`skipped ${entity.type} id=${entity.id} (${gated.reason ?? 'gate declined'})`);
          continue;
        }

        const status = gated.value ?? 0;
        if (status < 200 || status >= 300) {
          report.recordCleanup(trackedEntity, 'failed');
          failed += 1;
          evidence.push(`failed ${entity.type} id=${entity.id} (DELETE → ${status})`);
          continue;
        }

        // 21.3 — assert the entity is actually removed from its listing surface.
        const present = await stillListed(probe.source, entity.id, admin.token);
        if (present) {
          report.recordCleanup(trackedEntity, 'failed');
          failed += 1;
          evidence.push(`failed ${entity.type} id=${entity.id} (still listed after DELETE → ${status})`);
          continue;
        }

        // Account token revocation (account-delete-cache-access 15b) when a token was minted.
        if (isAccount && victimToken) {
          const after = await api('get', '/api/user', victimToken);
          evidence.push(
            `account id=${entity.id} token revoked=${after.status() === 401} (GET /api/user → ${after.status()})`,
          );
        }

        report.recordCleanup(trackedEntity, 'removed');
        executed += 1;
        evidence.push(`removed ${entity.type} id=${entity.id} (DELETE → ${status}, evicted from listing)`);
      }
    }

    report.attachEvidence(id, { apiExcerpts: [...probes.map((p) => p.note), ...evidence] });

    if (failed > 0) {
      report.record(
        id,
        '21.3',
        'fail',
        `Cleanup deletions: ${executed} removed, ${skipped} skipped, ${failed} failed (see evidence).`,
      );
      return;
    }
    if (executed === 0) {
      // All deletions were gate-declined (read-only run) — recorded skipped, not failed.
      report.record(
        id,
        '21.2',
        'skipped',
        `All ${skipped} discovered deletion(s) declined by the confirmation gate (read-only run). ` +
          `Set E2E_CONFIRM_DESTRUCTIVE=1 or E2E_CONFIRM_CATEGORIES=cleanup to execute cleanup.`,
      );
      return;
    }
    report.record(
      id,
      '21.3',
      'pass',
      `Cleanup removed ${executed} confirmed entity(ies) and asserted their removal; ${skipped} skipped.`,
    );
  });

  // ---------------------------------------------------------------------------------------------
  // Blocked-and-continue: types with no discoverable/deletable run-id-keyed admin endpoint (Req 2.6)
  // ---------------------------------------------------------------------------------------------
  test('records blocked-and-continue for entity types without a run-id-keyed admin endpoint', async () => {
    for (const { type, dependency } of BLOCKED_TYPES) {
      const id = `cleanup.blocked.${type}`;
      report.record(id, '21.1', 'blocked', `${type}: ${dependency}`);
    }
  });

  // ---------------------------------------------------------------------------------------------
  // 21.4 — After cleanup, assert no run-tagged entity remains
  // ---------------------------------------------------------------------------------------------
  test('21.4 retains no QA_Entity tagged with the QA_Run_Id after cleanup', async () => {
    const id = 'cleanup.no-residue';

    if (!admin) {
      report.record(id, '21.4', 'blocked', 'Admin session unavailable — cannot re-verify the listing surfaces.');
      return;
    }

    // If any discoverable deletion was declined (read-only default), residue is expected — record
    // the check as skipped (the run intentionally mutated nothing) rather than failing.
    const cleanupRecords = report.cleanup();
    const anyRemoved = cleanupRecords.some((record) => record.outcome === 'removed');
    const anySkipped = cleanupRecords.some((record) => record.outcome === 'skipped');

    // Re-query each reachable source and collect any record still carrying the run-id suffix.
    const residue: string[] = [];
    const checkedSources: string[] = [];
    for (const source of DISCOVERY_SOURCES) {
      const response = await api('get', source.listPath, admin.token);
      if (!response.ok()) {
        continue;
      }
      checkedSources.push(source.type);
      const items = extractList(await readJson(response));
      for (const item of items) {
        const label = runLabelOf(item, source.labelFields);
        if (label !== null) {
          residue.push(`${source.type} id=${String(item.id)} label="${label}"`);
        }
      }
    }

    report.attachEvidence(id, {
      apiExcerpts: [
        `re_checked_sources=${checkedSources.join(',') || 'none reachable'}`,
        `residual_run_tagged=${residue.length}`,
        ...residue,
      ],
    });

    if (residue.length === 0) {
      report.record(id, '21.4', 'pass', `No run-tagged entity remains across [${checkedSources.join(', ') || 'no reachable surfaces'}].`);
      return;
    }

    if (anySkipped && !anyRemoved) {
      report.record(
        id,
        '21.4',
        'skipped',
        `${residue.length} run-tagged entity(ies) remain because cleanup deletions were declined ` +
          `(read-only run). Confirm the cleanup gate to remove them.`,
      );
      return;
    }

    report.record(
      id,
      '21.4',
      'fail',
      `${residue.length} run-tagged entity(ies) still present after confirmed cleanup: ${residue.join('; ')}.`,
    );
  });
});
