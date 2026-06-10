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
| `E2E_NO_SERVER`      | _(unset)_                | `1` disables the managed dev server entirely.                  |
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

> **`editor-lanes.e2e.ts` needs extra seed data:** two editor accounts (photo lane + video
> lane, distinguished by `users.metadata.editing_capabilities`), each with **at least one
> assigned shoot**, plus at least one shoot assigned to a **different** editor so the
> assigned-only check (7.3) is meaningful.

## CI notes

- `headless: true` is the default — safe for CI/sandbox.
- In CI (`process.env.CI`), the suite enables retries and an HTML report and does not reuse an
  existing dev server.
- Generated artifacts (`test-results/`, `playwright-report/`) are git-ignored.
