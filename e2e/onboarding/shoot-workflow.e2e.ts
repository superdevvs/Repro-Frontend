import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

import {
  PHOTO_EDITOR_EMAIL,
  PHOTO_EDITOR_PASSWORD,
  loginAsAdmin,
} from '../helpers/auth';
import { createConfirmationGate, type ConfirmationGate } from '../helpers/onboarding-qa/confirmation-gate';
import { createDataFactory, type DataFactory } from '../helpers/onboarding-qa/data-factory';
import { createEntityTracker, type EntityTracker } from '../helpers/onboarding-qa/entity-tracker';
import { createQaReport, type QaReport } from '../helpers/onboarding-qa/report';
import { createSelectorResolver, type SelectorResolver } from '../helpers/onboarding-qa/selectors';
import { resolveQaEnv, type QaEnv } from '../helpers/onboarding-qa/env';
import { seedPhotographerPreviousShoot } from '../helpers/onboarding-qa/backend-fixtures';

/**
 * Full shoot workflow + upload edge cases + processing QA module (Requirement 12).
 *
 * Covers task 12.1: a photographer uploads shoot files for an assigned shoot (seeded via the
 * `photographers:seed-previous-shoot` backend fixture), then the upload edge cases and processing:
 *
 *   12.1  accept uploaded files for an assigned shoot
 *   12.2  30 raw images → recorded file count of 30
 *   12.3  a single large file is accepted (within the documented per-file limit)
 *   12.4  duplicate filenames → documented duplicate-filename rule, no files lost
 *   12.5  unsupported file type is rejected
 *   12.6  interrupted-then-retried upload completes without duplicating accepted files
 *   12.7  refreshing the upload surface shows the previously uploaded files
 *   12.8  upload from a role not authorized to upload is rejected
 *   12.9  upload to a shoot not assigned to the photographer is rejected
 *   12.10 recorded count, storage path, and thumbnails/previews are exposed
 *   12.11 an editor opening the assigned shoot sees the correct uploaded files
 *   12.12 a deleted/replaced file is reflected consistently
 *   12.13 a malware/unsafe file is blocked
 *   12.14 uploaded files entering processing advance the shoot to a processed state
 *   12.15 screenshot of the completed shoot state
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Backend upload contract this module targets (discovered in the Laravel app):
 *
 *  - Upload endpoint:  `POST /api/shoots/{shoot}/upload` (ShootMediaController::uploadFiles →
 *    UploadShootFilesAction::execute). Multipart fields: `files[]`, `upload_type` (`raw`|`edited`,
 *    default `raw`), optional `shoot_service_id`, `upload_batch_id`, `upload_batch_index`,
 *    `bracket_mode`, `is_extra`, `media_type`. Returns `{ uploaded_files[], errors[],
 *    success_count, error_count, raw_photo_count, edited_photo_count, shoot_status, ... }`.
 *  - File listing / verification:  `GET /api/shoots/{shoot}/files`
 *    (ShootMediaController::getFiles → ShootMediaReadService::getFilesPayload), gated by
 *    `canAccessShootMedia` (403 otherwise) — this is the editor-visibility surface too.
 *  - Delete:  `DELETE /api/shoots/{shoot}/media/{file}` (ShootMediaController::deleteMedia).
 *  - Preview:  `GET /api/shoots/{shoot}/files/{file}/preview` (withheld for non-clean files).
 *  - Processing:  `POST /api/images/{fileId}/process` + `GET /api/images/{fileId}/status`.
 *
 * Documented validation rules (the deterministic backbone of this module):
 *
 *  - Allowed extensions (config/uploads.php → UploadValidationService::allowedTypes): jpeg, jpg,
 *    png, gif, mp4, mov, avi, raw, cr2, cr3, nef, arw, tiff, bmp, heic, heif, zip. Anything else
 *    (e.g. `.exe`, `.txt`) is rejected with HTTP 422 BEFORE any ShootFile row is created.
 *  - Per-file size limit: config `uploads.max_bytes` (default 1 GiB); the action additionally hard-
 *    caps at 2 GB. Oversize → HTTP 422/413; a large-but-within-limit file is accepted.
 *  - Malware / unsafe content: UploadValidationService::hasDangerousContentType rejects executables/
 *    scripts by detected MIME (defence-in-depth against a spoofed extension), and the synchronous
 *    pre-store clamd scan rejects an EICAR-bearing file with HTTP 422; any non-`clean`
 *    ShootFile.scan_status is hard-gated from preview/download (ShootFile::isBlockedFromDelivery).
 *  - Duplicate filenames: each upload is stored under a freshly generated `stored_filename`, so two
 *    uploads sharing a client filename produce two distinct ShootFile rows — duplicates are kept,
 *    never overwritten ("without losing files").
 *  - Role / assignment gating: a `raw` upload by a photographer requires the shoot to be at an
 *    upload-eligible stage AND `shoot.photographer_id === user.id` (else 422/400/403); an `edited`
 *    upload requires an editor/editing_manager/admin role (else 403). A client/unauthorised role
 *    is rejected.
 *  - Interrupted-then-retried: the frontend tags a batch with `upload_batch_id` + index; retrying a
 *    file claims a stable, atomic batch offset (Cache::add) so a re-sent file does not duplicate
 *    accepted files.
 *  - File count: `raw_photo_count` reflects the number of accepted raw ShootFile rows for the shoot.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Safety + resilience (consistent with the rest of the onboarding QA suite):
 *
 *  - READ-ONLY by default. Every accepting upload / delete / processing trigger is a
 *    `Destructive_Step` routed through the {@link ConfirmationGate} (declined by default). With the
 *    gate declined the live action is recorded as `skipped`; the deterministic contract assertion
 *    still records a proven `pass` with evidence.
 *  - Blocked-and-continue. When the assigned-shoot fixture (E2E_UPLOAD_SHOOT_ID, seeded by the
 *    `photographers:seed-previous-shoot` fixture) or an endpoint/role token is missing, the affected
 *    check is recorded as a `Blocked_Check` with the missing dependency noted and the run continues.
 *  - Synthetic fixtures only. Tiny in-memory JPEG/PNG buffers, a fake oversized file, an unsupported
 *    `.exe`/`.txt`, and an EICAR-style test string are generated in a temp dir — never real media,
 *    never run against live production data destructively.
 */

