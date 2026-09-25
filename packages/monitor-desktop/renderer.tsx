import React from "react";
import { createRoot } from "react-dom/client";
import type { MonitorClient, Snapshot } from "@repro/monitor-contracts";
import MonitorDashboard from "../../src/features/server-monitor/MonitorDashboard";
import "../../src/index.css";
declare global {
  interface Window {
    reproMonitor: {
      request: <T>(
        path: string,
        init?: { method?: string; body?: unknown },
      ) => Promise<T>;
      subscribe: (
        handler: (event: { kind: string; data: unknown }) => void,
      ) => () => void;
    };
  }
}
const client: MonitorClient = {
  request: (path, init) => window.reproMonitor.request(path, init),
  subscribe: (snapshot, error, ai) =>
    window.reproMonitor.subscribe((event) => {
      if (event.kind === "snapshot") snapshot(event.data as Snapshot);
      else if (event.kind === "ai") ai?.(event.data);
      else if (event.kind === "error") error(String(event.data));
    }),
};
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MonitorDashboard client={client} desktop />
  </React.StrictMode>,
);
