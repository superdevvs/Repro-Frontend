import { randomUUID } from "node:crypto";
import type { Snapshot, Severity } from "@repro/monitor-contracts";
import type { Store } from "./store.js";
export class Incidents {
  private since = new Map<string, number>();
  constructor(private store: Store) {}
  evaluate(snapshot: Snapshot, now = Date.now()) {
    const active = new Set<string>();
    const settings = this.store.settings();
    const previous = this.store.incidents();
    const flag = (
      key: string,
      title: string,
      severity: Severity,
      source: string,
      evidence: string[],
      delay = 0,
    ) => {
      active.add(key);
      const since = this.since.get(key) ?? now;
      this.since.set(key, since);
      if (now - since < delay) return;
      const old = previous.find((i) => i.fingerprint === key);
      if (old && old.state !== "resolved" && old.severity === severity) return;
      const time = new Date(now).toISOString();
      this.store.saveIncident({
        id: old?.id ?? randomUUID(),
        fingerprint: key,
        title,
        severity,
        source,
        evidence,
        state: "open",
        openedAt: old && old.state !== "resolved" ? old.openedAt : time,
        updatedAt: time,
        resolvedAt: null,
        snoozedUntil: null,
      });
    };
    for (const d of snapshot.disks) {
      if (d.expected && !d.valid)
        flag(
          `mount:${d.mount}`,
          `Storage mount invalid: ${d.mount}`,
          "critical",
          "storage",
          [d.mount, d.device],
        );
      if (d.bytes && d.valid) {
        const free = (d.free / d.bytes) * 100;
        if (free < settings.thresholds.diskFreeWarning)
          flag(
            `disk:${d.mount}`,
            `Low free space: ${d.mount}`,
            free < settings.thresholds.diskFreeCritical
              ? "critical"
              : "warning",
            "storage",
            [`${free.toFixed(1)}% free`],
          );
      }
    }
    for (const s of snapshot.services) {
      if (
        [
          "nginx.service",
          "php8.3-fpm.service",
          "supervisor.service",
          "cron.service",
          "repro-prometheus.service",
          "repro-loki.service",
          "repro-alloy.service",
        ].includes(s.id) &&
        s.state !== "active"
      )
        flag(
          `service:${s.id}`,
          `${s.name} is ${s.state}`,
          "critical",
          "services",
          [s.id, s.state],
          15000,
        );
    }
    for (const q of snapshot.queues) {
      if (
        q.oldestReadySeconds !== null &&
        q.oldestReadySeconds > settings.thresholds.queueWarningSeconds
      )
        flag(
          `queue:${q.name}`,
          `Queue delayed: ${q.name}`,
          q.oldestReadySeconds > settings.thresholds.queueCriticalSeconds
            ? "critical"
            : "warning",
          "queues",
          [`${Math.round(q.oldestReadySeconds)} seconds ready`],
        );
    }
    for (const s of snapshot.sources) {
      if (s.status === "stale")
        flag(
          `stale:${s.id}`,
          `Stale telemetry: ${s.label}`,
          "warning",
          s.id,
          [s.observedAt ?? "Never observed"],
          15000,
        );
    }
    const metric = (key: string) =>
      snapshot.metrics.find((m) => m.key === key)?.value;
    const cpu = metric("cpu_percent");
    if (cpu != null && cpu > settings.thresholds.cpuWarningPercent)
      flag(
        "cpu",
        "Sustained high CPU usage",
        "warning",
        "host",
        [`${cpu.toFixed(1)}%`],
        300000,
      );
    const memory = metric("memory_available_percent");
    if (
      memory != null &&
      memory < settings.thresholds.memoryAvailableWarningPercent
    )
      flag(
        "memory",
        "Low available memory",
        "warning",
        "host",
        [`${memory.toFixed(1)}% available`],
        300000,
      );
    const errors = metric("error_percent"),
      requests = metric("requests_5m");
    if (errors != null && requests != null && requests >= 20 && errors > 2)
      flag(
        "application-errors",
        "Elevated server error rate",
        "warning",
        "application",
        [`${errors.toFixed(1)}% errors across ${requests} requests`],
        60000,
      );
    const fpm = metric("fpm_active"),
      fpmTotal = metric("fpm_total");
    if (fpm != null && fpmTotal && fpm / fpmTotal > 0.8)
      flag(
        "fpm-saturation",
        "PHP-FPM pool saturated",
        "warning",
        "fpm",
        [`${fpm} of ${fpmTotal} workers active`],
        120000,
      );
    for (const s of snapshot.services)
      if (s.id.startsWith("worker:") && s.state !== "running")
        flag(
          `worker:${s.id}`,
          `Worker ${s.name} is ${s.state}`,
          "critical",
          "inventory",
          [s.id, s.state],
          15000,
        );
    for (const s of snapshot.schedules)
      if (s.missedSince && now - Date.parse(s.missedSince) > 180000)
        flag(
          `missed:${s.id}`,
          `Scheduled start missed: ${s.name}`,
          "warning",
          "schedules",
          [s.id, `Expected since ${s.missedSince}; no start or skip observed`],
        );
    for (const s of snapshot.schedules)
      if (s.outcome === "failed")
        flag(
          `schedule:${s.id}`,
          `Scheduled task failed: ${s.name}`,
          "warning",
          "schedules",
          [s.id, s.lastRun ?? "Unknown execution time"],
        );
    for (const old of previous) {
      if (old.state === "resolved" || active.has(old.fingerprint)) continue;
      // A failed collector cannot establish recovery of its monitored objects.
      const source = snapshot.sources.find((s) => s.id === old.source);
      if (source && source.status !== "healthy") continue;
      if (old.fingerprint.startsWith("schedule:")) {
        const task = snapshot.schedules.find(
          (s) => `schedule:${s.id}` === old.fingerprint,
        );
        if (!task || task.outcome !== "success") continue;
      }
      old.state = "resolved";
      old.resolvedAt = new Date(now).toISOString();
      old.updatedAt = old.resolvedAt;
      this.store.saveIncident(old);
    }
    for (const key of this.since.keys())
      if (!active.has(key)) this.since.delete(key);
  }
}
