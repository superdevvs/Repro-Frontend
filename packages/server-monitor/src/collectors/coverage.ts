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
export async function logCoverage(
  last: Map<string, string>,
): Promise<Coverage[]> {
  const observedAt = new Date().toISOString(),
    sources: Coverage[] = [];
  for (const [id, [directory, pattern]] of Object.entries(groups)) {
    try {
      const files = (await readdir(directory))
        .filter((f) => pattern.test(f))
        .slice(-100);
      if (!files.length)
        throw new Error("No matching log file has been created");
      await Promise.all(
        files.map((file) => access(`${directory}/${file}`, constants.R_OK)),
      );
      sources.push({
        id: `log:${id}`,
        label: `${id} logs`,
        status: "healthy",
        observedAt,
        intervalMs: 60000,
        detail: `${files.length} readable files. ${last.has(id) ? `Last ingested ${last.get(id)}` : "No lines ingested in this gateway session; quiet sources are expected."}`,
      });
    } catch {
      if (last.has(id)) {
        sources.push({
          id: `log:${id}`,
          label: `${id} logs`,
          status: "healthy",
          observedAt,
          intervalMs: 60000,
          detail: `Collected by the operator-owned Alloy service; last ingested ${last.get(id)}`,
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
          "No readable matching file. Verify file creation and collection permissions.",
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
