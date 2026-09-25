import Fastify from "fastify";
import { chmod, readFile } from "node:fs/promises";
import { z } from "zod";
import { Codex } from "./codex.js";
import { GrokCli } from "./grok.js";
import { removeStaleSocket } from "../telemetry.js";
import { equalSecret } from "../auth.js";
import { redactText } from "../privacy.js";
const cfg = z
  .object({
    socket: z.string(),
    tokenFile: z.string(),
    stateDir: z.string(),
    codexBinary: z.string(),
    grokBinary: z.string(),
  })
  .strict();
export async function startBroker(configPath: string) {
  const c = cfg.parse(JSON.parse(await readFile(configPath, "utf8")));
  const token = (await readFile(c.tokenFile, "utf8")).trim();
  if (token.length < 64) throw new Error("Broker token too short");
  const providers = {
    codex: new Codex(c.stateDir, c.codexBinary),
    "grok-cli": new GrokCli(c.stateDir, c.grokBinary),
  };
  const app = Fastify({ logger: false, bodyLimit: 65536 });
  let busy = false;
  app.addHook("onRequest", async (req, reply) => {
    if (
      req.headers.origin ||
      !equalSecret(
        String(req.headers.authorization ?? "").replace(/^Bearer /, ""),
        token,
      )
    )
      return reply.code(401).send({ error: "Unauthorized" });
  });
  app.get("/status/:provider", async (req, reply) => {
    const p = (req.params as { provider: string }).provider;
    if (p !== "codex" && p !== "grok-cli") return reply.code(404).send();
    try {
      return await providers[p].status();
    } catch (e) {
      return {
        id: p,
        label: p,
        connected: false,
        status: redactText(e instanceof Error ? e.message : "Unavailable"),
        models: [],
        selectedModel: null,
        owner: "operator",
      };
    }
  });
  app.post("/analyze", async (req, reply) => {
    const parsed = z
      .object({
        provider: z.enum(["codex", "grok-cli"]),
        prompt: z.string().max(50000),
        model: z.string().max(100).nullable(),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "Invalid analysis request" });
    if (busy)
      return reply.code(409).send({ error: "AI analysis already running" });
    busy = true;
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    });
    try {
      const d = parsed.data;
      const text = await providers[d.provider].analyze(
        d.prompt,
        d.model,
        (delta) => {
          if (!reply.raw.destroyed)
            reply.raw.write(JSON.stringify({ delta }) + "\n");
        },
      );
      reply.raw.end(JSON.stringify({ text }) + "\n");
    } catch (e) {
      reply.raw.end(
        JSON.stringify({
          error: redactText(e instanceof Error ? e.message : "Provider failed"),
        }) + "\n",
      );
    } finally {
      busy = false;
    }
  });
  await removeStaleSocket(c.socket);
  await app.listen({ path: c.socket });
  await chmod(c.socket, 0o660);
  return app;
}
if (process.argv[1]?.endsWith("/broker.js")) {
  const path = process.env.REPRO_MONITOR_BROKER_CONFIG;
  if (!path) throw new Error("Broker configuration missing");
  await startBroker(path);
}
