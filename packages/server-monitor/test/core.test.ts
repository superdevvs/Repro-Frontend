import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Store } from "../src/store.js";
import { claims } from "../src/auth.js";
import { redact, redactText } from "../src/privacy.js";
import { sanitizeLokiPush, history, logs } from "../src/history.js";
import { Vault } from "../src/ai/vault.js";
import { reservation } from "../src/ai/paid.js";
import { Telemetry } from "../src/telemetry.js";
import { Incidents } from "../src/incidents.js";
import type { Snapshot } from "@repro/monitor-contracts";
const snapshot = (): Snapshot => ({
  version: 1,
  generatedAt: new Date().toISOString(),
  hostname: "fixture",
  metrics: [],
  sources: [],
  services: [],
  queues: [],
  disks: [],
  schedules: [],
  usage: [],
  incidents: [],
  markers: [],
});
test("signed access tickets expire and cannot be extended or tampered with", () => {
  const key = "a".repeat(64),
    body = Buffer.from(
      JSON.stringify({
        v: 1,
        aud: "repro-monitor",
        sub: "1",
        iat: 100,
        exp: 160,
      }),
    ).toString("base64url"),
    signature = createHmac("sha256", key).update(body).digest("base64url");
  assert.equal(claims(`${body}.${signature}`, key, 120).sub, "1");
  assert.throws(() => claims(`${body}.${signature}`, key, 160));
  assert.throws(() => claims(`${body}.${signature}x`, key, 120));
  assert.throws(() => claims(`${body}.${signature}`, "wrong", 120));
});
test("redaction removes credentials, signed URL values, email, IP and nested payloads", () => {
  const text = redactText(
    "Bearer abcDEFG123.foo password=canary user@private.test 192.168.1.2 https://example.test/a?signature=hidden&token=secret",
  );
  for (const secret of [
    "abcDEFG123",
    "canary",
    "user@private.test",
    "192.168.1.2",
    "hidden",
    "token=secret",
  ])
    assert.ok(!text.includes(secret));
  assert.deepEqual(
    redact({ payload: { customer: "Alice" }, password: "secret" }),
    { payload: "[REDACTED]", password: "[REDACTED]" },
  );
});
test("log ingestion discards arbitrary labels and rejects unregistered sources", () => {
  const r = sanitizeLokiPush({
    streams: [
      {
        stream: { source: "laravel", customer: "private" },
        values: [["1770000000000000000", "password=canary"]],
      },
    ],
  });
  assert.deepEqual(r.streams[0].stream, { app: "repro", source: "laravel" });
  assert.ok(!r.streams[0].values[0][1].includes("canary"));
  assert.throws(() =>
    sanitizeLokiPush({
      streams: [{ stream: { source: "../../etc/shadow" }, values: [] }],
    }),
  );
});
test("query interfaces reject arbitrary PromQL, log sources and unbounded time ranges before networking", async () => {
  await assert.rejects(history("http://127.0.0.1", "up or secret", 1, 2));
  await assert.rejects(logs("http://127.0.0.1", "unknown", "", 1, 2));
  await assert.rejects(history("http://127.0.0.1", "cpu_percent", 1, 1e9));
});
test("budget reservations are atomic, conservative after uncertain failures, and shared across manual/automatic calls", () => {
  const store = new Store(":memory:");
  try {
    const a = store.reserve(60, true);
    assert.throws(() => store.reserve(41, false));
    const b = store.reserve(40, false);
    store.settle(a, 20);
    assert.equal(store.budget().spentUsd, 20);
    assert.equal(store.budget().reservedUsd, 40);
    store.settle(b);
    assert.equal(store.budget().manualUsd, 40);
    assert.throws(() => store.reserve(NaN, false));
  } finally {
    store.close();
  }
});
test("vault binds encrypted credentials to owner and provider and never stores plaintext", () => {
  const store = new Store(":memory:");
  try {
    const vault = new Vault(store, "strong-master-secret");
    vault.put("alice", "openai", "canary-api-key");
    assert.equal(vault.get("alice", "openai"), "canary-api-key");
    assert.equal(vault.get("bob", "openai"), null);
    const db = JSON.stringify(store.db.prepare("SELECT * FROM kv").all());
    assert.ok(!db.includes("canary-api-key"));
    const alice = store.get("credential:alice:openai", null);
    store.set("credential:bob:openai", alice);
    assert.throws(() => vault.get("bob", "openai"));
  } finally {
    store.close();
  }
});
test("paid models need current finite pricing and reserve pessimistically by UTF-8 bytes", () => {
  assert.throws(() =>
    reservation("test", {
      inputPerMillion: 1,
      outputPerMillion: 2,
      verifiedAt: "2020-01-01",
    }),
  );
  assert.throws(() =>
    reservation("test", {
      inputPerMillion: NaN,
      outputPerMillion: 2,
      verifiedAt: new Date().toISOString(),
    }),
  );
  assert.ok(
    reservation("こんにちは", {
      inputPerMillion: 1,
      outputPerMillion: 2,
      verifiedAt: new Date().toISOString(),
    }) > 0,
  );
});
test("telemetry rejects payload injection, bounds trace memory, and counts all requests beyond trace sample", async () => {
  const store = new Store(":memory:"),
    t = new Telemetry(store);
  try {
    const event = {
      version: 1,
      kind: "request",
      timestamp: new Date().toISOString(),
      route: "api/shoots/{id}",
      method: "GET",
      status: 200,
      durationMs: 25,
    };
    assert.equal(t.accept({ ...event, payload: "private" }), false);
    for (let n = 0; n < 700; n++) assert.equal(t.accept(event), true);
    assert.equal(t.recent.length, 500);
    assert.match(
      await t.registry.metrics(),
      /repro_requests_total\{[^\n]*\} 700/,
    );
  } finally {
    store.close();
  }
});
test("mount failure is critical, unavailable collection cannot falsely resolve it, verified recovery resolves", () => {
  const store = new Store(":memory:"),
    engine = new Incidents(store),
    s = snapshot();
  try {
    s.disks = [
      {
        id: "media",
        mount: "/mnt/16tb",
        device: "unmounted",
        uuid: null,
        bytes: 0,
        free: 0,
        inodesFree: null,
        expected: true,
        valid: false,
      },
    ];
    engine.evaluate(s);
    assert.equal(store.incidents()[0].severity, "critical");
    s.disks = [];
    s.sources = [
      {
        id: "storage",
        label: "storage",
        status: "unavailable",
        intervalMs: 15000,
        observedAt: null,
      },
    ];
    engine.evaluate(s);
    assert.equal(store.incidents()[0].state, "open");
    s.sources[0].status = "healthy";
    engine.evaluate(s);
    assert.equal(store.incidents()[0].state, "resolved");
  } finally {
    store.close();
  }
});

test("structured personal fields, cookies, SQL bindings and credential aliases are redacted", () => {
  const text = redactText(
    'error {"first_name":"Alice Canary","clientSecret":"secret-canary","headers":{"Authorization":"secret-canary"},"trace_id":"known-trace"}',
  );
  assert.ok(!text.includes("Alice Canary"));
  assert.ok(!text.includes("secret-canary"));
  assert.ok(text.includes("known-trace"));
  assert.ok(
    !redactText("Cookie: session=secret; refresh=private").includes("private"),
  );
  assert.ok(
    !redactText(
      "SQLSTATE lock (SQL: update users set name = AliceCanary)",
    ).includes("AliceCanary"),
  );
});
