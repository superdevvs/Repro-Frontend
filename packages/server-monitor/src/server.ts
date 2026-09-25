import Fastify, { type FastifyRequest } from "fastify";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { chmod } from "node:fs/promises";
import type { Principal, ProviderId } from "@repro/monitor-contracts";
import type { Config } from "./config.js";
import type { Collector } from "./collector.js";
import type { Store } from "./store.js";
import type { Telemetry } from "./telemetry.js";
import type { AiService } from "./ai/service.js";
import { decodeLokiPush } from "./loki-protocol.js";
import { Auth, equalSecret } from "./auth.js";
import { history, logs, sanitizeLokiPush } from "./history.js";
import { redactText } from "./privacy.js";
import { removeStaleSocket } from "./telemetry.js";
const provider = z.enum(["codex", "openai", "grok", "grok-cli"]);
const settingsSchema = z
  .object({
    automaticAi: z.boolean(),
    defaultProvider: provider,
    dailySummaryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
    monthlyBudgetUsd: z.number().min(0).max(100),
    thresholds: z
      .object({
        diskFreeWarning: z.number().min(1).max(90),
        diskFreeCritical: z.number().min(1).max(90),
        queueWarningSeconds: z.number().min(10).max(3600),
        queueCriticalSeconds: z.number().min(10).max(86400),
        cpuWarningPercent: z.number().min(20).max(100),
        memoryAvailableWarningPercent: z.number().min(1).max(50),
      })
      .strict(),
  })
  .strict()
  .refine(
    (s) =>
      s.thresholds.diskFreeCritical < s.thresholds.diskFreeWarning &&
      s.thresholds.queueCriticalSeconds > s.thresholds.queueWarningSeconds,
  );
