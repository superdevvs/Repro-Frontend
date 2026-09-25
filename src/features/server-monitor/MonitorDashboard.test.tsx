import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { MonitorClient, Snapshot } from "@repro/monitor-contracts";
import MonitorDashboard from "./MonitorDashboard";
import { hasMonitorRole } from "./client";
vi.mock("./MonitorChart", () => ({
  MonitorChart: () => <div>Chart fixture</div>,
}));
vi.mock("@/services/api", () => ({ apiClient: { post: vi.fn() } }));
const fixture: Snapshot = {
  version: 1,
  hostname: "fixture-host",
  generatedAt: new Date().toISOString(),
  metrics: [
    {
      key: "cpu_percent",
      label: "CPU usage",
      value: 12,
      unit: "%",
      source: "host",
    },
  ],
  sources: [
    {
      id: "host",
      label: "Host resources",
      status: "healthy",
      observedAt: new Date().toISOString(),
      intervalMs: 5000,
    },
    {
      id: "gpu",
      label: "NVIDIA GPU",
      status: "unavailable",
      observedAt: null,
      intervalMs: 300000,
      detail: "Driver/library version mismatch",
    },
  ],
  services: [],
  disks: [],
  queues: [],
  schedules: [],
  usage: [],
  incidents: [],
  markers: [],
};
afterEach(cleanup);
describe("server monitoring interface", () => {
  it("recognizes only primary or secondary superadmin roles", () => {
    for (const role of ["superadmin", "super_admin", "super-admin"])
      expect(hasMonitorRole(role)).toBe(true);
    expect(hasMonitorRole("photographer", ["superadmin"])).toBe(true);
    for (const role of ["admin", "salesRep", "client", ""])
      expect(hasMonitorRole(role)).toBe(false);
  });
  it("keeps host readings visible without Laravel and explicitly shows collection errors", async () => {
    const stop = vi.fn();
    const client: MonitorClient = {
      request: vi.fn(),
      subscribe: (onSnapshot) => {
        onSnapshot(fixture);
        return stop;
      },
    };
    const { unmount } = render(<MonitorDashboard client={client} desktop />);
    expect(await screen.findByText(/fixture-host/)).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Coverage" }));
    expect(
      await screen.findByText("Driver/library version mismatch"),
    ).toBeInTheDocument();
    expect(screen.getByText("unavailable")).toBeInTheDocument();
    unmount();
    expect(stop).toHaveBeenCalled();
  });
  it("shows a disconnected state when the independent gateway cannot be reached", async () => {
    const client: MonitorClient = {
      request: vi.fn(),
      subscribe: (_onSnapshot, onError) => {
        onError("Local monitoring service unavailable");
        return () => {};
      },
    };
    render(<MonitorDashboard client={client} />);
    await waitFor(() =>
      expect(screen.getByText("Disconnected")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Local monitoring service unavailable/),
    ).toBeInTheDocument();
  });
});
