import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardShootSummary, DashboardWorkflow } from "@/types/dashboard";
import {
  buildPipelineWorkflow,
  filterPipelineColumnShoots,
  isEditingShoot,
} from "./pipelineWorkflow";

afterEach(() => {
  vi.useRealTimers();
});

const now = new Date(2026, 8, 19, 12);

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
    ...overrides,
  }) as DashboardShootSummary;

describe("filterPipelineColumnShoots", () => {
  it("keeps a next-month scheduled shoot in the booked column for This Week and Month", () => {
    const shoots = [shoot()];

    expect(filterPipelineColumnShoots(shoots, "booked", "this_week", now).map((item) => item.id)).toEqual([91]);
    expect(filterPipelineColumnShoots(shoots, "booked", "month", now).map((item) => item.id)).toEqual([91]);
    expect(filterPipelineColumnShoots(shoots, "booked", "today", now).map((item) => item.id)).toEqual([91]);
  });

  it("keeps uploaded and editing jobs whose booked day is outside the selected window", () => {
    const uploaded = shoot({
      id: 20,
      scheduledLocalDate: "2026-08-01",
      startTime: "2026-08-01T10:00:00.000000Z",
      status: "uploaded",
      workflowStatus: "uploaded",
      addressLine: "Uploaded last month",
    });
    const editing = shoot({
      id: 21,
      scheduledLocalDate: "2026-07-15",
      startTime: "2026-07-15T10:00:00.000000Z",
      status: "editing",
      workflowStatus: "editing",
      addressLine: "Still editing",
    });

    expect(filterPipelineColumnShoots([uploaded], "uploaded", "this_week", now)).toEqual([uploaded]);
    expect(filterPipelineColumnShoots([editing], "editing", "month", now)).toEqual([editing]);
  });

  it("filters ready jobs by delivery time, not the original shoot day", () => {
    const deliveredLastWeek = shoot({
      id: 11,
      scheduledLocalDate: "2026-09-18",
      startTime: "2026-09-18T10:00:00.000000Z",
      deliveryDeadline: "2026-09-11T15:17:00.000Z",
      status: "delivered",
      workflowStatus: "delivered",
      addressLine: "315 Kahler Way",
    });
    const deliveredThisWeek = shoot({
      id: 12,
      scheduledLocalDate: "2026-08-20",
      startTime: "2026-08-20T10:00:00.000000Z",
      deliveryDeadline: "2026-09-16T14:00:00.000Z",
      status: "ready",
      workflowStatus: "ready",
      addressLine: "Delivered this week",
    });

    expect(filterPipelineColumnShoots([deliveredLastWeek, deliveredThisWeek], "ready", "this_week", now).map((item) => item.id)).toEqual([12]);
    expect(filterPipelineColumnShoots([deliveredLastWeek], "ready", "month", now).map((item) => item.id)).toEqual([11]);
  });
});

describe("buildPipelineWorkflow", () => {
  it("fills an empty booked column from the same scheduled shoots the upcoming card uses", () => {
    const workflow: DashboardWorkflow = {
      columns: [
        { key: "booked", label: "Booked", accent: "#3b82f6", count: 0, shoots: [] },
        { key: "uploaded", label: "Photos Uploaded", accent: "#0ea5e9", count: 0, shoots: [] },
        { key: "editing", label: "Editing", accent: "#a855f7", count: 0, shoots: [] },
        { key: "ready", label: "Ready / Delivered", accent: "#22c55e", count: 0, shoots: [] },
      ],
    };

    const built = buildPipelineWorkflow(workflow, [shoot()]);

    expect(built?.columns.find((column) => column.key === "booked")?.shoots.map((item) => item.addressLine)).toEqual([
      "5629 Herberts Crossing Drive",
    ]);
  });

  it("synthesizes pipeline columns when overview workflow data is missing", () => {
    const built = buildPipelineWorkflow(null, [
      shoot(),
      shoot({
        id: 22,
        status: "editing",
        workflowStatus: "editing",
        addressLine: "In editing",
      }),
    ]);

    expect(built?.columns.map((column) => [column.key, column.shoots.length])).toEqual([
      ["booked", 1],
      ["uploaded", 0],
      ["editing", 1],
      ["ready", 0],
    ]);
  });

  it("does not keep delivered jobs in the booked column", () => {
    const built = buildPipelineWorkflow(
      {
        columns: [
          {
            key: "booked",
            label: "Booked",
            accent: "#3b82f6",
            count: 1,
            shoots: [shoot({ id: 5, status: "delivered", workflowStatus: "delivered" })],
          },
        ],
      },
      [],
    );

    expect(built?.columns[0].shoots).toEqual([]);
  });
});

describe("isEditingShoot", () => {
  it("matches editing and rejects uploaded or delivered aliases", () => {
    expect(isEditingShoot(shoot({ workflowStatus: "editing", status: "editing" }))).toBe(true);
    expect(isEditingShoot(shoot({ workflowStatus: "review", status: "review" }))).toBe(true);
    expect(isEditingShoot(shoot({ workflowStatus: "editing_complete", status: "editing_complete" }))).toBe(false);
    expect(isEditingShoot(shoot({ workflowStatus: "ready", status: "ready" }))).toBe(false);
  });
});
