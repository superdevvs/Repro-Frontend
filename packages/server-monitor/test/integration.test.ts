import { createServer as netServer } from "node:net";
import { lstat } from "node:fs/promises";
import { removeStaleSocket } from "../src/telemetry.js";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as httpServer } from "node:http";
import { Worker } from "node:worker_threads";
import { CronExpressionParser } from "cron-parser";
import Database from "better-sqlite3";
import protobuf from "protobufjs";
import snappy from "snappyjs";
import { configSchema } from "../src/config.js";
import { createServer } from "../src/server.js";
import { Store } from "../src/store.js";
import { Telemetry } from "../src/telemetry.js";
import { Collector } from "../src/collector.js";
import { AiService } from "../src/ai/service.js";
import { Vault } from "../src/ai/vault.js";
import { BrokerClient } from "../src/ai/broker-client.js";
import type { Auth } from "../src/auth.js";
import { decodeLokiPush } from "../src/loki-protocol.js";
import { database } from "../dist/collectors/database.js";
const key = "a".repeat(64);
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "repro-monitor-test-"));
  for (const name of ["auth", "operator", "ingest"])
    await writeFile(join(dir, name), key, { mode: 0o600 });
  const cfg = configSchema.parse({
    dataDir: dir,
    signingKeyFile: join(dir, "auth"),
    operatorTokenFile: join(dir, "operator"),
    ingestTokenFile: join(dir, "ingest"),
  });
  const store = new Store(":memory:"),
    telemetry = new Telemetry(store),
    collector = new Collector(cfg, store, telemetry);
  const ai = new AiService(
    store,
    new Vault(store, key),
    new BrokerClient("/nonexistent", join(dir, "auth")),
    () => collector.snapshot,
  );
  let valid = true;
  const auth = {
    authorize: async (token: string, operator: boolean, origin?: string) => {
      if (token !== key || !valid || origin === "https://evil.example")
        throw new Error("revoked");
      return {
        id: operator ? "operator" : "7",
        kind: operator ? "operator" : "superadmin",
        aiOwner: operator,
      };
    },
  } as Auth;
  return {
    cfg,
    store,
    telemetry,
    collector,
    ai,
    auth,
    revoke() {
      valid = false;
    },
    async close() {
      store.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
test("every monitoring data endpoint denies missing authorization; operator AI stays private", async () => {
  const f = await fixture(),
    app = createServer(f);
  try {
    for (const path of [
      "/v1/session",
      "/v1/snapshot",
      "/v1/history",
      "/v1/logs",
      "/v1/traces",
      "/v1/services",
      "/v1/schedules",
      "/v1/incidents",
      "/v1/settings",
      "/v1/pairing",
      "/v1/ai/messages",
      "/v1/ai/connections",
      "/v1/events",
    ])
      assert.equal((await app.inject({ url: path })).statusCode, 401, path);
    assert.equal(
      (
        await app.inject({
          url: "/v1/snapshot",
          headers: { authorization: `Bearer ${key}` },
        })
      ).statusCode,
      200,
    );
    const r = await app.inject({
      url: "/v1/ai/connections",
      headers: { authorization: `Bearer ${key}` },
    });
    const connections = r.json();
    assert.equal(
      connections.find((c: { id: string }) => c.id === "codex").connected,
      false,
    );
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/v1/settings",
          headers: { authorization: `Bearer ${key}` },
          payload: f.store.settings(),
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          url: "/v1/snapshot",
          headers: {
            authorization: `Bearer ${key}`,
            "x-impersonate-user-id": "12",
          },
        })
      ).statusCode,
      403,
    );
    f.revoke();
    assert.equal(
      (
        await app.inject({
          url: "/v1/snapshot",
          headers: { authorization: `Bearer ${key}` },
        })
      ).statusCode,
      401,
    );
  } finally {
    await app.close();
    await f.close();
  }
});
test("open event streams revalidate and close after access is revoked", async () => {
  const f = await fixture(),
    app = createServer(f);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const r = await fetch(address + "/v1/events", {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(14000),
    });
    reader = r.body!.getReader();
    assert.match(
      new TextDecoder().decode((await reader.read()).value),
      /event: snapshot/,
    );
    f.revoke();
    let text = "";
    for (;;) {
      const x = await reader.read();
      if (x.done) break;
      text += new TextDecoder().decode(x.value);
    }
    assert.match(text, /event: expired/);
    assert.equal(f.collector.listeners.size, 0);
  } finally {
    await reader?.cancel();
    await app.close();
    await f.close();
  }
});
test("Alloy protobuf batches decode, oversized Snappy blocks fail before allocation", () => {
  const schema = protobuf
    .parse(
      'syntax="proto3"; message Timestamp {int64 seconds=1; int32 nanos=2;} message Entry {Timestamp timestamp=1;string line=2;} message Stream {string labels=1;repeated Entry entries=2;} message PushRequest {repeated Stream streams=1;}',
    )
    .root.lookupType("PushRequest");
  const bytes = schema
    .encode(
      schema.create({
        streams: [
          {
            labels: '{source="laravel", filename="secret"}',
            entries: [
              { timestamp: { seconds: 1700000000, nanos: 3 }, line: "fixture" },
            ],
          },
        ],
      }),
    )
    .finish();
  const decoded = decodeLokiPush(Buffer.from(snappy.compress(bytes)));
  assert.equal(decoded.streams[0].values[0][0], "1700000000000000003");
  assert.deepEqual(decoded.streams[0].stream, { source: "laravel" });
  assert.throws(() => decodeLokiPush(Buffer.from([255, 255, 255, 255, 15])));
});
test("ingestion redacts before storage and stops when storage protection activates", async () => {
  const f = await fixture();
  let received = "";
  const sink = httpServer((req, res) => {
    req.on("data", (x) => (received += x));
    req.on("end", () => {
      res.writeHead(204);
      res.end();
    });
  });
  await new Promise<void>((r) => sink.listen(0, "127.0.0.1", r));
  f.cfg.lokiUrl = `http://127.0.0.1:${(sink.address() as { port: number }).port}`;
  const app = createServer(f);
  const request = {
    method: "POST" as const,
    url: "/ingest/logs",
    headers: { authorization: `Bearer ${key}` },
    payload: {
      streams: [
        {
          stream: { source: "monitor", private: "customer" },
          values: [
            [
              `${Date.now()}000000`,
              "password=canary-private user@private.test",
            ],
          ],
        },
      ],
    },
  };
  try {
    assert.equal((await app.inject(request)).statusCode, 204);
    assert.ok(!received.includes("canary-private"));
    assert.ok(!received.includes("user@private.test"));
    assert.ok(!received.includes("customer"));
    f.collector.ingestionAllowed = false;
    assert.equal((await app.inject(request)).statusCode, 503);
  } finally {
    await app.close();
    await new Promise<void>((r) => sink.close(() => r()));
    await f.close();
  }
});
test("read-only database collection fails promptly under an exclusive lock without changing application data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "repro-monitor-db-")),
    path = join(dir, "app.sqlite"),
    db = new Database(path);
  db.exec(
    'CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES ("original");'.replace(
      '"original"',
      "'original'",
    ),
  );
  try {
    await database(path);
    db.exec("BEGIN EXCLUSIVE");
    const start = Date.now();
    await assert.rejects(database(path));
    assert.ok(Date.now() - start < 2000);
    db.exec("ROLLBACK");
    assert.equal(
      (db.prepare("SELECT value FROM sentinel").get() as { value: string })
        .value,
      "original",
    );
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("separate database connections cannot reserve beyond the shared monthly budget", async () => {
  const dir = await mkdtemp(join(tmpdir(), "repro-monitor-budget-")),
    path = join(dir, "monitor.sqlite"),
    store = new Store(path);
  const module = new URL("../dist/store.js", import.meta.url).href;
  const run = () =>
    new Promise<string>((resolve, reject) => {
      const worker = new Worker(
        `const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {Store}=await import(workerData.module);const s=new Store(workerData.path);try{s.reserve(60,false);parentPort.postMessage('reserved');}catch{parentPort.postMessage('denied');}finally{s.close();}})();`,
        { eval: true, workerData: { path, module } },
      );
      worker.on("message", resolve);
      worker.on("error", reject);
    });
  try {
    assert.deepEqual((await Promise.all([run(), run()])).sort(), [
      "denied",
      "reserved",
    ]);
    assert.equal(store.budget().reservedUsd, 60);
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("scheduler starts never become successful completions; unknown durations remain unknown", () => {
  const s = new Store(":memory:"),
    t = new Telemetry(s);
  const timestamp = new Date().toISOString();
  try {
    t.accept({
      version: 1,
      kind: "catalog",
      timestamp,
      schedules: [
        {
          id: "task",
          name: "fixture",
          source: "laravel",
          expression: "* * * * *",
          timezone: "America/New_York",
          nextRun: null,
          lastRun: null,
          outcome: "unknown",
          durationMs: null,
        },
      ],
    });
    t.accept({
      version: 1,
      kind: "schedule",
      timestamp,
      name: "task",
      outcome: "started",
      durationMs: null,
    });
    assert.equal(t.schedules()[0].outcome, "running");
    assert.equal(t.schedules()[0].durationMs, null);
    t.accept({
      version: 1,
      kind: "schedule",
      timestamp,
      name: "task",
      outcome: "failed",
      durationMs: 120,
    });
    assert.equal(t.schedules()[0].outcome, "failed");
  } finally {
    s.close();
  }
});
test("daily New York schedule remains 9am across daylight-saving transitions", () => {
  for (const [current, expected] of [
    ["2026-03-07T15:00:00Z", "2026-03-08T13:00:00.000Z"],
    ["2026-10-31T15:00:00Z", "2026-11-01T14:00:00.000Z"],
  ])
    assert.equal(
      CronExpressionParser.parse("0 9 * * *", {
        tz: "America/New_York",
        currentDate: current,
      })
        .next()
        .toISOString(),
      expected,
    );
});

test("duplicate starts cannot replace a live local socket", async () => {
  const dir = await mkdtemp(join(tmpdir(), "monitor-socket-")),
    path = join(dir, "active.sock"),
    server = netServer((socket) => socket.end());
  await new Promise<void>((resolve) => server.listen(path, resolve));
  try {
    await assert.rejects(removeStaleSocket(path), /active socket/);
    assert.ok((await lstat(path)).isSocket());
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await removeStaleSocket(path);
    await rm(dir, { recursive: true, force: true });
  }
});