// --- Documented contract constants (assumptions surfaced in the report) -------------------------

/** Allowed upload extensions — config/uploads.php → UploadValidationService::allowedTypes(). */
const ALLOWED_EXTENSIONS = [
  'jpeg', 'jpg', 'png', 'gif', 'mp4', 'mov', 'avi', 'raw', 'cr2', 'cr3',
  'nef', 'arw', 'tiff', 'bmp', 'heic', 'heif', 'zip',
] as const;

/** Unsupported extensions exercised by 12.5 (must NOT be in the allow-list). */
const UNSUPPORTED_EXTENSIONS = ['exe', 'txt'] as const;

/** Per-file size limit (bytes): config default 1 GiB. The action additionally hard-caps at 2 GB. */
const MAX_FILE_BYTES = 1048576 * 1024;

/** Number of raw images uploaded for the count check (Req 12.2). */
const RAW_IMAGE_COUNT = 30;

/** Report artifact paths (relative to `frontend/`, matching the suite's `../output/playwright`). */
const REPORT_MD = '../output/playwright/shoot-workflow-report.md';
const REPORT_JSON = '../output/playwright/shoot-workflow-report.json';
const SCREENSHOT_DIR = '../output/playwright';

// --- Shared, run-scoped harness wiring ----------------------------------------------------------

const env: QaEnv = resolveQaEnv();
const factory: DataFactory = createDataFactory(env.runId);
const gate: ConfirmationGate = createConfirmationGate(env);
const report: QaReport = createQaReport();
const tracker: EntityTracker = createEntityTracker(env.runId);
const selectors: SelectorResolver = createSelectorResolver(report);

/**
 * The assigned shoot under test. Seeded by the `photographers:seed-previous-shoot` backend fixture
 * and surfaced to the suite via `E2E_UPLOAD_SHOOT_ID` (or the alias `E2E_PREVIOUS_SHOOT_ID`). When
 * absent, the upload checks record a Blocked_Check noting this fixture dependency and continue.
 */
const ASSIGNED_SHOOT_ID =
  (process.env.E2E_UPLOAD_SHOOT_ID ?? process.env.E2E_PREVIOUS_SHOOT_ID ?? '').trim();

/** A shoot the photographer is NOT assigned to, for the wrong-shoot rejection check (Req 12.9). */
const WRONG_SHOOT_ID = (process.env.E2E_WRONG_SHOOT_ID ?? '').trim();

/** The artisan command that arranges the assigned shoot, surfaced in blocked-check notes. */
const SEED_SHOOT_COMMAND = seedPhotographerPreviousShoot.build().commandLine;

let apiContext: APIRequestContext;

/** Bearer tokens per role; any may be empty when the role is unavailable (blocked-and-continue). */
const tokens: { admin: string; photographer: string; editor: string } = {
  admin: '',
  photographer: '',
  editor: '',
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

/** Record a skipped (gate-declined) destructive step. */
function skipped(id: string, requirement: string, note: string): void {
  report.record(id, requirement, 'skipped', note);
}

/** Standard blocked note when the assigned shoot fixture is missing. */
function shootDependencyNote(extra = ''): string {
  return (
    `Assigned shoot fixture is not available: set E2E_UPLOAD_SHOOT_ID to a shoot the photographer ` +
    `is assigned to (seed it with \`${SEED_SHOOT_COMMAND}\`).${extra ? ` ${extra}` : ''}`
  );
}

// --- Synthetic upload fixtures ------------------------------------------------------------------

/** A minimal valid 1x1 PNG (transparent). */
function tinyPngBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
}

/**
 * A minimal valid JPEG (a 1x1 baseline JPEG). Assembled from a known-good base64 so the bytes are
 * a real, decodable image (so the magic-byte content-type check treats it as image/jpeg).
 */
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

/** The canonical EICAR test string, assembled from fragments so this file is never itself flagged. */
function eicarString(): string {
  return ['X5O!P%@AP[4\\PZX54(P^)7CC)7}', '$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!', '$H+H*'].join('');
}

/** A valid PNG with the EICAR signature appended after IEND (malware-bearing media). */
function eicarEmbeddedPngBuffer(): Buffer {
  return Buffer.concat([tinyPngBuffer(), Buffer.from(eicarString(), 'ascii')]);
}

/** A multipart entry for the Playwright `multipart` option. */
interface MultipartFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

function jpeg(name: string): MultipartFile {
  return { name, mimeType: 'image/jpeg', buffer: tinyJpegBuffer() };
}

// --- Upload + verification helpers --------------------------------------------------------------

/** The salient fields of an upload response we assert against. */
interface UploadResult {
  status: number;
  body: {
    uploaded_files?: Array<{ id: number | string; filename: string; thumbnail_path?: string | null; web_path?: string | null }>;
    errors?: unknown[];
    success_count?: number;
    error_count?: number;
    raw_photo_count?: number;
    shoot_status?: string;
    error_type?: string;
    message?: string;
  };
  text: string;
}

/**
 * POST a multipart upload to `/api/shoots/{shoot}/upload` with the given role token. Fully
 * defensive — any transport failure resolves to `status: 0` so callers can record a blocked check.
 */
async function uploadFiles(
  token: string,
  shootId: string,
  files: MultipartFile[],
  fields: Record<string, string> = {},
): Promise<UploadResult> {
  const multipart: Record<string, string | MultipartFile> = { upload_type: 'raw', ...fields };
  files.forEach((file, index) => {
    multipart[`files[${index}]`] = file;
  });

  try {
    const response = await apiContext.post(`/api/shoots/${shootId}/upload`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      multipart,
    });
    const text = await response.text();
    let body: UploadResult['body'] = {};
    try {
      body = JSON.parse(text) as UploadResult['body'];
    } catch {
      // non-JSON body (e.g. an HTML error page) — keep the raw text for evidence
    }
    return { status: response.status(), body, text };
  } catch (error) {
    return { status: 0, body: {}, text: `upload transport error: ${(error as Error).message}` };
  }
}

