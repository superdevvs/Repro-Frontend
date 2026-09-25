import React, { useEffect, useState } from "react";
import type { Incident, MonitorClient } from "@repro/monitor-contracts";
import { Button } from "@/components/ui/button";
import { timeLabel } from "./format";
export function MonitorIncidentHistory({
  client,
  onSelect,
}: {
  client: MonitorClient;
  onSelect: (incident: Incident) => void;
}) {
  const [rows, setRows] = useState<Incident[]>([]),
    [cursor, setCursor] = useState<number | undefined>(),
    [next, setNext] = useState<number | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let closed = false;
    void client
      .request<{ incidents: Incident[]; nextBefore: number | null }>(
        `/incidents${cursor ? `?before=${cursor}` : ""}`,
      )
      .then((r) => {
        if (!closed) {
          setRows(r.incidents);
          setNext(r.nextBefore);
          setError("");
        }
      })
      .catch(() => {
        if (!closed) setError("Incident history unavailable");
      });
    return () => {
      closed = true;
    };
  }, [client, cursor]);
  return (
    <article className="rm-panel">
      <h2>Incident history</h2>
      <p className="rm-note">
        Retained for 90 days. Recurring failures keep separate timelines.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows.map((i) => (
        <button className="rm-incident" key={i.id} onClick={() => onSelect(i)}>
          <span className={`rm-dot ${i.severity}`} />
          <span>
            <strong>{i.title}</strong>
            <small>
              {i.state} · {timeLabel(i.openedAt)}
              {i.resolvedAt ? ` · recovered ${timeLabel(i.resolvedAt)}` : ""}
            </small>
          </span>
        </button>
      ))}
      {!rows.length && !error && <p>No incidents recorded in this page.</p>}
      <div className="rm-actions">
        <Button
          variant="outline"
          disabled={!next}
          onClick={() => setCursor(next!)}
        >
          Older incidents
        </Button>
        {cursor && (
          <Button variant="ghost" onClick={() => setCursor(undefined)}>
            Latest incidents
          </Button>
        )}
      </div>
    </article>
  );
}
