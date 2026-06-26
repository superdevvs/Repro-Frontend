# End-to-End Tests (Playwright)

Browser-based end-to-end checks for the Dashboard frontend. Runs **headless** by default
(`headless: true` in `playwright.config.ts`) — no headed/live display required.

These specs are kept under `e2e/` (suffix `*.e2e.ts`) so they do **not** collide with the
Vitest unit/property tests under `src/**` (`*.{test,spec}.tsx`).

## Specs

- `service-area-assignment.e2e.ts` — Requirement 10.6: drives the `ServiceAreaAssignmentTool`
  (page `/admin/service-areas`) through the full **filter → preview → commit** flow:
  1. Filter photographers by a service-area `(kind, value)`.
  2. **Preview matches** — asserts the matches render and that **no commit request fires**
     (preview persists nothing — AC 10.3, 10.5).
  3. **Confirm assignment** — asserts the commit request succeeds, the success toast shows,
     and the committed photographer is reflected in the refreshed match list (AC 10.4).

- `editor-lanes.e2e.ts` — Requirement 7 (QA-only): verifies the five editor checks for a
  **photo-lane** editor and a **video-lane** editor:
  1. **7.1 Login** — valid credentials authenticate (land on `/dashboard`).
  2. **7.2 Dashboard** — the editor dashboard renders for that lane.
  3. **7.3 Assigned-only** — only shoots assigned to that editor are listed.
  4. **7.4 Actions** — upload / download / share controls are available for an assigned shoot.
  5. **7.5 Restricted** — a page restricted to other roles (`/admin/service-areas`, guarded by
     `PermissionRoute resource="accounts"`) is blocked (redirect away + "Access Denied").

  > **Documented deviation:** this codebase has a single `editor` role (plus `editing_manager`),
  > with lane specialization carried on `users.metadata.editing_capabilities` (`photo` / `video`)
  > — NOT distinct `video_editor` / `photo_editor` account types. The spec verifies the two lanes
  > as editor accounts whose `editing_capabilities` include photo and video respectively.

- `qa-acceptance.e2e.ts` — cross-flow QA acceptance checks for current production-risk items:
  1. **Preview public booking** — opens `/book`, captures `qa-public-booking-before-submit.png`,
     and verifies the page does not force login/account creation before submit. If Lovable preview
     auth blocks the page, the test skips with instructions to provide `E2E_PREVIEW_STORAGE_STATE`.
  2. **External account-backed booking** — when `E2E_EXTERNAL_BOOKING_API_KEY` is set, submits a
     QA-labeled booking with `create_account: true` and asserts the response includes a client
     account setup flow (`client_id`, `account_created`, `account_setup_required`).
  3. **External guest opt-out booking** — submits a QA-labeled booking with `create_account: false`
     and asserts the response stays in guest mode (`account_created: false`,
     `account_setup_required: false`, `is_guest_booking: true`).
  4. **Editor dashboards** — logs into the photo-lane and video-lane editor accounts and captures
     dashboard screenshots for both.
  5. **Test-Shoot simulator** — creates region/state/area internal test shoots through the admin
     API and verifies each eligible-photographer preview responds for the requested scope.

## Prerequisites

This suite exercises the real application, so it needs the **full stack running with seeded
data**:

1. **Backend (Laravel)** on `http://127.0.0.1:8000` with a migrated + seeded database:
   - At least one **admin** user (credentials supplied via env, see below).
   - At least one **photographer** in the `/admin/photographers` directory.
   - Optionally, photographers already assigned to the filter service-area so the preview list
     is non-empty (the commit step works regardless and then makes the match appear).

   ```bash
   cd backend
   php artisan migrate:fresh --seed      # or your QA seed
   php artisan serve                     # http://127.0.0.1:8000
   ```

2. **Frontend (Vite)** — Playwright's managed `webServer` will start `npm run dev`
   (`http://localhost:5173`, which proxies `/api` to the backend) automatically. To run
   against an already-running frontend, set `E2E_BASE_URL`.

3. **Browser binaries** — install once:

   ```bash
   npx playwright install chromium
   ```

## Running

