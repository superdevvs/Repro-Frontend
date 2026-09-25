import { logCoverage, providerInventory } from "./collectors/coverage.js";
import { CronExpressionParser } from "cron-parser";
import { hostname } from "node:os";
import { readFile, statfs } from "node:fs/promises";
import type {
  Coverage,
  Metric,
  Schedule,
  Snapshot,
} from "@repro/monitor-contracts";
import type { Config } from "./config.js";
import {
  HostCollector,
  command,
  disks,
  processes,
  sensors,
  services,
} from "./collectors/host.js";
import { database } from "./collectors/database.js";
import { jsonFetch } from "./history.js";
import { redactText } from "./privacy.js";
import { Incidents } from "./incidents.js";
import type { Store } from "./store.js";
import type { Telemetry } from "./telemetry.js";
export class Collector {
  snapshot: Snapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    hostname: hostname(),
    metrics: [],
    sources: [],
    disks: [],
    services: [],
    schedules: [],
    queues: [],
    usage: [],
    incidents: [],
    markers: [],
  };
  private metrics = new Map<string, Metric[]>();
  private sources = new Map<string, Coverage>();
  private timers: NodeJS.Timeout[] = [];
  private busy = new Set<string>();
  private host = new HostCollector();
  private osSchedules: Schedule[] = [];
  private workers: Snapshot["services"] = [];
  private incidents: Incidents;
  listeners = new Set<(s: Snapshot) => void>();
  logReceivedAt: string | null = null;
  logSources = new Map<string, string>();
  ingestionAllowed = true;
  constructor(
    public cfg: Config,
    private store: Store,
    private telemetry: Telemetry,
  ) {
    this.incidents = new Incidents(store);
  }
  private source(
    id: string,
    label: string,
    intervalMs: number,
    status: Coverage["status"],
    detail?: string,
  ) {
    const old = this.sources.get(id);
    this.sources.set(id, {
      id,
      label,
      intervalMs,
      status,
      observedAt:
        status === "healthy"
          ? new Date().toISOString()
          : (old?.observedAt ?? null),
      detail,
    });
  }
  private async run(
    id: string,
    label: string,
    interval: number,
    fn: () => Promise<void>,
  ) {
    if (this.busy.has(id)) return;
    this.busy.add(id);
    try {
      await fn();
      this.source(id, label, interval, "healthy");
    } catch (e) {
      this.source(
        id,
        label,
        interval,
        "unavailable",
        redactText(e instanceof Error ? e.message : "Collector failed").slice(
          0,
          350,
        ),
      );
    } finally {
      this.busy.delete(id);
    }
  }
  private task(
    id: string,
    label: string,
    interval: number,
    fn: () => Promise<void>,
  ) {
    void this.run(id, label, interval, fn);
    this.timers.push(
      setInterval(() => void this.run(id, label, interval, fn), interval),
    );
  }
  start() {
    this.task("host", "Host resources", 5000, async () => {
      const r = await this.host.collect();
      this.metrics.set("host", r.metrics);
    });
    this.task("storage", "Mounted storage", 15000, async () => {
      this.snapshot.disks = await disks(this.cfg);
    });
    this.task("processes", "Process memory", 15000, async () => {
      this.metrics.set("processes", await processes());
    });
    this.task("services", "System services", 15000, async () => {
      this.snapshot.services = [...(await services()), ...this.workers];
    });
    this.task("database", "Read-only application database", 15000, async () => {
      const r = await database(this.cfg.database);
      this.snapshot.queues = r.queues;
      this.snapshot.usage = r.usage;
      this.metrics.set("database", r.metrics);
      this.source(
        "workflows",
        "Processing workflows",
        15000,
        r.missing.length ? "awaiting_instrumentation" : "healthy",
        r.missing.length
          ? `Not present in schema: ${r.missing.join(", ")}`
          : undefined,
      );
    });
    this.task("log-files", "Log file inventory", 60000, async () => {
      for (const source of await logCoverage(this.logSources))
        this.sources.set(source.id, source);
    });
    this.task("alloy", "Live log collector", 15000, async () => {
      const r = await fetch("http://127.0.0.1:12345/-/ready", {
        signal: AbortSignal.timeout(1500),
      });
      if (!r.ok) throw new Error("Alloy is not ready");
      const metrics = await fetch("http://127.0.0.1:12345/metrics", {
        signal: AbortSignal.timeout(1500),
      }).then((r) => {
        if (!r.ok) throw new Error("Alloy metrics unavailable");
        return r.text();
      });
      const sum = (name: string) =>
        [
          ...metrics.matchAll(
            new RegExp("^" + name + "(?:\\{[^\\n]*\\})? ([0-9.e+]+)$", "gm"),
          ),
        ].reduce((sum, m) => sum + Number(m[1]), 0);
      this.metrics.set("alloy", [
        {
          key: "log_dropped_entries",
          label: "Dropped log entries since Alloy start",
          value: sum("loki_write_dropped_entries_total"),
          unit: "count",
          source: "alloy",
        },
        {
          key: "log_retries",
          label: "Log forwarding retries since Alloy start",
          value: sum("loki_write_batch_retries_total"),
          unit: "count",
          source: "alloy",
        },
      ]);
    });
    this.task(
      "integrations",
      "Provider coverage inventory",
      300000,
      async () => {
        for (const provider of await providerInventory(this.cfg.backendRoot))
          this.source(
            `provider:${provider}`,
            provider,
            300000,
            "awaiting_instrumentation",
            "Declared integration. Laravel HTTP calls are counted; direct SDK calls and provider billing require dedicated instrumentation.",
          );
      },
    );
    this.task("sensors", "Hardware sensor collection", 300000, async () => {
      const r = await sensors();
      this.metrics.set("sensors", r.metrics);
      for (const s of r.sources) this.sources.set(s.id, s);
    });
    this.task("inventory", "Protected inventory", 60000, async () => {
      const r = JSON.parse(
        await readFile("/run/repro-monitor-inventory/inventory.json", "utf8"),
      ) as {
        observedAt: string;
        schedules: Schedule[];
        services: Snapshot["services"];
        sources: Coverage[];
        metrics?: Metric[];
        configurationFingerprint?: string;
      };
      if (Date.now() - Date.parse(r.observedAt) > 180000)
        throw new Error("Protected inventory stale");
      if (r.metrics) this.metrics.set("protected", r.metrics);
      if (
        r.configurationFingerprint &&
        r.configurationFingerprint !==
          this.store.get("configuration-fingerprint", "")
      ) {
        const value = r.configurationFingerprint,
          id = "config:" + value;
        this.store.db
          .prepare("INSERT OR IGNORE INTO markers VALUES (?,?,?)")
          .run(
            id,
            Date.now(),
            JSON.stringify({
              id,
              label: "Observed configuration fingerprint",
              timestamp: r.observedAt,
              detail: value,
            }),
          );
        this.store.set("configuration-fingerprint", value);
      }

      this.osSchedules = r.schedules.map((s) => {
        if (s.source === "systemd" || s.expression === "@reboot") return s;
        try {
          return {
            ...s,
            nextRun: CronExpressionParser.parse(s.expression, {
              tz:
                s.timezone === "system local time"
                  ? Intl.DateTimeFormat().resolvedOptions().timeZone
                  : s.timezone,
            })
              .next()
              .toISOString(),
          };
        } catch {
          return s;
        }
      });
      for (const s of r.sources) this.sources.set(s.id, s);
      this.workers = r.services;
      this.snapshot.services = [
        ...this.snapshot.services.filter((s) => !s.id.startsWith("worker:")),
        ...this.workers,
      ];
    });
    this.task("smart", "Disk health", 300000, async () => {
      const r = JSON.parse(
        await readFile("/run/repro-monitor-inventory/smart.json", "utf8"),
      ) as { observedAt: string; metrics: Metric[]; sources: Coverage[] };
      if (Date.now() - Date.parse(r.observedAt) > 900000)
        throw new Error("Disk health inventory stale");
      this.metrics.set("smart", r.metrics);
      for (const s of r.sources) this.sources.set(s.id, s);
    });
    this.task("prometheus", "Metrics history", 15000, async () => {
      const r = await fetch(`${this.cfg.prometheusUrl}/-/ready`, {
        signal: AbortSignal.timeout(1500),
      });
      if (!r.ok) throw new Error(`Metrics storage returned ${r.status}`);
    });
    this.task("loki", "Log history", 15000, async () => {
      const r = await fetch(`${this.cfg.lokiUrl}/ready`, {
        signal: AbortSignal.timeout(1500),
      });
      if (!r.ok) throw new Error(`Log storage returned ${r.status}`);
    });
    this.task("fpm", "PHP-FPM pool", 15000, async () => {
      const r = await jsonFetch<{
        active_processes?: number;
        "active processes": number;
        "total processes": number;
        "listen queue": number;
      }>("http://127.0.0.1:9471/fpm-status?json");
      this.metrics.set("fpm", [
        {
          key: "fpm_active",
          label: "PHP-FPM active workers",
          value: r["active processes"],
          unit: "count",
          source: "fpm",
        },
        {
          key: "fpm_total",
          label: "PHP-FPM workers",
          value: r["total processes"],
          unit: "count",
          source: "fpm",
        },
        {
          key: "fpm_listen_queue",
          label: "PHP-FPM waiting requests",
          value: r["listen queue"],
          unit: "count",
          source: "fpm",
        },
      ]);
    });
    this.task("deployments", "Deployment history", 60000, async () => {
      const d = JSON.parse(
        await readFile(
          `${this.cfg.backendRoot}/storage/app/deploy-meta.json`,
          "utf8",
        ),
      ) as { commit: string; deployed_at: string };
      const id = `backend:${d.commit}`;
      const marker = {
        id,
        label: "Backend deployment",
        timestamp: d.deployed_at,
        detail: d.commit,
      };
      if (/^[a-f0-9]{40}$/.test(d.commit)) {
        this.store.db
          .prepare("INSERT OR IGNORE INTO markers VALUES (?,?,?)")
          .run(id, Date.parse(d.deployed_at), JSON.stringify(marker));
      }
      this.snapshot.markers = (
        this.store.db
          .prepare("SELECT value FROM markers ORDER BY created DESC LIMIT 50")
          .all() as { value: string }[]
      ).map((r) => JSON.parse(r.value));
    });
    this.task("nginx", "Nginx connections", 15000, async () => {
      const response = await fetch("http://127.0.0.1:9471/nginx-status", {
        signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) throw new Error("Nginx status unavailable");
      const value = await response.text();
      const active = value.match(/Active connections: (\d+)/);
      if (!active) throw new Error("Nginx status invalid");
      this.metrics.set("nginx", [
        {
          key: "nginx_connections",
          label: "Active Nginx connections",
          value: Number(active[1]),
          unit: "count",
          source: "nginx",
        },
      ]);
    });
    this.task(
      "monitor-storage",
      "Monitoring storage protection",
      60000,
      async () => {
        const s = await statfs(this.cfg.dataDir);
        const used = Number(
          (
            await command(
              "/usr/bin/du",
              ["-s", "--block-size=1", this.cfg.dataDir],
              3000,
            )
          ).split(/\s+/)[0],
        );
        this.ingestionAllowed =
          used < this.cfg.storageBudgetBytes * 0.9 &&
          s.bavail * s.bsize >
            Math.max(2 * 1024 ** 3, s.blocks * s.bsize * 0.05);
        if (!this.ingestionAllowed)
          throw new Error("Low filesystem space: new log ingestion paused");
        this.store.prune();
      },
    );
    this.sources.set("provider-billing", {
      id: "provider-billing",
      label: "External provider billing and quotas",
      status: "awaiting_instrumentation",
      observedAt: null,
      intervalMs: 300000,
      detail:
        "Application estimates are shown separately. Connect provider billing access before reporting billed totals.",
    });
    this.sources.set("backups", {
      id: "backups",
      label: "Backup completion and restore verification",
      status: "awaiting_instrumentation",
      observedAt: null,
      intervalMs: 300000,
      detail:
        "No authoritative backup completion manifest configured; file dates do not establish a verified backup.",
    });
    this.timers.push(setInterval(() => this.publish(), 5000));
    this.publish();
  }
  publish() {
    const now = Date.now();
    const last = this.telemetry.lastAt;
    this.source(
      "application",
      "Application event transport",
      60000,
      last ? "healthy" : "awaiting_instrumentation",
      last
        ? "Freshness uses request events and the once-per-minute scheduler heartbeat. Quiet request traffic is not a failure."
        : undefined,
    );
    const app = this.sources.get("application")!;
    app.observedAt = last;
    if (last && now - Date.parse(last) > 180000) app.status = "stale";
    this.source(
      "schedules",
      "Laravel scheduler heartbeat",
      60000,
      this.telemetry.heartbeatAt ? "healthy" : "awaiting_instrumentation",
    );
    const cron = this.sources.get("schedules")!;
    cron.observedAt = this.telemetry.heartbeatAt;
    if (cron.observedAt && now - Date.parse(cron.observedAt) > 180000)
      cron.status = "stale";
    this.source(
      "schedule-catalog",
      "Active Laravel schedule inventory",
      60000,
      this.telemetry.catalogAt ? "healthy" : "awaiting_instrumentation",
    );
    const catalog = this.sources.get("schedule-catalog")!;
    catalog.observedAt = this.telemetry.catalogAt;
    if (catalog.observedAt && now - Date.parse(catalog.observedAt) > 180000)
      catalog.status = "stale";
    this.snapshot.generatedAt = new Date(now).toISOString();
    this.snapshot.sources = [...this.sources.values()].map((s) =>
      s.status === "healthy" &&
      s.observedAt &&
      now - Date.parse(s.observedAt) > s.intervalMs * 3
        ? { ...s, status: "stale" as const }
        : s,
    );
    this.snapshot.metrics = [...this.metrics.values()].flat();
    if (this.telemetry.lastAt)
      this.snapshot.metrics.push(...this.telemetry.latestMetrics());
    this.snapshot.schedules = [
      ...this.telemetry.schedules(),
      ...this.osSchedules,
    ];
    this.telemetry.observe(this.snapshot.metrics);
    try {
      this.incidents.evaluate(this.snapshot);
      this.snapshot.incidents = this.store.incidents();
      this.source(
        "monitor-history",
        "Incident history writes",
        5000,
        "healthy",
      );
    } catch {
      this.source(
        "monitor-history",
        "Incident history writes",
        5000,
        "unavailable",
        "Monitoring SQLite is locked or unavailable; host collection continues.",
      );
    }
    this.snapshot.sources = [
      ...this.snapshot.sources.filter((s) => s.id !== "monitor-history"),
      this.sources.get("monitor-history")!,
    ];
    for (const listener of this.listeners) listener(this.snapshot);
  }
  stop() {
    for (const t of this.timers) clearInterval(t);
    this.listeners.clear();
  }
}