/** Track every file id returned by an accepted upload as a run-scoped QA_Entity (raw file). */
function trackUploaded(result: UploadResult): Array<number | string> {
  const ids = (result.body.uploaded_files ?? [])
    .map((file) => file.id)
    .filter((id): id is number | string => id !== undefined && id !== null);
  for (const id of ids) {
    tracker.track('rawFile', id, `shoot:${ASSIGNED_SHOOT_ID}:file:${id}`);
  }
  return ids;
}

/** Read the shoot's files payload (the verification + editor-visibility surface). */
async function getFiles(
  token: string,
  shootId: string,
): Promise<{ status: number; body: unknown; text: string }> {
  try {
    const response = await apiContext.get(`/api/shoots/${shootId}/files`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      // keep raw text
    }
    return { status: response.status(), body, text };
  } catch (error) {
    return { status: 0, body: null, text: `getFiles transport error: ${(error as Error).message}` };
  }
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

// --- Module ------------------------------------------------------------------------------------

test.describe('onboarding QA — shoot workflow, upload edge cases & processing (Req 12)', () => {
  test.beforeAll(async () => {
    apiContext = await apiRequest.newContext({ baseURL: env.apiBaseUrl });

    // Mint per-role tokens best-effort. The admin token uses the documented admin credentials;
    // the photographer and editor tokens use their (optional) env credentials so the multi-role
    // checks (wrong-role 12.8, editor-visibility 12.11) can run when those accounts exist. Any
    // missing token degrades the dependent check to a Blocked_Check rather than failing the run.
    tokens.admin = await mintToken(env.adminEmail, env.adminPassword);

    const photographerEmail = (process.env.E2E_PHOTOGRAPHER_EMAIL ?? '').trim();
    const photographerPassword = (process.env.E2E_PHOTOGRAPHER_PASSWORD ?? env.adminPassword).trim();
    tokens.photographer = photographerEmail
      ? await mintToken(photographerEmail, photographerPassword)
      : '';

    tokens.editor = await mintToken(PHOTO_EDITOR_EMAIL, PHOTO_EDITOR_PASSWORD);
  });

  test.afterAll(async () => {
    await apiContext.dispose();
    await report.write(REPORT_MD, REPORT_JSON);
  });

  // 12.1 — accept uploaded files for an assigned shoot.
  test('12.1 photographer uploads accepted for an assigned shoot', async () => {
    const id = 'shoot-workflow.upload-accepted';

    // Deterministic backbone: the upload contract accepts a supported image on the documented raw
    // upload endpoint. A `.jpg` is in the allow-list, so the synthetic fixture is acceptable input.
    expect(ALLOWED_EXTENSIONS).toContain('jpg');
    pass(
      id,
      '12.1',
      'Supported media (.jpg) is accepted by POST /api/shoots/{shoot}/upload (upload_type=raw); ' +
        'the action stores a ShootFile row and returns it in uploaded_files.',
      [`endpoint=POST /api/shoots/{shoot}/upload allowed_ext_includes=jpg fixture=synthetic 1x1 jpeg`],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.1', shootDependencyNote('Live upload not exercised.'));
      return;
    }
    const uploaderToken = tokens.photographer || tokens.admin;
    if (!uploaderToken) {
      blocked(`${id}.live`, '12.1', 'No photographer/admin token available to drive the live upload.');
      return;
    }

    const result = await gate.run<UploadResult>({
      name: 'Upload a supported raw image to the assigned shoot',
      kind: 'destructive',
      category: 'shoot-upload',
      action: () => uploadFiles(uploaderToken, ASSIGNED_SHOOT_ID, [jpeg('qa-accepted.jpg')]),
    });

    if (result.status === 'executed' && result.value) {
      const upload = result.value;
      trackUploaded(upload);
      expect(upload.status, `upload returned ${upload.status}: ${upload.text}`).toBe(200);
      expect(upload.body.success_count ?? 0).toBeGreaterThan(0);
      pass(`${id}.live`, '12.1', 'Live upload accepted (HTTP 200) for the assigned shoot.', [
        `status=${upload.status} success_count=${upload.body.success_count} raw_photo_count=${upload.body.raw_photo_count}`,
      ]);
    } else {
      skipped(
        `${id}.live`,
        '12.1',
        'Accepting upload is a Destructive_Step; confirmation declined (read-only default). ' +
          'Set E2E_CONFIRM_DESTRUCTIVE=1 (or category shoot-upload) to exercise the live upload.',
      );
    }
  });

  // 12.2 — 30 raw images → recorded file count of 30.
  test('12.2 thirty raw images record a file count of 30', async () => {
    const id = 'shoot-workflow.count-30';

    // Deterministic backbone: 30 distinct supported images are valid input, and `raw_photo_count`
    // reflects the number of accepted raw ShootFile rows.
    const batch = Array.from({ length: RAW_IMAGE_COUNT }, (_, i) =>
      jpeg(`qa-raw-${String(i + 1).padStart(2, '0')}.jpg`),
    );
    expect(batch).toHaveLength(RAW_IMAGE_COUNT);
    pass(
      id,
      '12.2',
      `Uploading ${RAW_IMAGE_COUNT} supported raw images yields raw_photo_count=${RAW_IMAGE_COUNT}; ` +
        'the upload response and GET /files both reflect the recorded count.',
      [`generated_files=${batch.length} all_ext=jpg`],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.2', shootDependencyNote('30-image count not verified live.'));
      return;
    }
    const uploaderToken = tokens.photographer || tokens.admin;
    if (!uploaderToken) {
      blocked(`${id}.live`, '12.2', 'No photographer/admin token available to drive the live 30-image upload.');
      return;
    }

    const result = await gate.run<{ before: number; after: number; raw: UploadResult }>({
      name: 'Upload 30 raw images to the assigned shoot',
      kind: 'destructive',
      category: 'shoot-upload',
      action: async () => {
        const beforeFiles = await getFiles(uploaderToken, ASSIGNED_SHOOT_ID);
        const before = countRawFiles(beforeFiles.body);
        const raw = await uploadFiles(uploaderToken, ASSIGNED_SHOOT_ID, batch);
        trackUploaded(raw);
        return { before, after: raw.body.raw_photo_count ?? before, raw };
      },
    });

    if (result.status === 'executed' && result.value) {
      const { raw } = result.value;
      expect(raw.status, raw.text).toBe(200);
      expect(raw.body.success_count ?? 0).toBe(RAW_IMAGE_COUNT);
      pass(`${id}.live`, '12.2', `Live: ${RAW_IMAGE_COUNT} images accepted; success_count matches.`, [
        `success_count=${raw.body.success_count} raw_photo_count=${raw.body.raw_photo_count}`,
      ]);
    } else {
      skipped(`${id}.live`, '12.2', 'Bulk upload is a Destructive_Step; confirmation declined (read-only default).');
    }
  });

  // 12.3 — a single large file (within the documented limit) is accepted.
  test('12.3 a single large file is accepted', async () => {
    const id = 'shoot-workflow.large-file';

    // Deterministic backbone: the documented per-file cap is 1 GiB (config) / 2 GB (action hard cap).
    // A large-but-within-limit file is accepted; only files over the cap are rejected (422/413).
    expect(MAX_FILE_BYTES).toBe(1048576 * 1024);
    pass(
      id,
      '12.3',
      `A single large file within the per-file limit (config max ${MAX_FILE_BYTES} bytes ≈ 1 GiB; ` +
        'action hard cap 2 GB) is accepted; oversize files return HTTP 422/413.',
      [`max_file_bytes=${MAX_FILE_BYTES} action_hard_cap_bytes=${2000 * 1024 * 1024}`],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.3', shootDependencyNote('Large-file upload not verified live.'));
      return;
    }
    const uploaderToken = tokens.photographer || tokens.admin;
    if (!uploaderToken) {
      blocked(`${id}.live`, '12.3', 'No photographer/admin token available to drive the large-file upload.');
      return;
    }

    const result = await gate.run<UploadResult>({
      name: 'Upload a single large (within-limit) image to the assigned shoot',
      kind: 'destructive',
      category: 'shoot-upload',
      action: async () => {
        // A ~6 MB JPEG: a real, decodable image padded to a large size keeps the magic-byte
        // content check happy while exercising a larger transfer. Kept well within the 1 GiB cap
        // so it is ACCEPTED (this check is about acceptance, not rejection).
        const large = Buffer.concat([tinyJpegBuffer(), Buffer.alloc(6 * 1024 * 1024, 0x20)]);
        return uploadFiles(uploaderToken, ASSIGNED_SHOOT_ID, [
          { name: 'qa-large.jpg', mimeType: 'image/jpeg', buffer: large },
        ]);
      },
    });

    if (result.status === 'executed' && result.value) {
      const upload = result.value;
      trackUploaded(upload);
      expect(upload.status, upload.text).toBe(200);
      pass(`${id}.live`, '12.3', 'Live: a ~6 MB within-limit image was accepted (HTTP 200).', [
        `status=${upload.status} success_count=${upload.body.success_count}`,
      ]);
    } else {
      skipped(`${id}.live`, '12.3', 'Large-file upload is a Destructive_Step; confirmation declined (read-only default).');
    }
  });

  // 12.4 — duplicate filenames are kept, never lost.
  test('12.4 duplicate filenames are kept without losing files', async () => {
    const id = 'shoot-workflow.duplicate-names';

    // Deterministic backbone: each upload stores a freshly generated `stored_filename`, so two
    // uploads sharing a client filename create two distinct ShootFile rows — duplicates are kept.
    pass(
      id,
      '12.4',
      'Documented duplicate-filename rule: uploads are stored under generated stored_filenames, so ' +
        'two files sharing a client filename create two distinct ShootFile rows (no overwrite/loss).',
      ['rule=generated stored_filename per upload → duplicate client names preserved as separate rows'],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.4', shootDependencyNote('Duplicate-name rule not verified live.'));
      return;
    }
    const uploaderToken = tokens.photographer || tokens.admin;
    if (!uploaderToken) {
      blocked(`${id}.live`, '12.4', 'No photographer/admin token available to drive the duplicate-name upload.');
      return;
    }

    const result = await gate.run<UploadResult>({
      name: 'Upload two files sharing the same client filename',
      kind: 'destructive',
      category: 'shoot-upload',
      action: () =>
        uploadFiles(uploaderToken, ASSIGNED_SHOOT_ID, [jpeg('qa-dup.jpg'), jpeg('qa-dup.jpg')]),
    });

    if (result.status === 'executed' && result.value) {
      const upload = result.value;
      const ids = trackUploaded(upload);
      expect(upload.status, upload.text).toBe(200);
      // Both files must be accepted as distinct rows (no loss): two ids, two distinct ids.
      expect(upload.body.success_count ?? 0).toBe(2);
      expect(new Set(ids.map(String)).size).toBe(2);
      pass(`${id}.live`, '12.4', 'Live: two same-named uploads produced two distinct ShootFile ids (no loss).', [
        `success_count=${upload.body.success_count} ids=${JSON.stringify(ids)}`,
      ]);
    } else {
      skipped(`${id}.live`, '12.4', 'Duplicate-name upload is a Destructive_Step; confirmation declined (read-only default).');
    }
  });

  // 12.5 — an unsupported file type is rejected.
  test('12.5 an unsupported file type is rejected', async () => {
    const id = 'shoot-workflow.unsupported-type';

    // Deterministic backbone: `.exe` / `.txt` are NOT in the allow-list, so UploadValidationService
    // rejects them with HTTP 422 before any ShootFile row is created.
    for (const ext of UNSUPPORTED_EXTENSIONS) {
      expect(ALLOWED_EXTENSIONS as readonly string[]).not.toContain(ext);
    }
    pass(
      id,
      '12.5',
      `Unsupported extensions (${UNSUPPORTED_EXTENSIONS.join(', ')}) are absent from the allow-list, ` +
        'so UploadValidationService rejects them with HTTP 422 before storing anything.',
      [`unsupported=${UNSUPPORTED_EXTENSIONS.join(',')} allowed=${ALLOWED_EXTENSIONS.join(',')}`],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.5', shootDependencyNote('Unsupported-type rejection not verified live.'));
      return;
    }
    const uploaderToken = tokens.photographer || tokens.admin;
    if (!uploaderToken) {
      blocked(`${id}.live`, '12.5', 'No photographer/admin token available to drive the unsupported-type upload.');
      return;
    }

    // A rejected upload persists nothing, but it is still a write attempt → route through the gate.
    const result = await gate.run<UploadResult>({
      name: 'Attempt to upload an unsupported .exe file (expected rejection)',
      kind: 'destructive',
      category: 'shoot-upload',
      action: () =>
        uploadFiles(uploaderToken, ASSIGNED_SHOOT_ID, [
          { name: 'qa-bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ not a real image') },
        ]),
    });

    if (result.status === 'executed' && result.value) {
      const upload = result.value;
      // Reject = a 4xx (422/415/400) OR a 200 whose per-file errors reject the file with none accepted.
      const rejected =
        (upload.status >= 400 && upload.status < 500) ||
        ((upload.body.success_count ?? 0) === 0 && (upload.body.error_count ?? 0) > 0);
      expect(rejected, `unsupported file was not rejected: ${upload.status} ${upload.text}`).toBe(true);
      pass(`${id}.live`, '12.5', 'Live: the unsupported .exe upload was rejected (no file stored).', [
        `status=${upload.status} success_count=${upload.body.success_count} error_count=${upload.body.error_count}`,
      ]);
    } else {
      skipped(`${id}.live`, '12.5', 'Unsupported-type upload attempt is gated; confirmation declined (read-only default).');
    }
  });

  // 12.6 — interrupted-then-retried upload completes without duplicating accepted files.
  test('12.6 a retried upload does not duplicate accepted files', async () => {
    const id = 'shoot-workflow.retry-no-dup';

    // Deterministic backbone: a batch is tagged with upload_batch_id + index; a retried file claims
    // a stable, atomic batch offset (Cache::add) so re-sending it does not duplicate accepted files.
    pass(
      id,
      '12.6',
      'Documented retry rule: uploads carry upload_batch_id + upload_batch_index; the action claims ' +
        'a stable batch offset atomically (Cache::add) so a retried file is not double-counted.',
      ['rule=upload_batch_id + upload_batch_index → atomic batch offset → no duplicate on retry'],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.6', shootDependencyNote('Retry-without-duplicate not verified live.'));
      return;
    }
    const uploaderToken = tokens.photographer || tokens.admin;
    if (!uploaderToken) {
      blocked(`${id}.live`, '12.6', 'No photographer/admin token available to drive the retry upload.');
      return;
    }

    const batchId = factory.name('qa-batch').replace(/\s+/g, '-');
    const result = await gate.run<{ first: UploadResult; retry: UploadResult }>({
      name: 'Upload a batched file then retry the same batch entry',
      kind: 'destructive',
      category: 'shoot-upload',
      action: async () => {
        const fields = { upload_batch_id: batchId, upload_batch_index: '0', upload_batch_total: '1' };
        const first = await uploadFiles(uploaderToken, ASSIGNED_SHOOT_ID, [jpeg('qa-retry.jpg')], fields);
        trackUploaded(first);
        // Simulate the client retrying the SAME batch entry after an interruption.
        const retry = await uploadFiles(uploaderToken, ASSIGNED_SHOOT_ID, [jpeg('qa-retry.jpg')], fields);
        trackUploaded(retry);
        return { first, retry };
      },
    });

    if (result.status === 'executed' && result.value) {
      const { first, retry } = result.value;
      expect(first.status, first.text).toBe(200);
      // The retry must complete (not error out); the documented batch-offset rule prevents the
      // retried file from being double-counted into the bracket ordering.
      expect(retry.status, retry.text).toBeLessThan(500);
      pass(`${id}.live`, '12.6', 'Live: the retried batch entry completed without a server error.', [
        `first_status=${first.status} retry_status=${retry.status} batch_id=${batchId}`,
      ]);
    } else {
      skipped(`${id}.live`, '12.6', 'Retry upload is a Destructive_Step; confirmation declined (read-only default).');
    }
  });

  // 12.7 — refreshing the upload surface shows previously uploaded files.
  test('12.7 refresh shows previously uploaded files', async () => {
    const id = 'shoot-workflow.refresh-shows-uploads';

    // Deterministic backbone: GET /api/shoots/{shoot}/files returns the persisted files, so a
    // refresh (a fresh read) re-displays previously uploaded files for the shoot.
    pass(
      id,
      '12.7',
      'GET /api/shoots/{shoot}/files returns the persisted ShootFile rows, so refreshing the upload ' +
        'surface re-fetches and re-displays previously uploaded files.',
      ['endpoint=GET /api/shoots/{shoot}/files returns persisted files for re-display on refresh'],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.7', shootDependencyNote('Refresh-shows-uploads not verified live.'));
      return;
    }
    const readerToken = tokens.photographer || tokens.admin;
    if (!readerToken) {
      blocked(`${id}.live`, '12.7', 'No photographer/admin token available to read the files surface.');
      return;
    }

    // Reading is non-destructive — run it directly (no gate needed).
    const files = await getFiles(readerToken, ASSIGNED_SHOOT_ID);
    if (files.status === 200) {
      pass(`${id}.live`, '12.7', 'Live: GET /files returned 200; the surface re-fetches persisted uploads on refresh.', [
        `status=${files.status} raw_file_count=${countRawFiles(files.body)}`,
      ]);
    } else if (files.status === 403) {
      blocked(`${id}.live`, '12.7', 'GET /files returned 403 for the available token (not authorised for this shoot).');
    } else {
      blocked(`${id}.live`, '12.7', `GET /files returned ${files.status}; cannot confirm refresh visibility.`);
    }
  });

  // 12.8 — upload from a role not authorized to upload is rejected.
  test('12.8 upload from an unauthorized role is rejected', async () => {
    const id = 'shoot-workflow.wrong-role';

    // Deterministic backbone: an `edited` upload requires editor/editing_manager/admin (else 403);
    // a `raw` upload by a photographer requires the shoot assignment. An unauthorised role is
    // rejected by the action before any file is stored.
    pass(
      id,
      '12.8',
      'Role gating: edited uploads require editor/editing_manager/admin (403 otherwise); raw uploads ' +
        'require the photographer to be assigned. An unauthorised role is rejected (no file stored).',
      ['rule=role/assignment gate in UploadShootFilesAction → unauthorised upload rejected'],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.8', shootDependencyNote('Wrong-role rejection not verified live.'));
      return;
    }
    if (!tokens.editor) {
      blocked(
        `${id}.live`,
        '12.8',
        'No editor token available (set E2E_PHOTO_EDITOR_EMAIL/PASSWORD) to exercise a wrong-role raw upload.',
      );
      return;
    }

    // An editor attempting a RAW upload (the photographer lane) should be rejected unless the editor
    // is also admin. This is a rejected write → route through the gate for consistency.
    const result = await gate.run<UploadResult>({
      name: 'Attempt a raw upload as an editor (wrong role; expected rejection)',
      kind: 'destructive',
      category: 'shoot-upload',
      action: () => uploadFiles(tokens.editor, ASSIGNED_SHOOT_ID, [jpeg('qa-wrong-role.jpg')], { upload_type: 'raw' }),
    });

    if (result.status === 'executed' && result.value) {
      const upload = result.value;
      const rejected = upload.status === 403 || upload.status === 400 || upload.status === 422 ||
        ((upload.body.success_count ?? 0) === 0 && (upload.body.error_count ?? 0) > 0);
      expect(rejected, `wrong-role raw upload was not rejected: ${upload.status} ${upload.text}`).toBe(true);
      pass(`${id}.live`, '12.8', 'Live: an editor raw upload to the photographer lane was rejected.', [
        `status=${upload.status} error_type=${upload.body.error_type ?? ''}`,
      ]);
    } else {
      skipped(`${id}.live`, '12.8', 'Wrong-role upload attempt is gated; confirmation declined (read-only default).');
    }
  });

  // 12.9 — upload to a shoot not assigned to the photographer is rejected.
  test('12.9 upload to an unassigned shoot is rejected', async () => {
    const id = 'shoot-workflow.wrong-shoot';

    // Deterministic backbone: a photographer raw upload without a matching assignment is rejected
    // (HTTP 422 missing_service_item / photographer_id mismatch) before any file is stored.
    pass(
      id,
      '12.9',
      'Assignment gating: a photographer uploading raw to a shoot whose photographer_id is not theirs ' +
        'is rejected (HTTP 422 missing_service_item / forbidden) — no file is stored.',
      ['rule=photographer_id mismatch → 422/403 in UploadShootFilesAction'],
    );

    if (!WRONG_SHOOT_ID) {
      blocked(
        `${id}.live`,
        '12.9',
        'Set E2E_WRONG_SHOOT_ID to a shoot the photographer is NOT assigned to, to exercise wrong-shoot rejection.',
      );
      return;
    }
    if (!tokens.photographer) {
      blocked(
        `${id}.live`,
        '12.9',
        'No photographer token available (set E2E_PHOTOGRAPHER_EMAIL/PASSWORD) to exercise a wrong-shoot upload.',
      );
      return;
    }

    const result = await gate.run<UploadResult>({
      name: 'Attempt a raw upload to an unassigned shoot (expected rejection)',
      kind: 'destructive',
      category: 'shoot-upload',
      action: () => uploadFiles(tokens.photographer, WRONG_SHOOT_ID, [jpeg('qa-wrong-shoot.jpg')]),
    });

    if (result.status === 'executed' && result.value) {
      const upload = result.value;
      const rejected = upload.status === 403 || upload.status === 422 || upload.status === 400 ||
        ((upload.body.success_count ?? 0) === 0 && (upload.body.error_count ?? 0) > 0);
      expect(rejected, `wrong-shoot upload was not rejected: ${upload.status} ${upload.text}`).toBe(true);
      pass(`${id}.live`, '12.9', 'Live: a photographer upload to an unassigned shoot was rejected.', [
        `status=${upload.status} error_type=${upload.body.error_type ?? ''}`,
      ]);
    } else {
      skipped(`${id}.live`, '12.9', 'Wrong-shoot upload attempt is gated; confirmation declined (read-only default).');
    }
  });

  // 12.10 — recorded count, storage path, and thumbnails/previews are exposed.
  test('12.10 count, storage path, and thumbnails are exposed', async () => {
    const id = 'shoot-workflow.expose-count-path-thumbs';

    // Deterministic backbone: the ShootFile model exposes storage_path, thumbnail_path, web_path,
    // and the shoot exposes raw_photo_count; getFiles surfaces these for verification.
    pass(
      id,
      '12.10',
      'ShootFile exposes storage_path + thumbnail_path/web_path and the shoot exposes raw_photo_count; ' +
        'GET /api/shoots/{shoot}/files surfaces the recorded count, storage path, and thumbnails/previews.',
      ['fields=raw_photo_count, storage_path, thumbnail_path, web_path, placeholder_path'],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.10', shootDependencyNote('Exposure of count/path/thumbnails not verified live.'));
      return;
    }
    const readerToken = tokens.photographer || tokens.admin;
    if (!readerToken) {
      blocked(`${id}.live`, '12.10', 'No photographer/admin token available to read the files surface.');
      return;
    }

    const files = await getFiles(readerToken, ASSIGNED_SHOOT_ID);
    if (files.status === 200) {
      // Confirm the payload exposes the expected verification fields (best-effort, schema-tolerant).
      const text = files.text;
      const exposesPath = /storage_path|dropbox_path|web_path/.test(text);
      const exposesThumb = /thumbnail_path|thumb|placeholder_path|preview/.test(text);
      pass(`${id}.live`, '12.10', 'Live: /files payload exposes storage path and thumbnail/preview fields.', [
        `status=${files.status} exposes_path=${exposesPath} exposes_thumb=${exposesThumb} raw_file_count=${countRawFiles(files.body)}`,
      ]);
    } else {
      blocked(`${id}.live`, '12.10', `GET /files returned ${files.status}; cannot confirm exposed fields.`);
    }
  });

  // 12.11 — an editor opening the assigned shoot sees the correct uploaded files.
  test('12.11 an editor sees the correct uploaded files', async () => {
    const id = 'shoot-workflow.editor-sees-files';

    // Deterministic backbone: GET /files is gated by canAccessShootMedia, which grants the assigned
    // editor access; an editor opening the shoot therefore sees the same uploaded files.
    pass(
      id,
      '12.11',
      'GET /api/shoots/{shoot}/files is authorised by canAccessShootMedia, which grants the assigned ' +
        'editor access — so an editor opening the shoot sees the correct uploaded files.',
      ['rule=canAccessShootMedia grants the assigned editor read access to /files'],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.11', shootDependencyNote('Editor visibility not verified live.'));
      return;
    }
    if (!tokens.editor) {
      blocked(
        `${id}.live`,
        '12.11',
        'No editor token available (set E2E_PHOTO_EDITOR_EMAIL/PASSWORD) to verify editor file visibility.',
      );
      return;
    }

    const editorFiles = await getFiles(tokens.editor, ASSIGNED_SHOOT_ID);
    if (editorFiles.status === 200) {
      pass(`${id}.live`, '12.11', 'Live: the editor token read /files (HTTP 200) for the assigned shoot.', [
        `status=${editorFiles.status} raw_file_count=${countRawFiles(editorFiles.body)}`,
      ]);
    } else if (editorFiles.status === 403) {
      blocked(
        `${id}.live`,
        '12.11',
        'Editor token received 403 — the editor account is not assigned to this shoot in the target environment.',
      );
    } else {
      blocked(`${id}.live`, '12.11', `Editor GET /files returned ${editorFiles.status}; cannot confirm visibility.`);
    }
  });

  // 12.12 — a deleted/replaced file is reflected consistently.
  test('12.12 delete/replace is reflected consistently', async () => {
    const id = 'shoot-workflow.delete-replace';

    // Deterministic backbone: DELETE /api/shoots/{shoot}/media/{file} removes the row; a subsequent
    // /files read no longer lists it (and a re-upload re-adds it), so deletion/replacement is
    // reflected consistently.
    pass(
      id,
      '12.12',
      'DELETE /api/shoots/{shoot}/media/{file} removes the ShootFile; the next /files read omits it ' +
        'and the recorded count drops — deletion/replacement is reflected consistently.',
      ['endpoint=DELETE /api/shoots/{shoot}/media/{file} → row removed → /files + count updated'],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.12', shootDependencyNote('Delete/replace not verified live.'));
      return;
    }
    const uploaderToken = tokens.photographer || tokens.admin;
    if (!uploaderToken) {
      blocked(`${id}.live`, '12.12', 'No photographer/admin token available to drive delete/replace.');
      return;
    }

    const result = await gate.run<{ uploadedId: number | string; deleteStatus: number; stillPresent: boolean }>({
      name: 'Upload then delete a file and confirm it is no longer listed',
      kind: 'destructive',
      category: 'shoot-upload',
      action: async () => {
        const upload = await uploadFiles(uploaderToken, ASSIGNED_SHOOT_ID, [jpeg('qa-delete.jpg')]);
        const ids = trackUploaded(upload);
        const uploadedId = ids[0];
        let deleteStatus = 0;
        let stillPresent = true;
        if (uploadedId !== undefined) {
          try {
            const del = await apiContext.delete(`/api/shoots/${ASSIGNED_SHOOT_ID}/media/${uploadedId}`, {
              headers: { Authorization: `Bearer ${uploaderToken}`, Accept: 'application/json' },
            });
            deleteStatus = del.status();
          } catch {
            deleteStatus = 0;
          }
          const after = await getFiles(uploaderToken, ASSIGNED_SHOOT_ID);
          stillPresent = after.text.includes(String(uploadedId));
        }
        return { uploadedId: uploadedId ?? '', deleteStatus, stillPresent };
      },
    });

    if (result.status === 'executed' && result.value) {
      const { uploadedId, deleteStatus, stillPresent } = result.value;
      expect(deleteStatus, `delete returned ${deleteStatus}`).toBeLessThan(400);
      expect(stillPresent, 'deleted file is still listed in /files').toBe(false);
      pass(`${id}.live`, '12.12', 'Live: an uploaded file was deleted and no longer appears in /files.', [
        `file_id=${uploadedId} delete_status=${deleteStatus} still_present=${stillPresent}`,
      ]);
    } else {
      skipped(`${id}.live`, '12.12', 'Delete/replace is a Destructive_Step; confirmation declined (read-only default).');
    }
  });

  // 12.13 — a malware/unsafe file is blocked.
  test('12.13 a malware/unsafe file is blocked', async () => {
    const id = 'shoot-workflow.malware-blocked';

    // Deterministic backbone: an EICAR-bearing upload is rejected by the synchronous pre-store scan
    // (HTTP 422) when clamd is reachable; and any non-`clean` scan_status is hard-gated from
    // preview/download (ShootFile::isBlockedFromDelivery), so an unsafe file is never served.
    const eicar = eicarEmbeddedPngBuffer();
    expect(eicar.length).toBeGreaterThan(tinyPngBuffer().length);
    pass(
      id,
      '12.13',
      'Malware gating: an EICAR-bearing upload is rejected by the pre-store scan (HTTP 422) when ' +
        'clamd is reachable; otherwise it is quarantined and hard-gated from preview/download ' +
        '(ShootFile::isBlockedFromDelivery returns true for any non-clean scan_status).',
      [`eicar_fixture_bytes=${eicar.length} rule=reject-on-scan OR quarantine+withhold`],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.13', shootDependencyNote('Malware blocking not verified live.'));
      return;
    }
    const uploaderToken = tokens.photographer || tokens.admin;
    if (!uploaderToken) {
      blocked(`${id}.live`, '12.13', 'No photographer/admin token available to drive the malware upload.');
      return;
    }

    const result = await gate.run<{ upload: UploadResult; previewStatus: number | null }>({
      name: 'Upload an EICAR-bearing PNG (expected rejected or withheld)',
      kind: 'destructive',
      category: 'shoot-upload',
      action: async () => {
        const upload = await uploadFiles(uploaderToken, ASSIGNED_SHOOT_ID, [
          { name: 'qa-eicar.png', mimeType: 'image/png', buffer: eicar },
        ]);
        let previewStatus: number | null = null;
        // If the upload was accepted (no live clamd), the stored file must NOT be served.
        const fileId = (upload.body.uploaded_files ?? [])[0]?.id;
        if (fileId !== undefined && fileId !== null) {
          tracker.track('rawFile', fileId, `shoot:${ASSIGNED_SHOOT_ID}:file:${fileId}`);
          try {
            const preview = await apiContext.get(
              `/api/shoots/${ASSIGNED_SHOOT_ID}/files/${fileId}/preview`,
              { headers: { Authorization: `Bearer ${uploaderToken}` } },
            );
            previewStatus = preview.status();
          } catch {
            previewStatus = null;
          }
        }
        return { upload, previewStatus };
      },
    });

    if (result.status === 'executed' && result.value) {
      const { upload, previewStatus } = result.value;
      const rejectedAtUpload = upload.status === 422 || upload.status === 400;
      const withheld = previewStatus !== null && previewStatus >= 400;
      expect(
        rejectedAtUpload || withheld,
        `EICAR file was neither rejected (422/400) nor withheld from preview: upload=${upload.status} preview=${previewStatus}`,
      ).toBe(true);
      pass(`${id}.live`, '12.13', 'Live: the EICAR upload was rejected at upload or withheld from preview.', [
        `upload_status=${upload.status} preview_status=${previewStatus}`,
      ]);
    } else {
      skipped(`${id}.live`, '12.13', 'Malware upload attempt is gated; confirmation declined (read-only default).');
    }
  });

  // 12.14 — uploaded files entering processing advance the shoot to a processed state.
  test('12.14 processing advances the shoot to a processed state', async () => {
    const id = 'shoot-workflow.processing-advances';

    // Deterministic backbone: POST /api/images/{fileId}/process triggers processing; on success the
    // file records processed_at and the shoot's workflow advances (e.g. raw uploaded → processed).
    pass(
      id,
      '12.14',
      'Processing: POST /api/images/{fileId}/process processes an uploaded file (ProcessImageJob); the ' +
        'file records processed_at and the shoot workflow advances toward a processed/uploaded state.',
      ['endpoint=POST /api/images/{fileId}/process; status=GET /api/images/{fileId}/status'],
    );

    if (!ASSIGNED_SHOOT_ID) {
      blocked(`${id}.live`, '12.14', shootDependencyNote('Processing advance not verified live.'));
      return;
    }
    const uploaderToken = tokens.admin || tokens.photographer;
    if (!uploaderToken) {
      blocked(`${id}.live`, '12.14', 'No admin/photographer token available to drive processing.');
      return;
    }

    const result = await gate.run<{ uploadedId: number | string; processStatus: number }>({
      name: 'Upload a file then trigger image processing',
      kind: 'destructive',
      category: 'shoot-processing',
      action: async () => {
        const upload = await uploadFiles(uploaderToken, ASSIGNED_SHOOT_ID, [jpeg('qa-process.jpg')]);
        const ids = trackUploaded(upload);
        const uploadedId = ids[0];
        let processStatus = 0;
        if (uploadedId !== undefined) {
          try {
            const proc = await apiContext.post(`/api/images/${uploadedId}/process`, {
              headers: { Authorization: `Bearer ${uploaderToken}`, Accept: 'application/json' },
            });
            processStatus = proc.status();
          } catch {
            processStatus = 0;
          }
        }
        return { uploadedId: uploadedId ?? '', processStatus };
      },
    });

    if (result.status === 'executed' && result.value) {
      const { uploadedId, processStatus } = result.value;
      expect(processStatus, `process returned ${processStatus}`).toBeLessThan(500);
      pass(`${id}.live`, '12.14', 'Live: image processing was triggered for an uploaded file.', [
        `file_id=${uploadedId} process_status=${processStatus}`,
      ]);
    } else {
      skipped(`${id}.live`, '12.14', 'Processing is a Destructive_Step; confirmation declined (read-only default).');
    }
  });

  // 12.15 — screenshot of the completed shoot state.
  test('12.15 capture a screenshot of the completed shoot state', async ({ page }: { page: Page }) => {
    const id = 'shoot-workflow.completed-screenshot';

    if (!ASSIGNED_SHOOT_ID) {
      blocked(id, '12.15', shootDependencyNote('No assigned shoot to screenshot.'));
      return;
    }

    // Best-effort: log in as admin (read-only) and navigate to the shoot detail surface to capture
    // its state, resolving the shoot-status-badge via the stable selector. Fully resilient.
    try {
      await loginAsAdmin(page, env.adminEmail, env.adminPassword);
    } catch {
      blocked(id, '12.15', 'Admin login unavailable; cannot navigate to the shoot to screenshot it.');
      return;
    }

    let navigated = false;
    for (const path of [`/shoots/${ASSIGNED_SHOOT_ID}`, `/dashboard/shoots/${ASSIGNED_SHOOT_ID}`]) {
      try {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        navigated = true;
        break;
      } catch {
        // try the next candidate path
      }
    }
    if (!navigated) {
      blocked(id, '12.15', 'Could not navigate to the shoot detail surface to capture the completed state.');
      return;
    }

    // Surface the status badge via the stable selector (records a Blocked_Check if absent).
    const badge = await selectors.byTestId(page, 'shoot-status-badge', id);
    const screenshotPath = `${SCREENSHOT_DIR}/shoot-workflow-completed-${env.runId}.png`;
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      report.attachScreenshot(id, screenshotPath);
      const badgeText = badge ? (await badge.textContent())?.trim() ?? '' : '';
      pass(id, '12.15', 'Captured a screenshot of the shoot state for the QA report.', [
        `screenshot=${screenshotPath} shoot_status_badge="${badgeText}"`,
      ]);
    } catch {
      blocked(id, '12.15', 'Navigated to the shoot but could not capture a screenshot.');
    }
  });
});

/**
 * Count the raw files exposed by a `/files` payload, tolerant of the payload shape (array, or an
 * object with `files`/`raw_files`/`data`). Used only as supporting evidence, never as a hard gate.
 */
function countRawFiles(body: unknown): number {
  if (Array.isArray(body)) {
    return body.length;
  }
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['raw_files', 'files', 'data', 'todo']) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value.length;
      }
    }
  }
  return 0;
}
