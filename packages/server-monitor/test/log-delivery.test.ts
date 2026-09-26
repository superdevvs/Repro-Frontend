import test from "node:test";
import assert from "node:assert/strict";
import protobuf from "protobufjs";
import snappy from "snappyjs";
import { decodeLokiPush } from "../src/loki-protocol.js";
import { sanitizeLokiPush } from "../src/history.js";
import { alloyLogFiles, logCoverage } from "../src/collectors/coverage.js";
import { logDelivery } from "../src/collectors/log-delivery.js";
import { Store } from "../src/store.js";
import { Incidents } from "../src/incidents.js";
import type { Snapshot } from "@repro/monitor-contracts";

test("an omitted protobuf string preserves a blank line and the surrounding redacted entries", () => {
  const schema = protobuf.parse('syntax="proto3";message Timestamp{int64 seconds=1;int32 nanos=2;}message Entry{Timestamp timestamp=1;string line=2;}message Stream{string labels=1;repeated Entry entries=2;}message PushRequest{repeated Stream streams=1;}').root.lookupType("PushRequest");
  const bytes = schema.encode(schema.create({ streams: [{ labels: '{source="scheduler"}', entries: [
    { timestamp: { seconds: 1790395200, nanos: 1 }, line: "before token=fixture-secret" },
    { timestamp: { seconds: 1790395200, nanos: 2 } },
    { timestamp: { seconds: 1790395200, nanos: 3 }, line: "after" },
  ] }] })).finish();
  const clean = sanitizeLokiPush(decodeLokiPush(Buffer.from(snappy.compress(bytes))));
  assert.equal(clean.streams[0].values.length, 3);
  assert.equal(clean.streams[0].values[1][1], "");
  assert.equal(clean.streams[0].values[2][1], "after");
  assert.ok(!JSON.stringify(clean).includes("fixture-secret"));
  assert.throws(() => sanitizeLokiPush({ streams: [{ stream: { source: "scheduler" }, values: [["1790395200000000001", null]] }] }));
});

test("quiet operator-owned logs use fresh Alloy target evidence across gateway restarts", async () => {
  const targets = alloyLogFiles([
    'loki_source_file_read_bytes_total{path="/home/maverick/.local/share/repro-studio/logs/worker.log"} 0',
    'loki_source_file_read_bytes_total{path="/home/maverick/.local/share/repro-studio/logs/supervisord.log"} 1500',
    'loki_source_file_read_bytes_total{path="/home/maverick/.local/share/repro-studio/logs/subdir/private.log"} 42',
  ].join("\n"), 1000);
  const denied = async () => { throw new Error("Gateway cannot traverse operator home"); };
  const rows = await logCoverage(new Map(), targets, denied, 1000);
  const studio = rows.find(s => s.id === "log:studio")!;
  assert.equal(studio.status, "healthy");
  assert.match(studio.detail!, /2 tracked files/);
  assert.match(studio.detail!, /No lines ingested/);
  assert.equal(rows.find(s => s.id === "log:laravel")!.status, "unavailable");
});

test("old ingestion and stale Alloy observations cannot establish current log coverage", async () => {
  const last = new Map([["studio", "2026-09-26T00:00:00.000Z"]]);
  const targets = { observedAt: 1000, sources: new Map([["studio", 1]]) };
  const denied = async () => { throw new Error("denied"); };
  const rows = await logCoverage(last, targets, denied, 46000);
  assert.equal(rows.find(s => s.id === "log:studio")!.status, "unavailable");
});

test("log loss survives gateway restarts, handles Alloy resets and clears after five quiet minutes", () => {
  const baseline = logDelivery(null, 100, 1000);
  assert.equal(baseline.recentLosses, 0);
  const loss = logDelivery(baseline, 103, 2000);
  assert.equal(loss.recentLosses, 3);
  const restarted = logDelivery(JSON.parse(JSON.stringify(loss)), 103, 3000);
  assert.equal(restarted.recentLosses, 3);
  const reset = logDelivery(restarted, 1, 4000);
  assert.equal(reset.recentLosses, 4);
  assert.equal(logDelivery(reset, 1, 303999).recentLosses, 4);
  assert.equal(logDelivery(reset, 1, 304000).recentLosses, 0);
});

test("log loss creates one incident and verified delivery recovery resolves it", () => {
  const store = new Store(":memory:");
  const engine = new Incidents(store);
  const s: Snapshot = { version: 1, generatedAt: new Date().toISOString(), hostname: "fixture", metrics: [], sources: [{ id: "log-delivery", label: "Log forwarding", status: "unavailable", observedAt: null, intervalMs: 15000, detail: "3 new drops" }], services: [], schedules: [], queues: [], disks: [], usage: [], incidents: [], markers: [] };
  try {
    engine.evaluate(s, 1000);
    engine.evaluate(s, 2000);
    assert.equal(store.incidents().length, 1);
    assert.equal(store.incidents()[0].state, "open");
    s.sources[0].status = "stale";
    engine.evaluate(s, 3000);
    assert.equal(store.incidents()[0].state, "open");
    s.sources[0].status = "healthy";
    engine.evaluate(s, 304000);
    assert.equal(store.incidents()[0].state, "resolved");
  } finally { store.close(); }
});
