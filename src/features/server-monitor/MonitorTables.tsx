import { MonitorTraces } from "./MonitorEvidence";
import React from "react";
import type { Snapshot, MonitorClient } from "@repro/monitor-contracts";
import { timeLabel, valueLabel } from "./format";
import { MonitorChart } from "./MonitorChart";
function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="rm-table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function MonitorTables({
  tab,
  snapshot: s,
  client,
  hours,
}: {
  tab: string;
  snapshot: Snapshot;
  client: MonitorClient;
  hours: number;
}) {
  if (tab === "coverage")
    return (
      <article className="rm-panel">
        <h2>Source coverage</h2>
        <p className="rm-note">
          Missing permissions, unsupported readings and incomplete
          instrumentation stay visible here.
        </p>
        <Table headers={["Source", "Status", "Last observed", "Details"]}>
          {s.sources.map((x) => (
            <tr key={x.id}>
              <td>{x.label}</td>
              <td>
                <span className={`rm-pill ${x.status}`}>
                  {x.status.replaceAll("_", " ")}
                </span>
              </td>
              <td>{timeLabel(x.observedAt)}</td>
              <td>{x.detail ?? "Collecting"}</td>
            </tr>
          ))}
        </Table>
      </article>
    );
  if (tab === "schedules")
    return (
      <article className="rm-panel">
        <h2>Crons & scheduled tasks</h2>
        <p className="rm-note">
          A recorded start alone does not establish success. Times below use
          your local timezone; each schedule retains its configured timezone.
        </p>
        <Table
          headers={[
            "Task",
            "Source / expression",
            "Next run",
            "Last observed run",
            "Outcome",
            "Duration",
          ]}
        >
          {s.schedules.map((x) => (
            <tr key={x.id}>
              <td>
                {x.name}
                <small>{x.timezone}</small>
              </td>
              <td>
                {x.source}
                <small>
                  <code>{x.expression}</code>
                </small>
              </td>
              <td>{timeLabel(x.nextRun)}</td>
              <td>{timeLabel(x.lastRun)}</td>
              <td>
                <span className={`rm-pill ${x.outcome}`}>{x.outcome}</span>
              </td>
              <td>{valueLabel(x.durationMs, "ms")}</td>
            </tr>
          ))}
        </Table>
        {!s.schedules.length && (
          <p className="rm-note">
            Awaiting schedule inventory. See Coverage for the collection status.
          </p>
        )}
      </article>
    );
  if (tab === "jobs")
    return (
      <>
        <article className="rm-panel">
          <h2>Queue pressure</h2>
          <Table
            headers={[
              "Queue",
              "Pending",
              "Running",
              "Failed",
              "Oldest ready job",
            ]}
          >
            {s.queues.map((q) => (
              <tr key={q.name}>
                <td>{q.name}</td>
                <td>{q.pending}</td>
                <td>{q.running}</td>
                <td>{q.failed}</td>
                <td>{valueLabel(q.oldestReadySeconds, "seconds")}</td>
              </tr>
            ))}
          </Table>
        </article>
        <MetricTable
          title="Processing workflows"
          snapshot={s}
          filter={(m) => ["workflows", "jobs"].includes(m.source)}
        />
      </>
    );
  if (tab === "usage")
    return (
      <>
        <MetricTable
          title="Observed integration traffic"
          snapshot={s}
          filter={(m) => m.source === "integrations"}
        />
        <article className="rm-panel">
          <h2>Integration usage & costs</h2>
          <p className="rm-note">
            Application estimates are separate from provider billing and the
            monitor’s own AI budget.
          </p>
          <Table
            headers={[
              "Provider / period",
              "Requests",
              "Input tokens",
              "Output tokens",
              "Cost",
              "Basis",
            ]}
          >
            {s.usage.map((u, i) => (
              <tr key={i}>
                <td>
                  {u.provider}
                  <small>{u.detail}</small>
                </td>
                <td>{valueLabel(u.requests, "count")}</td>
                <td>{valueLabel(u.inputTokens, "count")}</td>
                <td>{valueLabel(u.outputTokens, "count")}</td>
                <td>
                  {u.costUsd === null
                    ? "Unavailable"
                    : `$${u.costUsd.toFixed(4)}`}
                </td>
                <td>{u.basis}</td>
              </tr>
            ))}
          </Table>
        </article>
      </>
    );
  if (tab === "application")
    return (
      <>
        <div className="rm-two">
          <MonitorChart
            client={client}
            metric="requests_per_second"
            title="Requests per second"
            hours={hours}
          />
          <MonitorChart
            client={client}
            metric="request_p95"
            title="Response time p95 (seconds)"
            hours={hours}
          />
        </div>
        <MetricTable
          title="Application & database"
          snapshot={s}
          filter={(m) => ["application", "database", "fpm"].includes(m.source)}
        />
        <MonitorTraces client={client} />
        <article className="rm-panel">
          <h2>Services</h2>
          <Table headers={["Service", "State", "Detail", "PID", "Restarts"]}>
            {s.services.map((x) => (
              <tr key={x.id}>
                <td>{x.name}</td>
                <td>
                  <span className={`rm-pill ${x.state}`}>{x.state}</span>
                </td>
                <td>{x.detail}</td>
                <td>{x.pid || "—"}</td>
                <td>{x.restarts ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </article>
      </>
    );
  return (
    <>
      <article className="rm-panel">
        <h2>Connected storage</h2>
        <Table
          headers={[
            "Mount / device",
            "Identity",
            "Used",
            "Free",
            "Free inodes",
          ]}
        >
          {s.disks.map((d) => (
            <tr key={d.id}>
              <td>
                <strong>{d.mount}</strong>
                <small>{d.device}</small>
              </td>
              <td>
                <span
                  className={`rm-pill ${d.valid ? "healthy" : "unavailable"}`}
                >
                  {d.valid
                    ? "Verified"
                    : d.expected
                      ? "Mount invalid"
                      : "Disconnected"}
                </span>
                <small>{d.uuid ?? "No UUID"}</small>
              </td>
              <td>
                {d.bytes
                  ? valueLabel(d.bytes - d.free, "bytes")
                  : "Unavailable"}
              </td>
              <td>{d.bytes ? valueLabel(d.free, "bytes") : "Unavailable"}</td>
              <td>{valueLabel(d.inodesFree, "count")}</td>
            </tr>
          ))}
        </Table>
      </article>
      <MetricTable
        title="Host readings"
        snapshot={s}
        filter={(m) =>
          !["application", "database", "workflows", "fpm"].includes(m.source)
        }
      />
    </>
  );
}
function MetricTable({
  title,
  snapshot,
  filter,
}: {
  title: string;
  snapshot: Snapshot;
  filter: (m: Snapshot["metrics"][number]) => boolean;
}) {
  return (
    <article className="rm-panel">
      <h2>{title}</h2>
      <div className="rm-readings">
        {snapshot.metrics.filter(filter).map((m) => (
          <div key={m.key}>
            <span>{m.label}</span>
            <strong>{valueLabel(m.value, m.unit)}</strong>
            <small>
              {snapshot.sources.find((s) => s.id === m.source)?.status ??
                m.source}
            </small>
          </div>
        ))}
      </div>
    </article>
  );
}
