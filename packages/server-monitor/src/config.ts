import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
const loopback = z
  .string()
  .url()
  .refine(
    (v) => ["127.0.0.1", "[::1]", "localhost"].includes(new URL(v).hostname),
    "Local service URLs must use loopback",
  );
export const configSchema = z
  .object({
    dataDir: z.string().default("/var/lib/repro-monitor"),
    socket: z.string().default("/run/repro-monitor/operator.sock"),
    eventsSocket: z.string().default("/run/repro-monitor/events.sock"),
    host: z.literal("127.0.0.1").default("127.0.0.1"),
    port: z.number().int().min(1024).max(65535).default(9470),
    backendRoot: z.string().default("/var/www/backend"),
    database: z.string().default("/var/www/backend/database/database.sqlite"),
    origins: z
      .array(z.string().url())
      .default([
        "https://reprodashboard.com",
        "https://www.reprodashboard.com",
      ]),
    authorizationUrl: z
      .string()
      .url()
      .default(
        "https://reprodashboard.com/api/admin/system-overview/server/validate",
      ),
    ingestTokenFile: z.string().default("/etc/repro-monitor/ingest.token"),
    signingKeyFile: z.string().default("/etc/repro-monitor/auth.key"),
    operatorTokenFile: z.string().default("/etc/repro-monitor/operator.token"),
    prometheusUrl: loopback.default("http://127.0.0.1:9095"),
    lokiUrl: loopback.default("http://127.0.0.1:3105"),
    brokerSocket: z.string().default("/run/user/1000/repro-monitor-ai.sock"),
    brokerTokenFile: z.string().default("/etc/repro-monitor/broker.token"),
    aiOwnerUserId: z.string().nullable().default(null),
    expectedMediaUuid: z
      .string()
      .default("1b8e7274-0954-4ea6-a64e-360dfcaa73a7"),
    storageBudgetBytes: z
      .number()
      .positive()
      .default(20 * 1024 ** 3),
    production: z.boolean().default(true),
  })
  .strict();
export type Config = z.infer<typeof configSchema>;
export function loadConfig(path = process.env.REPRO_MONITOR_CONFIG): Config {
  if (!path)
    throw new Error(
      "REPRO_MONITOR_CONFIG must point to a reviewed configuration file",
    );
  const cfg = configSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  for (const p of [cfg.dataDir, cfg.socket, cfg.eventsSocket, cfg.database])
    if (resolve(p) !== p) throw new Error("Paths must be absolute");
  return cfg;
}
