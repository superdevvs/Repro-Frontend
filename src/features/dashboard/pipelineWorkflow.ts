import type { DashboardShootSummary, DashboardWorkflow } from "@/types/dashboard";
import {
  DELIVERED_STATUS_KEYWORDS,
  filterDeliveredShoots,
  filterReadyToDeliverShoots,
  filterScheduledShoots,
  filterUploadedShoots,
  getStatusKey,
  matchesStatus,
} from "@/utils/dashboardDerivedUtils";
import { getDashboardShootDisplayDate } from "@/utils/dashboardShootSchedule";
import { endOfWeek, startOfDay, startOfWeek } from "date-fns";

export type PipelineFilter = "today" | "this_week" | "month";

export const DEFAULT_PIPELINE_COLUMNS = [
  { key: "booked", label: "Scheduled", accent: "#3b82f6" },
  { key: "uploaded", label: "Photos Uploaded", accent: "#0ea5e9" },
  { key: "editing", label: "Editing", accent: "#a855f7" },
  { key: "ready", label: "Ready / Delivered", accent: "#22c55e" },
] as const;

const WIP_COLUMN_KEYS = new Set(["booked", "scheduled", "uploaded", "raw_upload", "editing"]);
const READY_COLUMN_KEYS = new Set(["ready", "delivered"]);

export const isWipPipelineColumn = (columnKey: string): boolean =>
  WIP_COLUMN_KEYS.has((columnKey || "").toLowerCase());

export const isReadyPipelineColumn = (columnKey: string): boolean =>
  READY_COLUMN_KEYS.has((columnKey || "").toLowerCase());

export const isEditingShoot = (shoot: DashboardShootSummary): boolean => {
  const status = getStatusKey(shoot);
  return status === "editing" || status === "review";
};

const parseTimestamp = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getPipelineColumnFilterDate = (
  shoot: DashboardShootSummary,
  columnKey: string,
): Date | null => {
  if (isReadyPipelineColumn(columnKey)) {
    return (
      parseTimestamp(shoot.deliveryDeadline) ??
      parseTimestamp(shoot.submittedForReviewAt) ??
      getDashboardShootDisplayDate(shoot)
    );
  }
  return getDashboardShootDisplayDate(shoot);
};

export const shootMatchesPipelineDateFilter = (
  shoot: DashboardShootSummary,
  columnKey: string,
  filter: PipelineFilter,
  now: Date = new Date(),
): boolean => {
  if (isWipPipelineColumn(columnKey)) return true;

  const shootDate = getPipelineColumnFilterDate(shoot, columnKey);
  if (!shootDate) return true;

  const today = startOfDay(now);

  switch (filter) {
    case "today":
      return startOfDay(shootDate).getTime() === today.getTime();
    case "this_week": {
      const weekStart = startOfWeek(now, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
      return shootDate >= weekStart && shootDate <= weekEnd;
    }
    case "month": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return shootDate >= monthStart && shootDate <= monthEnd;
    }
    default:
      return true;
  }
};

export const filterPipelineColumnShoots = (
  shoots: DashboardShootSummary[],
  columnKey: string,
  filter: PipelineFilter,
  now: Date = new Date(),
): DashboardShootSummary[] =>
  shoots.filter((shoot) => shootMatchesPipelineDateFilter(shoot, columnKey, filter, now));

const mergeById = (
  primary: DashboardShootSummary[],
  extra: DashboardShootSummary[],
): DashboardShootSummary[] => {
  const map = new Map<number, DashboardShootSummary>();
  primary.forEach((shoot) => map.set(shoot.id, shoot));
  extra.forEach((shoot) => {
    if (!map.has(shoot.id)) map.set(shoot.id, shoot);
  });
  return Array.from(map.values());
};

const extrasForColumn = (
  columnKey: string,
  allSummaries: DashboardShootSummary[],
): DashboardShootSummary[] => {
  const key = (columnKey || "").toLowerCase();
  if (key === "booked" || key === "scheduled") return filterScheduledShoots(allSummaries);
  if (key === "uploaded" || key === "raw_upload") return filterUploadedShoots(allSummaries);
  if (key === "editing") return allSummaries.filter(isEditingShoot);
  if (key === "ready" || key === "delivered") {
    return mergeById(filterReadyToDeliverShoots(allSummaries), filterDeliveredShoots(allSummaries));
  }
  return [];
};

export const buildPipelineWorkflow = (
  workflow: DashboardWorkflow | null | undefined,
  allSummaries: DashboardShootSummary[] = [],
): DashboardWorkflow | null => {
  const sourceColumns = Array.isArray(workflow?.columns) ? workflow.columns : [];
  const columns = sourceColumns.length
    ? sourceColumns
    : DEFAULT_PIPELINE_COLUMNS.map((column) => ({
        key: column.key,
        label: column.label,
        accent: column.accent,
        count: 0,
        shoots: [] as DashboardShootSummary[],
      }));

  if (!sourceColumns.length && allSummaries.length === 0) {
    return workflow ?? null;
  }

  const nextColumns = columns.map((column) => {
    const colKey = (column.key || "").toLowerCase();
    const existing = Array.isArray(column.shoots) ? column.shoots : [];
    let shoots = mergeById(existing, extrasForColumn(colKey, allSummaries));

    if (!isReadyPipelineColumn(colKey)) {
      shoots = shoots.filter((shoot) => !matchesStatus(shoot, DELIVERED_STATUS_KEYWORDS));
    }

    return {
      ...column,
      shoots,
      count: shoots.length,
    };
  });

  return { columns: nextColumns };
};
