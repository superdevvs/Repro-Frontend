import { parentPort, workerData } from "node:worker_threads";
import Database from "better-sqlite3";
import type { Queue, Metric, Usage } from "@repro/monitor-contracts";
try {
  const db = new Database(workerData.path, {
    readonly: true,
    fileMustExist: true,
    timeout: 50,
  });
  db.pragma("query_only = ON");
  const tables = new Set(
    (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
        name: string;
      }[]
    ).map((r) => r.name),
  );
  const metrics: Metric[] = [],
    queues: Queue[] = [],
    usage: Usage[] = [];
  const missing: string[] = [];
  if (tables.has("jobs")) {
    const rows = db
      .prepare(
        "SELECT queue, SUM(reserved_at IS NULL) pending, SUM(reserved_at IS NOT NULL) running, MIN(CASE WHEN reserved_at IS NULL AND available_at <= ? THEN available_at END) oldest FROM jobs GROUP BY queue LIMIT 30",
      )
      .all(Math.floor(Date.now() / 1000)) as {
      queue: string;
      pending: number;
      running: number;
      oldest: number | null;
    }[];
    const failed = tables.has("failed_jobs")
      ? (db
          .prepare(
            "SELECT queue, COUNT(*) count FROM failed_jobs GROUP BY queue LIMIT 30",
          )
          .all() as { queue: string; count: number }[])
      : [];
    for (const name of new Set([
      ...rows.map((r) => r.queue),
      ...failed.map((r) => r.queue),
    ])) {
      const r = rows.find((r) => r.queue === name);
      queues.push({
        name,
        pending: r?.pending ?? 0,
        running: r?.running ?? 0,
        failed: failed.find((f) => f.queue === name)?.count ?? 0,
        oldestReadySeconds: r?.oldest
          ? Math.max(0, Date.now() / 1000 - r.oldest)
          : null,
      });
    }
  } else missing.push("jobs");
  for (const table of [
    "shoot_upload_attempts",
    "iguide_offline_upload_sessions",
    "ai_editing_jobs",
    "ai_video_generation_jobs",
    "ai_listing_video_jobs",
    "ai_reel_jobs",
    "automation_runs",
  ]) {
    if (!tables.has(table)) {
      missing.push(table);
      continue;
    }
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
    }[];
    if (!columns.some((c) => c.name === "status")) {
      missing.push(`${table}.status`);
      continue;
    }
    const rows = db
      .prepare(
        `SELECT status, COUNT(*) count FROM ${table} GROUP BY status LIMIT 25`,
      )
      .all() as { status: string; count: number }[];
    for (const r of rows)
      metrics.push({
        key: `${table}_${r.status}`,
        label: `${table.replaceAll("_", " ")} · ${r.status}`,
        value: r.count,
        unit: "count",
        source: "workflows",
      });
  }
  if (tables.has("system_overview_sessions")) {
    const cols = db
      .prepare("PRAGMA table_info(system_overview_sessions)")
      .all() as { name: string }[];
    if (cols.some((c) => c.name === "last_seen_at")) {
      const r = db
        .prepare(
          "SELECT COUNT(*) count FROM system_overview_sessions WHERE last_seen_at >= ?",
        )
        .get(
          new Date(Date.now() - 120000)
            .toISOString()
            .replace("T", " ")
            .slice(0, 19),
        ) as { count: number };
      metrics.push({
        key: "active_sessions",
        label: "Active application sessions",
        value: r.count,
        unit: "count",
        source: "application",
      });
    }
  }
  if (tables.has("voice_llm_usage")) {
    const r = db
      .prepare(
        "SELECT COUNT(*) requests, SUM(input_tokens) input, SUM(output_tokens) output, SUM(cost_usd) cost FROM voice_llm_usage WHERE created_at >= datetime('now','-1 day')",
      )
      .get() as Record<string, number | null>;
    usage.push({
      provider: "Voice LLM · last 24 hours",
      requests: r.requests,
      inputTokens: r.input,
      outputTokens: r.output,
      costUsd: r.cost,
      basis: "estimated",
      detail: "Application estimate; not provider billing",
    });
  }
  db.close();
  parentPort?.postMessage({ queues, metrics, usage, missing });
} catch (e) {
  parentPort?.postMessage({
    error: e instanceof Error ? e.message : "Database unavailable",
  });
}
