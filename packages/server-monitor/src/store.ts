import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  Budget,
  Incident,
  MonitorSettings,
  ChatMessage,
} from "@repro/monitor-contracts";
export const defaults: MonitorSettings = {
  automaticAi: false,
  defaultProvider: "codex",
  dailySummaryTime: "09:00",
  timezone: "America/New_York",
  monthlyBudgetUsd: 100,
  thresholds: {
    diskFreeWarning: 15,
    diskFreeCritical: 5,
    queueWarningSeconds: 120,
    queueCriticalSeconds: 300,
    cpuWarningPercent: 90,
    memoryAvailableWarningPercent: 10,
  },
};
export class Store {
  db: Database.Database;
  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 1000");
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, owner TEXT NOT NULL, session TEXT NOT NULL, created INTEGER NOT NULL, value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS messages_owner ON messages(owner, session, created);
      CREATE TABLE IF NOT EXISTS spend (id TEXT PRIMARY KEY, month TEXT NOT NULL, automatic INTEGER NOT NULL, reserved REAL NOT NULL, actual REAL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, created INTEGER NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS markers (id TEXT PRIMARY KEY, created INTEGER NOT NULL, value TEXT NOT NULL);`);
    const columns = this.db.prepare("PRAGMA table_info(spend)").all() as {
      name: string;
    }[];
    if (!columns.some((c) => c.name === "basis"))
      this.db.exec(
        "ALTER TABLE spend ADD COLUMN basis TEXT NOT NULL DEFAULT 'estimated'",
      );
  }
  get<T>(key: string, fallback: T): T {
    const row = this.db.prepare("SELECT value FROM kv WHERE key=?").get(key) as
      { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : fallback;
  }
  set(key: string, value: unknown) {
    this.db
      .prepare(
        "INSERT INTO kv VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, JSON.stringify(value));
  }
  settings(): MonitorSettings {
    return this.get("settings", defaults);
  }
  incidents(): Incident[] {
    return (
      this.db
        .prepare("SELECT value FROM incidents ORDER BY rowid DESC LIMIT 250")
        .all() as { value: string }[]
    ).map((r) => JSON.parse(r.value) as Incident);
  }
  saveIncident(i: Incident) {
    this.db
      .prepare(
        "INSERT INTO incidents VALUES (?,?,?) ON CONFLICT(fingerprint) DO UPDATE SET value=excluded.value",
      )
      .run(i.id, i.fingerprint, JSON.stringify(i));
  }
  audit(actor: string, action: string) {
    this.db
      .prepare("INSERT INTO audit(created,actor,action) VALUES (?,?,?)")
      .run(Date.now(), actor, action);
  }
  saveMessage(owner: string, m: ChatMessage) {
    this.db
      .prepare(
        "INSERT INTO messages VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      )
      .run(
        m.id,
        owner,
        m.sessionId,
        Date.parse(m.createdAt),
        JSON.stringify(m),
      );
  }
  messages(owner: string, session?: string): ChatMessage[] {
    const rows = session
      ? this.db
          .prepare(
            "SELECT value FROM messages WHERE owner=? AND session=? ORDER BY created LIMIT 100",
          )
          .all(owner, session)
      : this.db
          .prepare(
            "SELECT value FROM messages WHERE owner=? ORDER BY created DESC LIMIT 100",
          )
          .all(owner);
    return (rows as { value: string }[]).map(
      (r) => JSON.parse(r.value) as ChatMessage,
    );
  }
  month(now = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
    }).format(now);
  }
  budget(): Budget {
    const month = this.month();
    const r = this.db
      .prepare(
        "SELECT COALESCE(SUM(actual),0) spent, COALESCE(SUM(CASE WHEN actual IS NULL THEN reserved ELSE 0 END),0) reserved, COALESCE(SUM(CASE WHEN automatic=1 THEN actual ELSE 0 END),0) automatic, COALESCE(SUM(CASE WHEN automatic=0 THEN actual ELSE 0 END),0) manual FROM spend WHERE month=?",
      )
      .get(month) as Record<string, number>;
    return {
      month,
      limitUsd: this.settings().monthlyBudgetUsd,
      spentUsd: r.spent,
      reportedUsd: (
        this.db
          .prepare(
            "SELECT COALESCE(SUM(actual),0) value FROM spend WHERE month=? AND basis='reported'",
          )
          .get(month) as { value: number }
      ).value,
      estimatedUsd: (
        this.db
          .prepare(
            "SELECT COALESCE(SUM(actual),0) value FROM spend WHERE month=? AND basis<>'reported'",
          )
          .get(month) as { value: number }
      ).value,
      reservedUsd: r.reserved,
      automaticUsd: r.automatic,
      manualUsd: r.manual,
    };
  }
  reserve(amount: number, automatic: boolean): string {
    return this.db
      .transaction(() => {
        if (!Number.isFinite(amount) || amount <= 0)
          throw new Error("Verified positive cost reservation required");
        const b = this.budget();
        if (b.spentUsd + b.reservedUsd + amount > b.limitUsd)
          throw new Error("Monthly AI budget reached");
        const id = randomUUID();
        this.db
          .prepare(
            "INSERT INTO spend (id,month,automatic,reserved,actual,created) VALUES (?,?,?,?,NULL,?)",
          )
          .run(id, b.month, automatic ? 1 : 0, amount, Date.now());
        return id;
      })
      .immediate();
  }
  settle(
    id: string,
    actual?: number,
    basis: "reported" | "estimated" = "estimated",
  ) {
    if (actual !== undefined && (!Number.isFinite(actual) || actual < 0))
      throw new Error("Invalid usage");
    this.db
      .prepare(
        "UPDATE spend SET actual=COALESCE(?,reserved),basis=? WHERE id=?",
      )
      .run(actual ?? null, basis, id);
  }
  prune(now = Date.now()) {
    const cutoff = now - 90 * 86400_000;
    this.db.prepare("DELETE FROM messages WHERE created < ?").run(cutoff);
    this.db.prepare("DELETE FROM audit WHERE created < ?").run(cutoff);
    this.db.prepare("DELETE FROM markers WHERE created < ?").run(cutoff);
    this.db
      .prepare(
        "DELETE FROM incidents WHERE json_extract(value,'state')='resolved' AND json_extract(value,'updatedAt') < ?",
      )
      .run(new Date(cutoff).toISOString());
  }
  close() {
    this.db.close();
  }
}