export interface Dependencies {
  cfg: Config;
  store: Store;
  collector: Collector;
  telemetry: Telemetry;
  ai: AiService;
  auth?: Auth;
}
export function createServer(d: Dependencies, operator = false) {
  const { cfg, store, collector, telemetry, ai } = d;
  const auth = d.auth ?? new Auth(cfg);
  const app = Fastify({
    logger: false,
    bodyLimit: 1_000_000,
    requestTimeout: 15000,
  });
  const principals = new WeakMap<FastifyRequest, Principal>();
  const attempts = new Map<string, { start: number; count: number }>();
  let streams = 0;
  app.addContentTypeParser(
    "application/x-protobuf",
    { parseAs: "buffer" },
    (_req, body, done) => {
      try {
        done(null, decodeLokiPush(body as Buffer));
      } catch {
        done(
          Object.assign(new Error("Invalid protobuf log batch"), {
            statusCode: 400,
          }),
        );
      }
    },
  );
  app.setErrorHandler((err, _req, reply) => {
    const code =
      err instanceof z.ZodError
        ? 400
        : ((err as { statusCode?: number }).statusCode ?? 500);
    reply.code(code).send({
      error:
        code === 400
          ? "Invalid request"
          : redactText(err instanceof Error ? err.message : "Request failed"),
    });
  });
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff");
    if (
      !operator &&
      ["/health", "/metrics", "/ingest/logs"].includes(req.url.split("?")[0])
    )
      return;
    if (req.headers["x-impersonate-user-id"] !== undefined)
      return reply
        .code(403)
        .send({ error: "Impersonation cannot access server monitoring" });
    const token = String(req.headers.authorization ?? "").replace(
      /^Bearer /,
      "",
    );
    try {
      const p = await auth.authorize(token, operator, req.headers.origin);
      p.aiOwner =
        p.aiOwner ||
        p.id === store.get<string | null>("ai-owner-user-id", null);
      principals.set(req, p);
      const now = Date.now(),
        old = attempts.get(p.id),
        record =
          old && now - old.start < 60000 ? old : { start: now, count: 0 };
      if (++record.count > 240)
        return reply.code(429).send({ error: "Request limit reached" });
      attempts.set(p.id, record);
      if (attempts.size > 1000)
        for (const [k, v] of attempts)
          if (now - v.start > 60000) attempts.delete(k);
    } catch {
      return reply
        .code(401)
        .send({ error: "Monitor access expired or denied" });
    }
  });
  if (!operator) {
    app.get("/health", async () => ({ status: "ok", version: 1 }));
    app.get("/metrics", async (_req, reply) =>
      reply
        .header("Content-Type", telemetry.registry.contentType)
        .send(await telemetry.registry.metrics()),
    );
    app.post("/ingest/logs", async (req, reply) => {
      const token = readFileSync(cfg.ingestTokenFile, "utf8").trim();
      if (
        req.headers.origin ||
        !equalSecret(
          String(req.headers.authorization ?? "").replace(/^Bearer /, ""),
          token,
        )
      )
        return reply.code(401).send({ error: "Unauthorized" });
      if (!collector.ingestionAllowed)
        return reply
          .code(503)
          .send({ error: "Log ingestion paused for storage protection" });
      const clean = sanitizeLokiPush(req.body);
      const result = await fetch(`${cfg.lokiUrl}/loki/api/v1/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean),
        signal: AbortSignal.timeout(3000),
        redirect: "error",
      });
      if (!result.ok)
        return reply.code(503).send({ error: "Log storage unavailable" });
      collector.logReceivedAt = new Date().toISOString();
      for (const stream of clean.streams)
        collector.logSources.set(stream.stream.source, collector.logReceivedAt);
      return reply.code(204).send();
    });
  }
  app.get("/v1/pairing", async (req) => ({
    ticket: String(req.headers.authorization ?? "").replace(/^Bearer /, ""),
  }));
  app.post("/v1/operator/link", async (req, reply) => {
    if (!operator)
      return reply.code(403).send({ error: "Desktop operator required" });
    const b = z
      .object({ ticket: z.string().max(2048) })
      .strict()
      .parse(req.body);
    const p = await auth.authorize(b.ticket, false);
    store.set("ai-owner-user-id", p.id);
    store.audit("operator", "linked-superadmin");
    return { ok: true };
  });
  app.get("/v1/session", async (req) => principals.get(req));
  app.get("/v1/snapshot", async () => collector.snapshot);
  app.get("/v1/history", async (req) => {
    const q = z
      .object({
        key: z.string(),
        from: z.coerce.number(),
        to: z.coerce.number(),
      })
      .strict()
      .parse(req.query);
    return history(cfg.prometheusUrl, q.key, q.from, q.to);
  });
  app.get("/v1/logs", async (req) => {
    const q = z
      .object({
        source: z.string().default("all"),
        query: z.string().max(120).default(""),
        from: z.coerce.number(),
        to: z.coerce.number(),
      })
      .strict()
      .parse(req.query);
    return logs(cfg.lokiUrl, q.source, q.query, q.from, q.to);
  });
  app.get("/v1/services", async () => collector.snapshot.services);
  app.get("/v1/schedules", async () => collector.snapshot.schedules);
  app.get("/v1/incidents", async (req) => {
    const q = z
      .object({
        before: z.coerce
          .number()
          .int()
          .positive()
          .max(Number.MAX_SAFE_INTEGER)
          .optional(),
      })
      .strict()
      .parse(req.query);
    return store.incidentPage(q.before);
  });
  app.get("/v1/traces", async () =>
    telemetry.recent
      .filter((e) => e.kind === "request")
      .slice(-100)
      .reverse(),
  );
  app.get("/v1/settings", async () => ({
    settings: store.settings(),
    budget: store.budget(),
    automaticAiStatus: store.get("automatic-ai-status", null),
  }));
  app.put("/v1/settings", async (req, reply) => {
    const p = principals.get(req)!;
    if (!p.aiOwner)
      return reply.code(403).send({
        error: "Only the desktop operator can configure automatic analysis",
      });
    const settings = settingsSchema.parse(req.body);
    store.set("settings", settings);
    store.audit(p.id, "settings-updated");
    return { settings };
  });
  app.post("/v1/incidents/:id", async (req, reply) => {
    const p = principals.get(req)!;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const action = z
      .object({
        action: z.enum(["acknowledge", "snooze", "unsnooze"]),
        minutes: z.number().int().min(5).max(1440).optional(),
      })
      .strict()
      .parse(req.body);
    const i = store.incident(id);
    if (!i) return reply.code(404).send({ error: "Incident not found" });
    if (action.action === "acknowledge" && i.state !== "resolved")
      i.state = "acknowledged";
    if (action.action === "snooze")
      i.snoozedUntil = new Date(
        Date.now() + (action.minutes ?? 60) * 60000,
      ).toISOString();
    if (action.action === "unsnooze") i.snoozedUntil = null;
    store.saveIncident(i);
    store.audit(p.id, `${action.action}:${id}`);
    collector.publish();
    return i;
  });
  app.get("/v1/ai/connections", async (req) =>
    ai.connections(principals.get(req)!),
  );
  app.post("/v1/ai/connect", async (req) => {
    const p = principals.get(req)!;
    const b = z
      .object({
        provider: z.enum(["openai", "grok"]),
        apiKey: z.string().min(16).max(1000),
      })
      .strict()
      .parse(req.body);
    return ai.connect(p, b.provider, b.apiKey);
  });
  app.post("/v1/ai/disconnect", async (req) => {
    const b = z.object({ provider }).strict().parse(req.body);
    ai.disconnect(principals.get(req)!, b.provider);
    return { ok: true };
  });
  app.post("/v1/ai/model", async (req) => {
    const b = z
      .object({
        provider,
        model: z.string().max(100).nullable(),
        price: z
          .object({
            inputPerMillion: z.number().nonnegative(),
            outputPerMillion: z.number().positive(),
            verifiedAt: z.string().datetime(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .parse(req.body);
    ai.select(principals.get(req)!, b.provider, b.model, b.price);
    return { ok: true };
  });
  app.get("/v1/ai/sessions", async (req) =>
    store.sessions(ai.owner(principals.get(req)!)),
  );
  app.get("/v1/ai/messages", async (req) => {
    const q = z
      .object({
        session: z.string().max(100).optional(),
        before: z.string().uuid().optional(),
      })
      .strict()
      .parse(req.query);
    return store.messages(ai.owner(principals.get(req)!), q.session, q.before);
  });
  app.post("/v1/ai/chat", async (req, reply) => {
    const b = z
      .object({
        provider,
        question: z.string().min(1).max(2000),
        sessionId: z.string().regex(/^[a-zA-Z0-9:_-]{1,100}$/),
      })
      .strict()
      .parse(req.body);
    if (ai.busy)
      return reply.code(409).send({ error: "An analysis is already running" });
    const p = principals.get(req)!;
    void ai.analyze(p, b.question, b.provider, b.sessionId).catch(() => {});
    return reply.code(202).send({ sessionId: b.sessionId });
  });
  app.get("/v1/events", async (req, reply) => {
    if (streams >= 20)
      return reply.code(429).send({ error: "Stream limit reached" });
    const p = principals.get(req)!;
    const token = String(req.headers.authorization ?? "").replace(
      /^Bearer /,
      "",
    );
    streams++;
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = (event: string, data: unknown) => {
      if (reply.raw.writableLength > 262144) {
        reply.raw.destroy();
        return;
      }
      if (!reply.raw.destroyed)
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const snapshot = (s: typeof collector.snapshot) => send("snapshot", s);
    const delta = (owner: string, e: unknown) => {
      if (owner === ai.owner(p)) send("ai", e);
    };
    collector.listeners.add(snapshot);
    ai.listeners.add(delta);
    snapshot(collector.snapshot);
    let checking = false;
    const revalidate = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        await auth.authorize(token, operator, req.headers.origin);
        send("heartbeat", { at: Date.now() });
      } catch {
        send("expired", {});
        reply.raw.end();
      } finally {
        checking = false;
      }
    }, 10000);
    reply.raw.on("close", () => {
      streams--;
      clearInterval(revalidate);
      collector.listeners.delete(snapshot);
      ai.listeners.delete(delta);
    });
  });
  return app;
}
export async function listen(d: Dependencies) {
  const web = createServer(d),
    local = createServer(d, true);
  await web.listen({ host: d.cfg.host, port: d.cfg.port });
  await removeStaleSocket(d.cfg.socket);
  await local.listen({ path: d.cfg.socket });
  await chmod(d.cfg.socket, 0o660);
  return { web, local };
}