```bash
cd frontend

# Headless run (starts the Vite dev server automatically; backend must already be up)
npm run test:e2e

# Against an already-running app (skips the managed dev server)
E2E_BASE_URL=http://localhost:5173 npm run test:e2e

# Point at a fully external stack (no managed server)
E2E_NO_SERVER=1 E2E_BASE_URL=https://qa.example.com npm run test:e2e

# Interactive UI mode (local debugging only)
npm run test:e2e:ui
```

## Environment variables

| Variable             | Default                  | Purpose                                                        |
| -------------------- | ------------------------ | -------------------------------------------------------------- |
| `E2E_BASE_URL`       | `http://localhost:5173`  | Base URL of the Dashboard. When set, the managed server is off.|
| `E2E_API_BASE_URL`   | `E2E_BASE_URL` / local   | API base URL when browser host and Dashboard API host differ.  |
| `E2E_NO_SERVER`      | _(unset)_                | `1` disables the managed dev server entirely.                  |
| `E2E_PREVIEW_STORAGE_STATE` | _(unset)_          | Path to a Playwright storage-state JSON file for Lovable preview auth. |
| `E2E_EXTERNAL_BOOKING_API_KEY` | _(unset)_       | Enables the data-creating external guest booking acceptance check. |
| `E2E_QA_RUN_ID`      | timestamp                | Suffix used in QA-created names/emails/addresses.              |
| `E2E_ADMIN_EMAIL`    | `admin@example.com`      | Admin login email.                                             |
| `E2E_ADMIN_PASSWORD` | `password`               | Admin login password.                                          |
| `E2E_FILTER_KIND`    | `state`                  | Service-area kind to filter by (`region` / `state` / `area`).  |
| `E2E_FILTER_VALUE`   | `MD`                     | Service-area value to filter by.                               |
| `E2E_PHOTO_EDITOR_EMAIL`    | `photo-editor@example.com` | Photo-lane editor login email (Req 7).                  |
| `E2E_PHOTO_EDITOR_PASSWORD` | `password`                 | Photo-lane editor login password (Req 7).               |
| `E2E_VIDEO_EDITOR_EMAIL`    | `video-editor@example.com` | Video-lane editor login email (Req 7).                  |
| `E2E_VIDEO_EDITOR_PASSWORD` | `password`                 | Video-lane editor login password (Req 7).               |
| `E2E_ASSIGNED_SHOOT_ID`     | _(unset)_                  | Pin the assigned shoot used by the 7.4 action check.    |
| `E2E_EDITOR_RESTRICTED_ROUTE` | `/admin/service-areas`   | Restricted route used by the 7.5 block check.           |
| `E2E_TEST_SHOOT_REGION_VALUE` | `Northeast`              | Region value used by the Test-Shoot simulator check.    |
| `E2E_TEST_SHOOT_STATE_VALUE`  | `MD`                     | State value used by the Test-Shoot simulator check.     |
| `E2E_TEST_SHOOT_AREA_VALUE`   | `DC Metro`               | Area value used by the Test-Shoot simulator check.      |

> **`editor-lanes.e2e.ts` needs extra seed data:** two editor accounts (photo lane + video
> lane, distinguished by `users.metadata.editing_capabilities`), each with **at least one
> assigned shoot**, plus at least one shoot assigned to a **different** editor so the
> assigned-only check (7.3) is meaningful.

## CI notes

- `headless: true` is the default — safe for CI/sandbox.
- In CI (`process.env.CI`), the suite enables retries and an HTML report and does not reuse an
  existing dev server.
- Generated artifacts (`test-results/`, `playwright-report/`) are git-ignored.

## Photographer Onboarding QA

A full end-to-end QA suite that verifies the photographer onboarding journey lives under
`e2e/onboarding/*.e2e.ts`, backed by the shared harness in `e2e/helpers/onboarding-qa/`. It runs
through the same single **chromium** project as the rest of the suite and is launched with the
standard command from `frontend/`:

```bash
cd frontend
npm run test:e2e
```

> **Do not point this suite at live production for destructive/charge flows.** It defaults to
> read-only and gates every mutating step (see below). Run it against a QA/staging stack or with
> the confirmation flags left unset.

### Read-only-by-default model

