# AI Studio V4

V4 replaces the `/ai-editing` page with a responsive, persisted editing workspace. The existing dashboard top navigation, Robbie strip, theme, sidebar and mobile bottom navigation remain in use. Discovery pages scroll normally; editor canvases, settings and filmstrips fit the dashboard viewport with their own scrolling regions.

## Use it

Open `/ai-editing`, choose a shoot or upload photos, choose a preset, and continue to its editor. The composer places the small image stack immediately to the right of the address. Presets and history have their own searchable views. Staff can also expand Previous edits to retrieve outputs from the earlier system.

Shoot Overview includes photo and video preset entry points. These authorize and load the selected shoot into Studio without starting a paid generation. A workspace draft is created when the user continues; generation is a separate explicit action.

Photo editing supports individual selections, multiple shoots, full-shoot enhancement, adjustments, before/after comparison, version review, suggested-area feedback, drawing, revision, download and sharing. Presets include listing ready, color correction, twilight, green grass and virtual staging.

Video creation includes walkthrough, property reel and social teaser presets. Choose the duration, aspect ratio, ordered photos and framing method. AI Extend creates missing edges; Crop and Fit render actual prepared images. Review each prepared frame, optionally add transitions and text, then generate the video. No transition effect or text is applied by default. Saved workspaces retain source associations, configuration, preparation, output versions, job status and errors.

Unchanged original motion clips are reused across versions. Changing only text, transitions or total duration performs composition without new motion generation. Editing a walkthrough frame regenerates its own clip and the previous clip that ends at that frame. Downloads retrieve the exact selected version through an authenticated attachment endpoint.

## Runtime

The backend uses the existing server-side fal and OpenAI configuration. A dedicated `studio` database queue performs provider work and FFmpeg composition. The previous queue configuration remains separate.

Local preview: `http://127.0.0.1:5173/ai-editing` using the existing app login. The API is at `http://127.0.0.1:8000`.

From `backend/`, start the local SQLite API and worker:

```powershell
docker compose -f docker/compose.studio-local.yml up --build -d
docker exec codex-v4-api php scripts/studio-runtime-check.php
```

The local migration was applied with a backup under `backend/storage/app/studio-smoke/`. On a fresh local checkout, run `docker exec codex-v4-api php scripts/studio-migrate-local.php` before using workspaces. This guarded script refuses remote databases. Configuration, SQLite and media stay in the workspace. PHP code and dependencies run inside the image for faster Windows startup; rerun the Compose build command after PHP changes. Public storage is mounted explicitly so Windows junctions work inside the Linux container.

From `frontend/`, start Vite:

```powershell
npm run dev -- --host 127.0.0.1
```

Stop these local services with `docker compose -f docker/compose.studio-local.yml down` from `backend/`, and stop the Vite terminal. Production deployment and a supervised worker must be configured separately; no remote deployment or database migration was performed.

## Verification

- Production frontend build, TypeScript, changed-scope ESLint, file-size and bundle-size checks passed.
- 129 focused frontend tests passed, including editor state, version delivery/download, source scope, Overview links, long drawing gestures and legacy output access.
- Nine isolated Playwright flows passed on desktop and mobile with authenticated image previews, real attachment bytes and strict draft version checks. Screenshot checks cover both dashboard themes.
- Backend regression and permission checks passed; see `backend/docs/studio-workspaces-v4-verification.md` for exact suites.
- Live provider checks produced a photo edit, AI image extension, OpenAI detections and a five-second Kling start/end-conditioned clip. FFmpeg rendered actual video with transitions and graphic text at the requested dimensions and duration.
- API health, unauthenticated API rejection and public output delivery through the local Vite proxy were verified. Browser workflow tests use isolated HTTP fixtures; live provider checks are separate.

## Current boundaries

Full-shoot RAW processing enhances embedded full-size previews; it does not merge HDR brackets or provide native RAW development. Suggested objects are approximate boxes; drawing feedback constrains a bounding rectangle rather than a pixel mask. Start/end-conditioned walkthrough clips encourage continuity but do not guarantee a physically accurate camera path. Video presets currently create video from photos, rather than editing uploaded video clips.

Sharing uses the actual selected output URLs. It does not automatically mark the shoot delivered or send messages to clients. Plan-based feature limits are not introduced by this change.
