import { createServer, connect, type Server } from "node:net";
import { chmod, lstat, unlink } from "node:fs/promises";
import { Counter, Histogram, Gauge, Registry } from "prom-client";
import { z } from "zod";
import type {
  Metric,
  Schedule,
  TelemetryEvent,
} from "@repro/monitor-contracts";
import type { Store } from "./store.js";
import { safeLabel } from "./privacy.js";
const eventSchema = z
  .object({
    version: z.literal(1),
    kind: z.enum([
      "request",
      "job",
      "schedule",
      "catalog",
      "integration",
      "heartbeat",
    ]),
    timestamp: z.string().datetime(),
    name: z.string().max(100).optional(),
    route: z.string().max(150).optional(),
    method: z.string().max(12).optional(),
    status: z.number().int().min(100).max(599).optional(),
    durationMs: z.number().min(0).max(86400000).nullable().optional(),
    outcome: z
      .enum(["started", "success", "failed", "skipped", "retry"])
      .optional(),
    queue: z.string().max(50).optional(),
    traceId: z
      .string()
      .regex(/^[a-zA-Z0-9-]{1,80}$/)
      .optional(),
    schedules: z
      .array(
        z
          .object({
            id: z.string().max(100),
            name: z.string().max(150),
            source: z.literal("laravel"),
            expression: z.string().max(100),
            timezone: z.string().max(100),
            nextRun: z.string().nullable(),
            lastRun: z.string().nullable(),
            outcome: z.literal("unknown"),
            durationMs: z.null(),
          })
          .strict(),
      )
      .max(100)
      .optional(),
  })
  .strict();