Every step that would mutate data, charge money, or send a message is routed through a single
**confirmation gate** (`helpers/onboarding-qa/confirmation-gate.ts`). With no confirmation flags
set, those steps are **declined** and recorded as `skipped` — the run still completes and produces
a report. The gate always prefers a non-charging path when one exists. Missing data or missing
selectors are recorded as `blocked` and the run continues without waiting for human input.

### Confirmation env flags (gate the mutating categories)

| Variable                  | Default     | Purpose                                                            |
| ------------------------- | ----------- | ------------------------------------------------------------------ |
| `E2E_CONFIRM_DESTRUCTIVE` | _(unset)_   | Allow `destructive` steps (create/delete/reassign) to execute.     |
| `E2E_CONFIRM_CHARGE`      | _(unset)_   | Allow `charge`-triggering steps (invoice/payment) to execute.      |
| `E2E_CONFIRM_MESSAGE`     | _(unset)_   | Allow `message`-triggering steps (notification sends) to execute.  |
| `E2E_CONFIRM_CATEGORIES`  | _(unset)_   | Comma-list of categories to confirm in one switch (e.g. `destructive,message`). |

When a flag is unset, that category's steps are declined (read-only) and reported as `skipped`.

### Notification-sink modes (no live sends)

| Variable                | Default     | Purpose                                                              |
| ----------------------- | ----------- | -------------------------------------------------------------------- |
| `E2E_NOTIFICATION_MODE` | `log`       | Global notification sink mode (`log` records; `disabled` suppresses).|
| `E2E_EMAIL_MODE`        | `log`       | Email channel sink mode (`log` / `disabled`).                        |
| `E2E_SMS_MODE`          | `log`       | SMS channel sink mode (`log` / `disabled`).                          |
| `E2E_VOICE_MODE`        | `disabled`  | Voice channel mode — `disabled` so no calls are ever placed.         |

In `log` mode the suite reads back `Notification_Record`s (recipient/template/variables/channel)
and asserts no real send occurred; in `disabled` mode the channel is suppressed entirely.

### Run-scoped tagging + cleanup

| Variable        | Default     | Purpose                                                                    |
| --------------- | ----------- | -------------------------------------------------------------------------- |
| `E2E_QA_RUN_ID` | timestamp   | Suffix appended to every QA-created name/email/address; drives run-scoped cleanup. |

The data factory appends `E2E_QA_RUN_ID` to generated identifiers so the cleanup module
(`onboarding/cleanup.e2e.ts`, scheduled last) can select and remove **exactly** the entities this
run created, across all entity types, with each deletion routed through the gate.

### Fixture env vars consumed by the domain modules

These pin the read-mostly probes to known, seeded records. When one is unset, the dependent check
records a `Blocked_Check` (with the missing dependency noted) and the run continues.

| Variable                            | Used by                          | Purpose                                                  |
| ----------------------------------- | -------------------------------- | -------------------------------------------------------- |
| `E2E_CUBICASA_SHOOT_ID`             | `cubicasa.e2e.ts`                | Floor-plan shoot used for CubiCasa order/visibility checks. |
| `E2E_CUBICASA_NON_FLOORPLAN_SHOOT_ID` | `cubicasa.e2e.ts`, `negative-permissions.e2e.ts` | Shoot **without** Floor Plan to assert the create-order control is gated. |
| `E2E_UPLOAD_SHOOT_ID`               | `shoot-workflow.e2e.ts`          | Assigned shoot used for raw-upload edge-case checks.     |
| `E2E_LIFECYCLE_SHOOT_ID`            | `booking-lifecycle.e2e.ts`       | Shoot walked through the ordered `Booking_Status` path.  |
| `E2E_PAID_SHOOT_ID`                 | `invoicing-reporting.e2e.ts`     | Paid shoot for the payment-lock "download permitted" path. |
| `E2E_ZERO_DOLLAR_SHOOT_ID`          | `invoicing-reporting.e2e.ts`     | Zero-dollar shoot asserting no payment lock is applied.  |
| `E2E_SETTINGS_PHOTOGRAPHER_ID`      | `settings.e2e.ts`                | Photographer whose settings/effect round-trips are checked. |
| `E2E_PHOTOGRAPHER_ID`               | multiple modules                 | Default photographer used by profile/radius/equipment checks. |
| `E2E_SEEDED_ADDRESS_SET`            | `service-radius.e2e.ts`          | Names the seeded inside/boundary/outside address fixture set. |
| `E2E_EXTERNAL_BOOKING_API_KEY`      | booking flows                    | Enables data-creating external booking checks (gated).   |

