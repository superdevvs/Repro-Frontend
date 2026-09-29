import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardShootSummary, DashboardWorkflow } from "@/types/dashboard";
import {
  PIPELINE_LIST_MAX_HEIGHT_PX,
  ProductionWorkflowBoard,
} from "./ProductionWorkflowBoard";

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

describe("ProductionWorkflowBoard layout fill", () => {
  it("exposes View all delivered for the ready column", () => {
    const onViewAllDelivered = vi.fn();
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
            key: "ready",
            label: "Ready / Delivered",
            accent: "#22c55e",
            count: 1,
            shoots: [
              shoot({
                id: 12,
                scheduledLocalDate: "2026-09-22",
                startTime: "2026-09-22T10:00:00.000000Z",
                deliveryDeadline: "2026-09-22T15:00:00.000Z",
                status: "delivered",
                workflowStatus: "delivered",
                addressLine: "100 Delivered Lane",
              }),
            ],
          },
        ])}
        onSelectShoot={() => undefined}
        onViewAllDelivered={onViewAllDelivered}
        filter="month"
      />,
    );

    expect(screen.getByText("Scheduled")).toBeVisible();
    expect(screen.getByRole("button", { name: "View all delivered" })).toBeVisible();
    screen.getByRole("button", { name: "View all delivered" }).click();
    expect(onViewAllDelivered).toHaveBeenCalledTimes(1);
  });

  it("marks pipeline columns for height-fill measurement", () => {
    const { container } = render(
      <ProductionWorkflowBoard
        workflow={workflow([
          {
            key: "booked",
            label: "Booked",
            accent: "#3b82f6",
            count: 1,
            shoots: [shoot()],
          },
        ])}
        onSelectShoot={() => undefined}
        filter="this_week"
      />,
    );

    expect(container.querySelector('[data-pipeline-column="booked"]')).not.toBeNull();
    expect(container.querySelector('[data-pipeline-shoot-card="true"]')).not.toBeNull();
    // jsdom has no matchMedia → compact=false → desktop fill layout.
    expect(container.querySelector('[data-pipeline-board="desktop"]')).not.toBeNull();
  });
});

describe("ProductionWorkflowBoard stage scroll", () => {
  it("renders every stage card so overflow scroll can reach jobs beyond the old ~6 cap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 29, 12));

    const shoots = Array.from({ length: 15 }, (_, index) =>
      shoot({
        id: 200 + index,
        addressLine: `Pipeline Scroll Address ${index + 1}`,
        scheduledLocalDate: "2026-09-30",
        startTime: "2026-09-30T10:00:00.000000Z",
      }),
    );

    const { container } = render(
      <ProductionWorkflowBoard
        workflow={workflow([
          {
            key: "booked",
            label: "Booked",
            accent: "#3b82f6",
            count: shoots.length,
            shoots,
          },
        ])}
        onSelectShoot={() => undefined}
        filter="this_week"
      />,
    );

    expect(screen.getByText("15")).toBeVisible();
    expect(container.querySelectorAll('[data-pipeline-shoot-card="true"]')).toHaveLength(15);
    const list = container.querySelector('[data-pipeline-column-list="booked"]');
    expect(list).not.toBeNull();
    expect(list?.className).toContain("overflow-y-auto");
    expect(list?.className).toContain("no-scrollbar");
    expect(list).toHaveStyle({ maxHeight: `${PIPELINE_LIST_MAX_HEIGHT_PX}px` });
  });
});
