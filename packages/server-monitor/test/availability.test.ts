import type { Schedule } from "@repro/monitor-contracts";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.js";
import { configSchema } from "../src/config.js";
import { Telemetry } from "../src/telemetry.js";
import { Collector } from "../src/collector.js";
import { createServer } from "../src/server.js";
import { AiService } from "../src/ai/service.js";
import { Vault } from "../src/ai/vault.js";
import { BrokerClient } from "../src/ai/broker-client.js";
import { Incidents } from "../src/incidents.js";
import Database from "better-sqlite3";

test("operator host snapshots remain accessible while Laravel authorization is offline", async () => {
  const dir = await mkdtemp(join(tmpdir(), "repro-monitor-availability-")),
    key = "b".repeat(64);
  await writeFile(join(dir, "key"), key);
  const cfg = configSchema.parse({
    dataDir: dir,
    signingKeyFile: join(dir, "key"),
    operatorTokenFile: join(dir, "key"),
    authorizationUrl: "http://127.0.0.1:1/unavailable",
  });
  const store = new Store(":memory:"),
    telemetry = new Telemetry(store),
    collector = new Collector(cfg, store, telemetry);
  collector.snapshot.metrics = [
    { key: "cpu_percent", label: "CPU", value: 12, unit: "%", source: "host" },
  ];
  const ai = new AiService(
    store,
    new Vault(store, key),
    new BrokerClient("/nonexistent", join(dir, "key")),
    () => collector.snapshot,
  );
  const app = createServer({ cfg, store, telemetry, collector, ai }, true);
  try {
    const r = await app.inject({
      url: "/v1/snapshot",
      headers: { authorization: `Bearer ${key}` },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().metrics[0].value, 12);
    assert.equal(
      (
        await app.inject({
          url: "/v1/snapshot",
          headers: {
            authorization: `Bearer ${key}`,
            origin: "https://evil.test",
          },
        })
      ).statusCode,
      401,
    );
  } finally {
    await app.close();
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("a locked monitoring database does not stop host snapshot publication", async () => {
  const dir = await mkdtemp(join(tmpdir(), "repro-monitor-lock-")),
    path = join(dir, "monitor.sqlite");
  const store = new Store(path),
    other = new Database(path);
  store.db.pragma("busy_timeout = 10");
  const telemetry = new Telemetry(store),
    collector = new Collector(
      configSchema.parse({ dataDir: dir }),
      store,
      telemetry,
    );
  collector.snapshot.disks = [
    {
      id: "fixture",
      mount: "/mnt/fixture",
      device: "unmounted",
      uuid: null,
      bytes: 0,
      free: 0,
      inodesFree: null,
      expected: true,
      valid: false,
    },
  ];
  let published = false;
  collector.listeners.add(() => (published = true));
  try {
    other.exec("BEGIN IMMEDIATE");
    assert.doesNotThrow(() => collector.publish());
    assert.ok(published);
    assert.equal(
      collector.snapshot.sources.find((s) => s.id === "monitor-history")
        ?.status,
      "unavailable",
    );
    other.exec("ROLLBACK");
    collector.publish();
    assert.equal(
      collector.snapshot.sources.find((s) => s.id === "monitor-history")
        ?.status,
      "healthy",
    );
  } finally {
    other.close();
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("missing scheduler starts alert after grace and successful observations recover", () => {
  const store = new Store(":memory:"),
    telemetry = new Telemetry(store),
    collector = new Collector(configSchema.parse({}), store, telemetry),
    engine = new Incidents(store),
    now = Date.now();
  const task: Schedule = {
    id: "fixture",
    name: "fixture",
    source: "laravel",
    expression: "* * * * *",
    timezone: "America/New_York",
    nextRun: new Date(now + 60000).toISOString(),
    lastRun: null,
    outcome: "unknown" as const,
    durationMs: null,
    missedSince: new Date(now - 240000).toISOString(),
  };
  collector.snapshot.schedules = [task];
  try {
    engine.evaluate(collector.snapshot, now);
    assert.equal(store.incidents()[0].fingerprint, "missed:fixture");
    task.missedSince = null;
    engine.evaluate(collector.snapshot, now + 5000);
    assert.equal(store.incidents()[0].state, "resolved");
  } finally {
    store.close();
  }
});
