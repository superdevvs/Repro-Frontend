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
