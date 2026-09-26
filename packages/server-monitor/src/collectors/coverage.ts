import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import type { Coverage } from "@repro/monitor-contracts";
const groups: Record<string, [string, RegExp]> = {
  laravel: ["/var/www/backend/storage/logs", /^laravel\.log$/],
  scheduler: ["/var/www/backend/storage/logs", /^scheduler\.log$/],
  worker: ["/var/www/backend/storage/logs", /^worker\.log$/],
  uploads: ["/var/www/backend/storage/logs", /^uploads-.*\.log$/],
  "auth-security": ["/var/www/backend/storage/logs", /^auth-security-.*\.log$/],
  "stripe-webhooks": [
    "/var/www/backend/storage/logs",
    /^stripe-webhooks-.*\.log$/,
  ],
  "nginx-access": ["/var/log/nginx", /^access\.log$/],
  "nginx-error": ["/var/log/nginx", /^error\.log$/],
  "php-fpm": ["/var/log", /^php8\.3-fpm\.log$/],
  studio: ["/home/maverick/.local/share/repro-studio/logs", /\.log$/],
};
export type AlloyLogFiles = { observedAt: number; sources: Map<string, number> };
export function alloyLogFiles(metrics: string, now = Date.now()): AlloyLogFiles {
  const sources = new Map<string, number>();
  const files = new Set<string>();
  for (const line of metrics.split("\n")) {
    if (!line.startsWith("loki_source_file_read_bytes_total{")) continue;
    const match = line.match(/\bpath=("(?:\\.|[^"\\])*")/);
    if (!match) continue;
    let path: string;
    try { path = JSON.parse(match[1]); } catch { continue; }
    if (files.has(path)) continue;
    files.add(path);
    for (const [id, [directory, pattern]] of Object.entries(groups)) {
      const name = path.slice(directory.length + 1);
      if (path.startsWith(directory + "/") && !name.includes("/") && pattern.test(name))
        sources.set(id, (sources.get(id) ?? 0) + 1);
    }
  }
  return { observedAt: now, sources };
}
async function readableFiles(directory: string, pattern: RegExp) {
  const files = (await readdir(directory)).filter((f) => pattern.test(f)).slice(-100);
  if (!files.length) throw new Error("No matching log file has been created");
  await Promise.all(files.map((file) => access(`${directory}/${file}`, constants.R_OK)));
  return files.length;
}
export async function logCoverage(
  last: Map<string, string>,
  alloy: AlloyLogFiles | null = null,
  probe = readableFiles,
  now = Date.now(),
): Promise<Coverage[]> {
  const observedAt = new Date(now).toISOString(),
    sources: Coverage[] = [];
  for (const [id, [directory, pattern]] of Object.entries(groups)) {
    try {
      const files = await probe(directory, pattern);
      sources.push({
        id: `log:${id}`,
        label: `${id} logs`,
        status: "healthy",
        observedAt,
        intervalMs: 60000,
        detail: `${files} readable files. ${last.has(id) ? `Last ingested ${last.get(id)}` : "No lines ingested in this gateway session; quiet sources are expected."}`,
      });
    } catch {
      const tracked = alloy && now >= alloy.observedAt && now - alloy.observedAt < 45000
        ? alloy.sources.get(id) : undefined;
      if (tracked) {
        sources.push({
          id: `log:${id}`,
          label: `${id} logs`,
          status: "healthy",
          observedAt,
          intervalMs: 60000,
          detail: `Alloy reports ${tracked} tracked files. ${last.has(id) ? `Last ingested ${last.get(id)}` : "No lines ingested in this gateway session; quiet sources are expected."}`,
        });
        continue;
      }
      sources.push({
        id: `log:${id}`,
        label: `${id} logs`,
        status: "unavailable",
        observedAt: null,
        intervalMs: 60000,
        detail:
          "Gateway cannot verify readable files and no fresh Alloy target evidence is available." +
          (last.has(id) ? ` Last ingested ${last.get(id)}; this does not establish current collection health.` : ""),
      });
    }
  }
  return sources;
}
export async function providerInventory(root: string): Promise<string[]> {
  const text = await readFile(`${root}/config/services.php`, "utf8");
  return [...text.matchAll(/^ {4}'([a-z0-9_]+)'\s*=>/gm)]
    .map((m) => m[1])
    .slice(0, 100);
}
