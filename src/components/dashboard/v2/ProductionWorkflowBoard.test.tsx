import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardShootSummary, DashboardWorkflow } from "@/types/dashboard";
import { ProductionWorkflowBoard } from "./ProductionWorkflowBoard";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const shoot = (overrides: Partial<DashboardShootSummary> = {}): DashboardShootSummary =>
  ({
    id: 91,
    dayLabel: "Upcoming",
    timeLabel: "10:00 AM",
    scheduledLocalDate: "2026-10-05",
    startTime: "2026-10-05T10:00:00.000000Z",
    addressLine: "5629 Herberts Crossing Drive",
    cityStateZip: "Burke, Virginia, 22015",
    status: "scheduled",
    workflowStatus: "scheduled",
    clientName: "Elizabeth Ann Kline",
    isFlagged: false,
    services: [],
    photographer: { id: 3, name: "Jaz Singh" },
    ...overrides,
  }) as DashboardShootSummary;

const workflow = (columns: DashboardWorkflow["columns"]): DashboardWorkflow => ({ columns });

describe("ProductionWorkflowBoard pipeline dates", () => {
  it("shows a future scheduled shoot while This Week is selected", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 19, 12));

    render(
      <ProductionWorkflowBoard
        workflow={workflow([
          {
            key: "booked",
            label: "Booked",
            accent: "#3b82f6",
            count: 1,
            shoots: [shoot()],
          },
          {
            key: "uploaded",
            label: "Photos Uploaded",
            accent: "#0ea5e9",
            count: 0,
            shoots: [],
          },
          {
            key: "editing",
            label: "Editing",
            accent: "#a855f7",
            count: 0,
            shoots: [],
          },
          {
            key: "ready",
            label: "Ready / Delivered",
            accent: "#22c55e",
            count: 1,
            shoots: [
              shoot({
                id: 11,
                scheduledLocalDate: "2026-09-18",
                startTime: "2026-09-18T10:00:00.000000Z",
                deliveryDeadline: "2026-09-11T15:17:00.000Z",
                status: "delivered",
                workflowStatus: "delivered",
                addressLine: "315 Kahler Way",
                clientName: "Shubham Jon",
              }),
            ],
          },
        ])}
        onSelectShoot={() => undefined}
        filter="this_week"
      />,
    );

    expect(screen.getByText("5629 Herberts Crossing Drive")).toBeVisible();
    expect(screen.getByText("1")).toBeVisible();
    expect(screen.queryByText("315 Kahler Way")).not.toBeInTheDocument();
  });
});
