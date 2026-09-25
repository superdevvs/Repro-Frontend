# RePro Server Monitor

Independent, read-only monitoring for this Ubuntu host. The Electron desktop and the superadmin Settings → Overview → Server page share the version 1 contract, incident history, metrics, logs and owner-scoped AI conversations. The existing Application overview remains available.

## Workspaces and checks

Use the repository's Node version (`.nvmrc`, currently 24.13.0).

- `npm run monitor:test`: build contracts/gateway and run unit and HTTP integration tests.
- `npm run desktop:check`: test the IPC/notification policy, build the renderer, validate Electron entrypoints and build the Debian package.
- `npm run quality`: existing frontend gates plus both monitoring gates.

The gateway exposes only fixed metric/log queries and versioned monitoring resources. `/health`, `/metrics` and authenticated ingestion listen on loopback; public Nginx routing exposes only `/v1/`. PHP issues a 60-second ticket tied to an existing Sanctum token. Every HTTP request revalidates it with Laravel; streams revalidate every 10 seconds and expire. Role changes, impersonation and original-token revocation fail closed. The operator uses a permission-protected Unix socket and token and continues reading host health when Laravel is unavailable.

## Collection and privacy

Host observations run every 5 seconds, application/database/service collection every 15 seconds, protected inventory every 60 seconds, and SMART/provider inventory every 5 minutes. Application instrumentation uses bounded nonblocking Unix-socket writes and cannot fail requests/jobs. Full counters and histograms supply request charts; recent traces are separately bounded. A start is never recorded as a successful cron completion; missing exit status/duration remains unknown.

Prometheus retains up to 90 days with a 5 GB size ceiling. Loki indexes sanitized logs for 14 days. Alloy retains file positions, handles rotation/multiline input, and forwards Snappy protobuf batches to the redaction gateway. Its raw log WAL is disabled. This intentionally prefers bounded loss during a prolonged gateway outage over persisting unredacted logs. The interface exposes missing collectors and file permissions. Redaction is applied before Loki persistence and AI submission, including structured personal fields, credentials, headers, signed query values and SQL bindings. Only metadata/aggregate queries touch application SQLite, in a separate worker with a 1-second deadline; the connection is read-only.

The 20 GiB NVMe budget has low-space ingestion protection at 90% and filesystem headroom checks. The systemd slice caps aggregate monitoring memory at 2 GiB and CPU at one logical core. These caps do not replace the required 24-hour measurement. Missing NVIDIA readings, unsupported SMART bridges, absent provider billing, uninstrumented direct SDK calls and unverifiable backup completion are visible as unavailable or awaiting instrumentation. Observed backup file age is not a successful restore assertion.

## AI

The separate broker uses the operator's existing Codex authentication through a read-only bind inside Bubblewrap. It creates a private Codex home, ephemeral monitoring sessions and an empty read-only workspace. It disables tools, apps, plugins, hooks, skills/connectors, browsers and model network access; it checks the installed App Server configuration and sandbox before use. General command/file tools are never available to the adviser. Provider messages requesting tools/approval are denied. Only sanitized evidence is supplied. Original coding sessions/configuration are untouched.

The Grok CLI adapter uses official ACP and an isolated account home, disabled tools and a read-only sandbox; it remains unavailable until the official executable and owner login are present and protocol checks pass. OpenAI/xAI API connections are owner-scoped and encrypted. Other superadmins cannot use the operator's CLI account unless that operator explicitly pairs their own account via a short-lived dashboard ticket. There is no provider fallback.

Automatic analysis starts disabled. Once installation and isolation/incident tests pass, the operator can enable it. Incidents group for 60 seconds, repeated analyses suppress for 15 minutes unless severity changes, and daily summaries run at 09:00 America/New_York. Only one analysis runs at once. The shared $100 monthly paid-API budget reserves conservatively before dispatch, including concurrent processes; manual and automatic accounting remain separate. Reported provider costs and price-based estimates remain distinct. Uncertain charged failures retain their reservation estimate. Paid models require explicitly verified current model pricing; subscription quotas are separate.

## Guarded rollout

1. Start from current upstream; run backend Composer quality and frontend quality. Publish reviewed candidates and require successful GitHub quality for both exact commits.
2. Use `deploy/build-release.py` with those CI records to build the ordinary-user release. No root npm installation or download is performed.
3. Run the generated `install-monitor.py preflight --bundle … --sha256 …`. Stop any isolated preview using the same ports.
4. With root access, run `collect` using the same arguments. This installs collection, the operator broker, the desktop package and operator autostart. It leaves application instrumentation and automatic AI disabled. It does not edit storage, existing cron schedules or application source.
5. Deploy both application candidates through the backend's existing `scripts/deploy/Deploy-App.ps1 -PreparedRelease` workflow, including its main CI and public-storage verification. Do not substitute an ad hoc application copy. Its configured `repro-deploy` SSH access is required.
6. Run `sudo python3 install-monitor.py activate`. It requires both live deployment markers to match the bundle, backs up the exact configuration files, validates Nginx/PHP-FPM before reload, enables instrumentation, refreshes worker configuration and checks health/storage invariants. A failure restores the prior configuration.
7. Verify authenticated dashboard access, operator access, stream revocation, current scheduler inventory, log ingestion, actual request/job events and source coverage. Complete the 24-hour passive observation and investigate latency/resource regressions before acceptance. Then enable automatic Codex analysis.

`rollback` disables monitoring, removes only its operator autostart entry and restores activation configuration when file hashes still match. It refuses to overwrite intervening configuration changes. Monitoring history, media tiering, source copies and business schedules are retained. Application source rollback, if needed, uses the existing guarded workflow.

Complete power/host failure cannot produce a local notification. No external monitoring, email/Slack notifications or automatic remediation is part of this release.
