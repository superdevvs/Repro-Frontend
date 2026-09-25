import React, { useEffect, useState } from "react";
import type { MonitorClient, LogEntry } from "@repro/monitor-contracts";
import { timeLabel } from "./format";
export function MonitorLogs({
  client,
  hours,
  fixedTo,
  initialQuery = "",
}: {
  client: MonitorClient;
  hours: number;
  fixedTo?: number;
  initialQuery?: string;
}) {
  const [source, setSource] = useState("all"),
    [query, setQuery] = useState(initialQuery),
    [search, setSearch] = useState(initialQuery),
    [entries, setEntries] = useState<LogEntry[]>([]),
    [error, setError] = useState(""),
    [live, setLive] = useState(true);
  useEffect(() => {
    let closed = false;
    const update = async () => {
      try {
        const to = Math.floor(fixedTo ?? Date.now() / 1000);
        const params = new URLSearchParams({
          source,
          query: search,
          from: String(to - Math.min(hours, 336) * 3600),
          to: String(to),
        });
        const data = await client.request<LogEntry[]>(`/logs?${params}`);
        if (!closed) {
          setEntries(data);
          setError("");
        }
      } catch (e) {
        if (!closed)
          setError(e instanceof Error ? e.message : "Logs unavailable");
      }
    };
    void update();
    const timer =
      live && !fixedTo ? setInterval(() => void update(), 2000) : null;
    return () => {
      closed = true;
      if (timer) clearInterval(timer);
    };
  }, [client, source, search, hours, live, fixedTo]);
  return (
    <article className="rm-panel">
      <div className="rm-panel-heading">
        <h2>Log explorer</h2>
        <label>
          <input
            type="checkbox"
            checked={live && !fixedTo}
            disabled={!!fixedTo}
            onChange={(e) => setLive(e.target.checked)}
          />{" "}
          Live tail
        </label>
      </div>
      <form
        className="rm-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
        }}
      >
        <select
          aria-label="Log source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          {[
            "all",
            "laravel",
            "scheduler",
            "worker",
            "studio",
            "nginx-access",
            "nginx-error",
            "php-fpm",
            "system",
            "uploads",
            "auth-security",
            "stripe-webhooks",
            "monitor",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          aria-label="Search logs"
          placeholder="Search redacted log messages…"
          maxLength={120}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="rm-button" type="submit">
          Search
        </button>
      </form>
      {error && (
        <p role="alert" className="rm-banner">
          {error}
        </p>
      )}
      <div className="rm-log-list">
        {entries.map((e) => (
          <div className="rm-log" key={e.id}>
            <time>{timeLabel(e.timestamp)}</time>
            <span className={`rm-pill ${e.level}`}>{e.source}</span>
            <pre>{e.message}</pre>
          </div>
        ))}
        {!entries.length && !error && (
          <p className="rm-note">No matching entries in this period.</p>
        )}
      </div>
      <p className="rm-note">
        Latest 250 matching entries. Sensitive fields are redacted before
        indexing.
      </p>
    </article>
  );
}