export async function removeStaleSocket(path: string) {
  try {
    const stat = await lstat(path);
    if (!stat.isSocket())
      throw new Error("Refusing to replace a non-socket path");
    await new Promise<void>((resolve, reject) => {
      const probe = connect(path);
      const timer = setTimeout(() => {
        probe.destroy();
        reject(new Error("Cannot establish whether socket is active"));
      }, 250);
      probe.once("connect", () => {
        clearTimeout(timer);
        probe.destroy();
        reject(new Error("Refusing to replace an active socket"));
      });
      probe.once("error", (error: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        probe.destroy();
        if (error.code === "ECONNREFUSED" || error.code === "ENOENT") resolve();
        else reject(error);
      });
    });
    const current = await lstat(path);
    if (current.ino !== stat.ino || current.dev !== stat.dev)
      throw new Error("Socket changed during startup");
    await unlink(path);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}
export class Telemetry {
  registry = new Registry();
  server?: Server;
  lastAt: string | null = null;
  heartbeatAt: string | null = null;
  catalogAt: string | null = null;
  private windows = new Map<
    number,
    { requests: number; errors: number; slow: number }
  >();
  recent: TelemetryEvent[] = [];
  labels = new Set<string>();
  requests = new Counter({
    name: "repro_requests_total",
    help: "Completed application requests",
    labelNames: ["route", "method", "status"],
    registers: [this.registry],
  });
  durations = new Histogram({
    name: "repro_request_duration_seconds",
    help: "Application response duration",
    labelNames: ["route"],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });
  jobs = new Counter({
    name: "repro_jobs_total",
    help: "Queue outcomes",
    labelNames: ["queue", "outcome"],
    registers: [this.registry],
  });
  jobDurations = new Histogram({
    name: "repro_job_duration_seconds",
    help: "Queue attempt durations",
    labelNames: ["queue", "outcome"],
    buckets: [0.1, 0.5, 1, 5, 15, 60, 300, 900],
    registers: [this.registry],
  });
  integrationDurations = new Histogram({
    name: "repro_integration_duration_seconds",
    help: "Outbound HTTP durations",
    labelNames: ["provider"],
    buckets: [0.05, 0.1, 0.5, 1, 5, 15, 60],
    registers: [this.registry],
  });
  integrations = new Counter({
    name: "repro_integrations_total",
    help: "Observed outbound HTTP outcomes",
    labelNames: ["provider", "status"],
    registers: [this.registry],
  });
  dropped = new Counter({
    name: "repro_telemetry_rejected_total",
    help: "Invalid or overloaded telemetry",
    registers: [this.registry],
  });
  host = new Gauge({
    name: "repro_observation",
    help: "Latest host and application observations",
    labelNames: ["key", "source", "unit"],
    registers: [this.registry],
  });
  constructor(public store: Store) {}
  accept(raw: unknown) {
    const p = eventSchema.safeParse(raw);
    if (!p.success) {
      this.dropped.inc();
      return false;
    }
    const e = p.data as TelemetryEvent;
    if (Math.abs(Date.now() - Date.parse(e.timestamp)) > 300000) {
      this.dropped.inc();
      return false;
    }
    this.lastAt = e.timestamp;
    this.recent.push(e);
    if (this.recent.length > 500) this.recent.shift();
    if (e.kind === "request") {
      const second = Math.floor(Date.now() / 1000),
        bin = this.windows.get(second) ?? { requests: 0, errors: 0, slow: 0 };
      bin.requests++;
      if ((e.status ?? 500) >= 500) bin.errors++;
      if ((e.durationMs ?? 0) > 1500) bin.slow++;
      this.windows.set(second, bin);
      for (const t of this.windows.keys())
        if (t < second - 300) this.windows.delete(t);
      let route = safeLabel(e.route ?? "unmatched");
      if (!this.labels.has(route) && this.labels.size >= 300) route = "other";
      this.labels.add(route);
      this.requests.inc({
        route,
        method: [
          "GET",
          "POST",
          "PUT",
          "PATCH",
          "DELETE",
          "OPTIONS",
          "HEAD",
        ].includes(e.method ?? "")
          ? e.method!
          : "OTHER",
        status: String(e.status ?? 500),
      });
      this.durations.observe({ route }, (e.durationMs ?? 0) / 1000);
    }
    if (e.kind === "job")
      this.jobs.inc({
        queue: safeLabel(e.queue ?? "default"),
        outcome: e.outcome ?? "unknown",
      });
    if (e.kind === "integration")
      this.integrations.inc({
        provider: safeLabel(e.name ?? "unknown"),
        status: String(e.status ?? 500),
      });
    if (e.kind === "job" && e.outcome !== "started" && e.durationMs != null)
      this.jobDurations.observe(
        {
          queue: safeLabel(e.queue ?? "default"),
          outcome: e.outcome ?? "unknown",
        },
        e.durationMs / 1000,
      );
    if (e.kind === "integration" && e.durationMs != null)
      this.integrationDurations.observe(
        { provider: safeLabel(e.name ?? "unknown") },
        e.durationMs / 1000,
      );
    if (e.kind === "heartbeat") this.heartbeatAt = e.timestamp;
    if (e.kind === "catalog" && e.schedules) {
      this.catalogAt = e.timestamp;
      const old = this.schedules();
      this.store.set(
        "schedules",
        e.schedules.map((s) => {
          const last = old.find((o) => o.id === s.id);
          return {
            ...s,
            missedSince:
              last?.missedSince ??
              (last?.nextRun &&
              Date.parse(last.nextRun) < Date.now() &&
              (!last.lastRun ||
                Date.parse(last.lastRun) < Date.parse(last.nextRun))
                ? last.nextRun
                : null),
            lastRun: last?.lastRun ?? null,
            outcome: last?.outcome ?? "unknown",
            durationMs: last?.durationMs ?? null,
          };
        }),
      );
    }
    if (e.kind === "schedule" && e.name) {
      const all = this.schedules();
      const s = all.find((s) => s.id === e.name);
      if (s) {
        s.lastRun = e.timestamp;
        s.missedSince = null;
        s.outcome =
          e.outcome === "started"
            ? "running"
            : e.outcome === "success"
              ? "success"
              : e.outcome === "skipped"
                ? "skipped"
                : "failed";
        s.durationMs = e.durationMs ?? null;
        this.store.set("schedules", all);
      }
    }
    return true;
  }
  async eventMetrics(): Promise<Metric[]> {
    const metrics: Metric[] = [];
    for (const [counter, source] of [
      [this.jobs, "jobs"],
      [this.integrations, "integrations"],
    ] as const) {
      const data = await counter.get();
      for (const item of data.values) {
        const labels = Object.values(item.labels ?? {})
          .map(String)
          .join(" · ");
        metrics.push({
          key: safeLabel(data.name + "_" + labels),
          label: labels + " · observed count since gateway start",
          value: item.value,
          unit: "count",
          source,
        });
      }
    }
    for (const [histogram, source] of [
      [this.jobDurations, "jobs"],
      [this.integrationDurations, "integrations"],
    ] as const) {
      const data = await histogram.get();
      for (const sum of data.values.filter((v) =>
        v.metricName?.endsWith("_sum"),
      )) {
        const count = data.values.find(
          (v) =>
            v.metricName?.endsWith("_count") &&
            JSON.stringify(v.labels) === JSON.stringify(sum.labels),
        );
        const labels = Object.values(sum.labels ?? {})
          .map(String)
          .join(" · ");
        metrics.push({
          key: safeLabel(data.name + "_" + labels),
          label: labels + " · mean observed duration since gateway start",
          value: count?.value ? (sum.value / count.value) * 1000 : null,
          unit: "ms",
          source,
        });
      }
    }
    return metrics;
  }
  latestMetrics(): Metric[] {
    const now = Math.floor(Date.now() / 1000);
    let minute = 0,
      requests = 0,
      errors = 0;
    for (const [t, b] of this.windows) {
      if (t >= now - 60) minute += b.requests;
      if (t >= now - 300) {
        requests += b.requests;
        errors += b.errors;
      }
    }
    return [
      {
        key: "requests_per_minute",
        label: "Requests in last minute",
        value: minute,
        unit: "count",
        source: "application",
      },
      {
        key: "requests_5m",
        label: "Requests in last 5 minutes",
        value: requests,
        unit: "count",
        source: "application",
      },
      {
        key: "error_percent",
        label: "Server errors in last 5 minutes",
        value: requests ? (100 * errors) / requests : null,
        unit: "%",
        source: "application",
      },
    ];
  }
  schedules(): Schedule[] {
    return this.store.get("schedules", []);
  }
  observe(metrics: Metric[]) {
    this.host.reset();
    for (const m of metrics)
      if (m.value !== null && Number.isFinite(m.value))
        this.host.set(
          { key: safeLabel(m.key), source: m.source, unit: m.unit },
          m.value,
        );
  }
  async listen(path: string) {
    await removeStaleSocket(path);
    this.server = createServer((socket) => {
      let input = "";
      const timer = setTimeout(() => socket.destroy(), 100);
      socket.on("data", (chunk) => {
        input += chunk.toString();
        if (input.length > 32768) {
          this.dropped.inc();
          socket.destroy();
          return;
        }
        const n = input.indexOf("\n");
        if (n >= 0) {
          try {
            this.accept(JSON.parse(input.slice(0, n)));
          } catch {
            this.dropped.inc();
          }
          socket.end();
        }
      });
      socket.on("error", () => {});
      socket.on("close", () => clearTimeout(timer));
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(path, resolve);
    });
    await chmod(path, 0o660);
  }
  close() {
    this.server?.close();
  }
}
