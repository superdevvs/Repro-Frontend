import React, { useEffect, useState } from "react";
import type { MonitorClient, TelemetryEvent } from "@repro/monitor-contracts";
import { MonitorChart } from "./MonitorChart";
import { MonitorLogs } from "./MonitorLogs";
import { timeLabel, valueLabel } from "./format";
export function MonitorEvidence({
  client,
  at,
  query = "",
}: {
  client: MonitorClient;
  at: string;
  query?: string;
}) {
  const end = Math.min(Date.now() / 1000, Date.parse(at) / 1000 + 300);
  return (
    <details className="rm-panel">
      <summary>Inspect evidence around {timeLabel(at)}</summary>
      <p className="rm-note">
        Recorded metrics and sanitized log entries, from ten minutes before
        through five minutes after this event. Missing history stays
        unavailable.
      </p>
      <MonitorChart
        client={client}
        metric="cpu_percent"
        title="CPU around event"
        hours={0.25}
        fixedTo={end}
      />
      <MonitorLogs
        client={client}
        hours={0.25}
        fixedTo={end}
        initialQuery={query}
      />
    </details>
  );
}
export function MonitorTraces({ client }: { client: MonitorClient }) {
  const [traces, setTraces] = useState<TelemetryEvent[]>([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<TelemetryEvent | null>(null);
  useEffect(() => {
    let closed = false;
    const update = async () => {
      try {
        const rows = await client.request<TelemetryEvent[]>("/traces");
        if (!closed) {
          setTraces(rows);
          setError("");
        }
      } catch {
        if (!closed) setError("Request traces unavailable");
      }
    };
    void update();
    const timer = setInterval(() => void update(), 15000);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, [client]);
  return (
    <article className="rm-panel">
      <h2>Recent request traces</h2>
      <p className="rm-note">
        Bounded drill-down sample. Request totals and charts use the complete
        counters and duration histograms.
      </p>
      {error && <p>{error}</p>}
      <div className="rm-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Route template</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Trace</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t, i) => (
              <tr key={t.traceId ?? i}>
                <td>{timeLabel(t.timestamp)}</td>
                <td>
                  {t.method} {t.route}
                </td>
                <td>{t.status}</td>
                <td>{valueLabel(t.durationMs, "ms")}</td>
                <td>
                  <button onClick={() => setSelected(t)}>
                    {t.traceId ?? "Inspect interval"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!traces.length && (
        <p className="rm-note">No instrumented requests have been observed.</p>
      )}
      {selected && (
        <MonitorEvidence
          key={selected.traceId ?? selected.timestamp}
          client={client}
          at={selected.timestamp}
          query={selected.traceId ?? ""}
        />
      )}
    </article>
  );
}