> Additional per-module ids may be referenced by individual specs; an unset id always degrades to a
> recorded `Blocked_Check`, never a hard failure.

### Reports and the report-and-fix loop

Each domain module writes its own evidence-backed fragment to
`../output/playwright/<module>-report.{md,json}` (one entry per check, with screenshots, trace,
video-on-failure, console/network logs, API excerpts, created-entity IDs, and cleanup status). To
produce the **unified** green/yellow/red report, run the aggregator after a run:

```bash
cd frontend
npm run test:e2e:report
# (equivalently: node e2e/helpers/onboarding-qa/aggregate-report.ts [outputDir])
```

> **Runner note:** the repo has no `tsx`; the aggregator is a Node-native TypeScript entry that
> runs directly under the project's Node toolchain (`node e2e/helpers/onboarding-qa/aggregate-report.ts`).
> The `test:e2e:report` npm script wraps exactly that command. The aggregator is also importable
> (`aggregateReports(dir)`) for use from a test.

`aggregate-report.ts` reads every `*-report.json` fragment, merges their checks and cleanup
outcomes into a single `qa-report.{md,json}`, and computes the summary:

- **green** — every check passed **with** associated evidence.
- **yellow** — at least one check is `blocked`/`skipped` and none failed.
- **red** — any check failed, or a `pass` carries no evidence.

The merge implements two report-and-fix guarantees:

- **Continue-on-failure (Req 22.4):** aggregation never throws on a failing or malformed fragment;
  problems are recorded and skipped so the unified report is always produced.
- **Re-run override / latest-wins (Req 22.5/22.6):** when the same check `id` appears in more than
  one fragment (e.g. a re-run after a fix), the result from the newest fragment (`generatedAt`)
  wins while evidence from every run is preserved — mirroring `report.ts` override semantics.

The report-and-fix loop is therefore: **run** the suite → each module **produces evidence** → if a
check fails because of a real defect, **fix the Laravel/React code and re-run only that check** →
re-run the aggregator, whose latest-wins override marks the check's verified state.

### Stable-selector contract — known reconciliation

The selector contract (`helpers/onboarding-qa/selectors.ts`, `REQUIRED_TESTIDS`) drives onboarding
checks off stable `data-testid`s. Two contracted selectors were reconciled additively against the
real UI during the run (no behavior changed, no existing attribute removed):

- `cubicasa-create-order-button` — `CreateCubicasaOrderButton.tsx` already exposed
  `create-cubicasa-order-button` (different word order) on its wrapper. The contracted
  `data-testid="cubicasa-create-order-button"` was **added** on the create-order control while the
  existing wrapper/trigger testids were kept (so `cubicasa-manual-order.e2e.ts` still resolves
  `create-cubicasa-order-button`).
- `raw-upload-input` — `MediaUploadSections.tsx` used `raw-upload-input-${shoot.id}` only as an HTML
  element `id`. A stable `data-testid="raw-upload-input"` was **added** to the raw upload input (via
  a new optional `inputTestId` prop on `UploadDropzone`), keeping the per-shoot element `id` intact.

#### Follow-up: contracted `data-testid`s still to be added

These selector-driven checks remain `blocked` until the Onboarding_System exposes the contracted
`data-testid` on the corresponding control. Adding each one turns its blocked check green:

- [ ] `create-photographer-button` — admin "create photographer" control.
- [ ] `photographer-radius-input` — photographer service-radius input.
- [ ] `booking-address-input` — booking address input.
- [ ] `eligible-photographer-row` — eligible-photographer result row.
- [ ] `shoot-status-badge` — shoot status badge.
- [ ] `submit-to-editor-button` — submit-to-editor action control.
- [ ] `finalize-delivery-button` — finalize-delivery action control.
