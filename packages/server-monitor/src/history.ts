import type { Series, LogEntry } from "@repro/monitor-contracts";
import { createHash } from "node:crypto";
import { redactText } from "./privacy.js";
export const logSources = [
  "laravel",
  "scheduler",
  "worker",
  "studio",
  "nginx-access",
  "nginx-error",
  "php-fpm",
  "system",
  "uploads",
  "auth-security",
  "stripe-webhooks",
  "monitor",
] as const;
export const chartKeys = [
  "cpu_percent",
  "memory_used",
  "memory_available_percent",
  "load_1",
  "disk_await_sda",
  "disk_util_sda",
  "network_rx_enp4s0",
  "active_sessions",
  "requests_per_second",
  "request_p95",
  "error_percent",
] as const;
export async function jsonFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const r = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(3000),
    redirect: "error",
  });
  if (!r.ok) throw new Error(`Upstream returned ${r.status}`);
  const text = await r.text();
  if (text.length > 4_000_000) throw new Error("Upstream response too large");
  return JSON.parse(text) as T;
}
export async function history(
  base: string,
  key: string,
  from: number,
  to: number,
): Promise<Series> {
  if (!chartKeys.includes(key as (typeof chartKeys)[number]))
    throw new Error("Unknown chart");
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from >= to ||
    to - from > 90 * 86400 ||
    to > Date.now() / 1000 + 60
  )
    throw new Error("Invalid history range");
  const fixed: Record<string, string> = {
    requests_per_second: "sum(rate(repro_requests_total[1m]))",
    request_p95:
      "histogram_quantile(0.95, sum by (le) (rate(repro_request_duration_seconds_bucket[5m])))",
    error_percent:
      '100 * sum(rate(repro_requests_total{status=~"5.."}[5m])) / clamp_min(sum(rate(repro_requests_total[5m])), 0.000001)',
  };
  const query = fixed[key] ?? `repro_observation{key="${key}"}`;
  const qs = new URLSearchParams({
    query,
    start: String(from),
    end: String(to),
    step: String(Math.max(5, Math.ceil((to - from) / 720))),
  });
  const r = await jsonFetch<{
    status: string;
    data: { result: { values: [number, string][] }[] };
  }>(`${base}/api/v1/query_range?${qs}`);
  if (r.status !== "success") throw new Error("Metrics query failed");
  return {
    key,
    points: (r.data.result[0]?.values ?? [])
      .filter((v) => Number.isFinite(Number(v[1])))
      .map((v) => [v[0] * 1000, Number(v[1])]),
  };
}
export async function logs(
  base: string,
  source: string,
  query: string,
  from: number,
  to: number,
): Promise<LogEntry[]> {
  if (
    source !== "all" &&
    !logSources.includes(source as (typeof logSources)[number])
  )
    throw new Error("Unknown log source");
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from >= to ||
    to - from > 14 * 86400 ||
    query.length > 120
  )
    throw new Error("Invalid log range");
  const selector =
    source === "all"
      ? '{app="repro"}'
      : `{app="repro", source=${JSON.stringify(source)}}`;
  const qs = new URLSearchParams({
    query: selector + (query ? ` |= ${JSON.stringify(query)}` : ""),
    start: String(Math.floor(from * 1e9)),
    end: String(Math.floor(to * 1e9)),
    limit: "250",
    direction: "backward",
  });
  const r = await jsonFetch<{
    data: {
      result: {
        stream: { source?: string; level?: string };
        values: [string, string][];
      }[];
    };
  }>(`${base}/loki/api/v1/query_range?${qs}`);
  return r.data.result
    .flatMap((s) =>
      s.values.map(([ts, msg]) => ({
        id: createHash("sha256")
          .update(ts + msg)
          .digest("hex")
          .slice(0, 20),
        timestamp: new Date(Number(BigInt(ts) / 1000000n)).toISOString(),
        source: s.stream.source ?? "unknown",
        level:
          s.stream.level ??
          (/error|exception|fatal/i.test(msg) ? "error" : "info"),
        message: redactText(msg),
      })),
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 250);
}
export function sanitizeLokiPush(body: unknown): {
  streams: {
    stream: { app: string; source: string };
    values: [string, string][];
  }[];
} {
  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as { streams: unknown }).streams)
  )
    throw new Error("Invalid log batch");
  const streams = (
    body as { streams: { stream: Record<string, string>; values: unknown[] }[] }
  ).streams;
  if (streams.length > 30) throw new Error("Too many streams");
  let count = 0;
  return {
    streams: streams.map((s) => {
      const source = s.stream?.source;
      if (!logSources.includes(source as (typeof logSources)[number]))
        throw new Error("Unknown log source");
      if (!Array.isArray(s.values)) throw new Error("Invalid log values");
      return {
        stream: { app: "repro", source },
        values: s.values.map((v) => {
          if (
            ++count > 2000 ||
            !Array.isArray(v) ||
            !/^\d{16,20}$/.test(String(v[0])) ||
            typeof v[1] !== "string"
          )
            throw new Error("Invalid log entry");
          return [String(v[0]), redactText(v[1]).slice(0, 16384)] as [
            string,
            string,
          ];
        }),
      };
    }),
  };
}
