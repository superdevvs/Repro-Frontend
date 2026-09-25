import React, { Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import SystemOverviewTab from "@/components/settings/SystemOverviewTab";
import { browserMonitorClient } from "./client";
const MonitorDashboard = React.lazy(() => import("./MonitorDashboard"));
export default function OverviewWithServer() {
  const [params, setParams] = useSearchParams();
  const server = params.get("view") === "server";
  const client = useMemo(() => browserMonitorClient(), []);
  return (
    <>
      <div
        className="mb-4 flex gap-2"
        role="tablist"
        aria-label="Overview views"
      >
        {["Application", "Server"].map((label) => (
          <button
            key={label}
            role="tab"
            aria-selected={server === (label === "Server")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${server === (label === "Server") ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("view", label === "Server" ? "server" : "application");
              setParams(next, { replace: true });
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {server ? (
        <Suspense fallback={<p>Loading server monitor…</p>}>
          <MonitorDashboard client={client} />
        </Suspense>
      ) : (
        <SystemOverviewTab />
      )}
    </>
  );
}
