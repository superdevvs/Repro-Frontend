import { MonitorEvidence } from "./MonitorEvidence";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import React, { useEffect, useState } from "react";
import type {
  MonitorClient,
  Snapshot,
  Incident,
} from "@repro/monitor-contracts";
import {
  Activity,
  ArrowDownToLine,
  Bot,
  CircleAlert,
  Database,
  HardDrive,
  Layers,
  ListChecks,
  Radio,
  RefreshCw,
  Server,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { valueLabel, timeLabel } from "./format";
import { MonitorChart } from "./MonitorChart";
import { MonitorTables } from "./MonitorTables";
import { MonitorLogs } from "./MonitorLogs";
import { MonitorAi } from "./MonitorAi";
import "./monitor.css";
const tabs = [
  ["overview", "Overview", Activity],
  ["host", "Host & storage", HardDrive],
  ["application", "Application", Layers],
  ["jobs", "Jobs", ListChecks],
  ["schedules", "Schedules", RefreshCw],
  ["logs", "Logs", Terminal],
  ["usage", "Usage", Database],
  ["ai", "AI adviser", Bot],
  ["coverage", "Coverage", Radio],
] as const;
export default function MonitorDashboard({
  client,
  desktop = false,
}: {
  client: MonitorClient;
  desktop?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("overview"),
    [paused, setPaused] = useState(false),
    [history, setHistory] = useState(false),
    [hours, setHours] = useState(1),
    [selected, setSelected] = useState<Incident | null>(null),
    [delta, setDelta] = useState<{ sessionId: string; delta: string } | null>(
      null,
    );
  useEffect(
    () =>
      client.subscribe(
        (s) => {
          setError("");
          if (!paused) setSnapshot(s);
        },
        setError,
        (e) => setDelta(e as { sessionId: string; delta: string }),
      ),
    [client, paused],
  );
  const open = snapshot?.incidents.filter((i) => i.state !== "resolved") ?? [];
  const inbox = history ? (snapshot?.incidents ?? []) : open;
  const active = open.filter(
    (i) => !i.snoozedUntil || Date.parse(i.snoozedUntil) < Date.now(),
  );
  const healthy =
    snapshot?.sources.filter((s) => s.status === "healthy").length ?? 0;
  const action = async (i: Incident, kind: "acknowledge" | "snooze") => {
    try {
      await client.request(`/incidents/${i.id}`, {
        method: "POST",
        body: { action: kind, minutes: 60 },
      });
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };
  function exportEvidence() {
    if (!snapshot) return;
    const blob = new Blob(
      [JSON.stringify({ snapshot, incident: selected }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `repro-monitor-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      className={`rm ${desktop ? "rm-desktop" : ""}`}
      aria-label="RePro Server Monitor"
    >
      <header className="rm-header">
        <div className="rm-brand">
          <span className="rm-logo">
            <Server size={23} />
          </span>
          <div>
            <span className="rm-eyebrow">REPRO / OPERATIONS</span>
            <h1>Server monitor</h1>
            <p>
              {snapshot?.hostname ?? "Connecting to monitoring service"} ·
              Monitor and advise
            </p>
          </div>
        </div>
        <div className="rm-toolbar">
          <span className={`rm-live ${error || paused ? "rm-muted" : ""}`}>
            <i />
            {error
              ? "Disconnected"
              : !snapshot
                ? "Connecting"
                : paused
                  ? "Paused"
                  : "Live"}
          </span>
          <select
            aria-label="History period"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            <option value={1}>Last hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={168}>Last 7 days</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Export redacted evidence"
            aria-label="Export redacted evidence"
            onClick={exportEvidence}
          >
            <ArrowDownToLine size={16} />
          </Button>
        </div>
      </header>
      {error && (
        <div className="rm-banner" role="alert">
          <CircleAlert size={17} />
          {error}. Previously received values may be stale.
        </div>
      )}
      <nav className="rm-tabs" aria-label="Monitor sections">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
            {label}
            {id === "overview" && active.length > 0 && <b>{active.length}</b>}
          </button>
        ))}
      </nav>
      {!snapshot ? (
        <div className="rm-empty">
          <Radio size={32} />
          <h2>Waiting for monitoring data</h2>
          <p>
            The monitor runs independently of the application. Collection and
            access errors will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="rm-statusline">
            <span>
              {healthy} / {snapshot.sources.length} sources healthy
            </span>
            <span>Observed {timeLabel(snapshot.generatedAt)}</span>
          </div>
          {tab === "overview" && (
            <>
              <div className="rm-stats">
                {[
                  ["cpu_percent", "CPU usage"],
                  ["memory_used", "Memory used"],
                  ["load_1", "System load"],
                  ["uptime", "Host uptime"],
                ].map(([key, label]) => {
                  const m = snapshot.metrics.find((m) => m.key === key);
                  return (
                    <article className="rm-stat" key={key}>
                      <span>{label}</span>
                      <strong>{valueLabel(m?.value, m?.unit ?? "")}</strong>
                      <small>
                        {snapshot.sources.find((s) => s.id === "host")
                          ?.status ?? "Awaiting collection"}
                      </small>
                    </article>
                  );
                })}
              </div>
              <div className="rm-two">
                <MonitorChart
                  client={client}
                  metric="cpu_percent"
                  title="CPU utilization"
                  hours={hours}
                />
                <MonitorChart
                  client={client}
                  metric="memory_used"
                  title="Memory usage"
                  hours={hours}
                />
              </div>
              <div className="rm-two">
                <article className="rm-panel">
                  <div className="rm-panel-heading">
                    <h2>Incident inbox</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHistory((v) => !v)}
                    >
                      {history ? "Show active" : "History"} · {open.length}{" "}
                      active
                    </Button>
                  </div>
                  {!inbox.length ? (
                    <p className="rm-note">
                      No active incidents. Review coverage for unavailable
                      sources.
                    </p>
                  ) : (
                    inbox.map((i) => (
                      <button
                        className="rm-incident"
                        key={i.id}
                        onClick={() => setSelected(i)}
                      >
                        <span className={`rm-dot ${i.severity}`} />
                        <span>
                          <strong>{i.title}</strong>
                          <small>
                            {i.state} · {timeLabel(i.openedAt)}
                          </small>
                        </span>
                        <span>→</span>
                      </button>
                    ))
                  )}
                </article>
                <article className="rm-panel">
                  <div className="rm-panel-heading">
                    <h2>AI assessment</h2>
                    <Bot size={18} />
                  </div>
                  <p className="rm-note">
                    {open.find((i) => i.analysis)?.analysis?.slice(0, 700) ??
                      "Automatic suggestions appear after an incident is analyzed. You can ask the adviser about the current server state at any time."}
                  </p>
                  <Button variant="outline" onClick={() => setTab("ai")}>
                    Open AI adviser
                  </Button>
                </article>
              </div>
              <article className="rm-panel">
                <h2>Recent deployments</h2>
                {snapshot.markers.length ? (
                  snapshot.markers.slice(0, 5).map((m) => (
                    <p className="rm-marker" key={m.id}>
                      <span>{m.label}</span>
                      <code>{m.detail.slice(0, 12)}</code>
                      <time>{timeLabel(m.timestamp)}</time>
                    </p>
                  ))
                ) : (
                  <p className="rm-note">No deployment metadata observed.</p>
                )}
              </article>
            </>
          )}
          {[
            "host",
            "application",
            "jobs",
            "schedules",
            "usage",
            "coverage",
          ].includes(tab) && (
            <MonitorTables
              tab={tab}
              snapshot={snapshot}
              client={client}
              hours={hours}
            />
          )}
          {tab === "logs" && <MonitorLogs client={client} hours={hours} />}
          {tab === "ai" && <MonitorAi client={client} delta={delta} />}
        </>
      )}
      {selected && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent className="rm rm-detail" aria-describedby={undefined}>
            <Button
              className="rm-close"
              variant="ghost"
              onClick={() => setSelected(null)}
            >
              Close
            </Button>
            <span className={`rm-pill ${selected.severity}`}>
              {selected.severity}
            </span>
            <DialogTitle>{selected.title}</DialogTitle>
            <p>
              {selected.source} · {timeLabel(selected.openedAt)}
            </p>
            <p className="rm-note">
              Opened {timeLabel(selected.openedAt)} · Updated{" "}
              {timeLabel(selected.updatedAt)}
              {selected.resolvedAt
                ? ` · Recovered ${timeLabel(selected.resolvedAt)}`
                : ""}
            </p>
            <MonitorEvidence client={client} at={selected.openedAt} />
            <h3>Evidence</h3>
            <ul>
              {selected.evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {selected.analysis && (
              <>
                <h3>AI assessment</h3>
                <p className="rm-pre">{selected.analysis}</p>
              </>
            )}
            <div className="rm-actions">
              <Button onClick={() => void action(selected, "acknowledge")}>
                Acknowledge
              </Button>
              <Button
                variant="outline"
                onClick={() => void action(selected, "snooze")}
              >
                Snooze 1 hour
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setTab("logs");
                  setSelected(null);
                }}
              >
                Inspect logs
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
