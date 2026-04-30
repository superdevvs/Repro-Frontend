import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Flag,
  MessageSquare,
  UploadCloud,
  UserPlus,
} from "lucide-react";
import { endOfMonth, startOfMonth } from "date-fns";

import type { DashboardMetricTile } from "@/components/dashboard/v2/RoleMetricTilesCard";
import type {
  DashboardClientRequest,
  DashboardShootSummary,
} from "@/types/dashboard";
import type { ClientBillingSummary } from "@/types/clientBilling";
import type { ShootData } from "@/types/shoots";
import type { EditingRequest } from "@/services/editingRequestService";
import type { ClientShootRecord } from "@/utils/dashboardDerivedUtils";
import {
  DELIVERED_STATUS_KEYWORDS,
  filterDeliveredShoots,
  getStatusKey,
  HOLD_STATUS_KEYWORDS,
  matchesStatus,
  REQUESTED_STATUS_KEYWORDS,
} from "@/utils/dashboardDerivedUtils";

import { ACTIVE_CLIENT_REQUEST_STATUSES } from "../constants";
import type { MobileDashboardTab } from "../types";
import { buildShootHistoryPath, isDateWithinRange } from "../utils";

type CanFn = (resource: string, action: string, conditions?: Record<string, any>) => boolean;
type ScrollToDashboardSection = (
  sectionId: string,
  fallback?: {
    title: string;
    description: string;
  },
) => boolean;

const useDashboardMetricCounters = () => {
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  const countSummariesThisMonth = useCallback(
    (
      summaries: DashboardShootSummary[],
      getDate: (summary: DashboardShootSummary) => string | null | undefined = (summary) =>
        summary.startTime,
    ) =>
      summaries.filter((summary) =>
        isDateWithinRange(getDate(summary), currentMonthStart, currentMonthEnd),
      ).length,
    [currentMonthEnd, currentMonthStart],
  );

  const countShootsThisMonth = useCallback(
    (
      sourceShoots: ShootData[],
      getDate: (shoot: ShootData) => string | null | undefined = (shoot) =>
        shoot.completedDate || shoot.scheduledDate,
    ) =>
      sourceShoots.filter((shoot) =>
        isDateWithinRange(getDate(shoot), currentMonthStart, currentMonthEnd),
      ).length,
    [currentMonthEnd, currentMonthStart],
  );

  return { countShootsThisMonth, countSummariesThisMonth };
};

const useShootHistoryNavigation = (navigate: NavigateFunction) =>
  useCallback(
    (
      tab: "scheduled" | "completed" | "delivered" | "hold" | "editing" | "edited",
      options?: { range?: "mtd" },
    ) => {
      navigate(buildShootHistoryPath(tab, options));
    },
    [navigate],
  );

const useActiveRequestCounts = (
  clientRequests: DashboardClientRequest[],
  editingRequests: EditingRequest[],
) => {
  const activeClientRequestCount = useMemo(
    () => clientRequests.filter((request) => ACTIVE_CLIENT_REQUEST_STATUSES.has(request.status)).length,
    [clientRequests],
  );
  const activeEditingRequestCount = useMemo(
    () => editingRequests.filter((request) => request.status !== "completed").length,
    [editingRequests],
  );

  return { activeClientRequestCount, activeEditingRequestCount };
};

export const useAdminDashboardMetrics = ({
  allSummaries,
  cancellationRequestCount,
  clientRequests,
  editingRequests,
  isMobile,
  navigate,
  scrollToDashboardSection,
  setCancellationDialogOpen,
  setMobileDashboardTab,
}: {
  allSummaries: DashboardShootSummary[];
  cancellationRequestCount: number;
  clientRequests: DashboardClientRequest[];
  editingRequests: EditingRequest[];
  isMobile: boolean;
  navigate: NavigateFunction;
  scrollToDashboardSection: ScrollToDashboardSection;
  setCancellationDialogOpen: Dispatch<SetStateAction<boolean>>;
  setMobileDashboardTab: Dispatch<SetStateAction<MobileDashboardTab>>;
}) => {
  const { countSummariesThisMonth } = useDashboardMetricCounters();
  const openShootHistory = useShootHistoryNavigation(navigate);
  const { activeClientRequestCount, activeEditingRequestCount } = useActiveRequestCounts(
    clientRequests,
    editingRequests,
  );
  const totalAdminPendingRequestCount = useMemo(
    () => activeClientRequestCount + activeEditingRequestCount + cancellationRequestCount,
    [activeClientRequestCount, activeEditingRequestCount, cancellationRequestCount],
  );
  const adminDeliveredSummaries = useMemo(() => filterDeliveredShoots(allSummaries), [allSummaries]);

  return useMemo<DashboardMetricTile[]>(
    () => [
      {
        id: "admin-total-shoots-month",
        value: countSummariesThisMonth(allSummaries),
        label: "Total shoots",
        subtitle: "This month",
        icon: <CalendarDays size={16} />,
        accent:
          "from-slate-50 via-emerald-50/85 to-teal-100/70 text-emerald-900 dark:from-[#173934] dark:via-[#112431] dark:to-[#09101d] dark:text-white",
        onClick: () => openShootHistory("scheduled", { range: "mtd" }),
      },
      {
        id: "admin-total-deliveries-month",
        value: countSummariesThisMonth(
          adminDeliveredSummaries,
          (summary) => summary.deliveryDeadline || summary.startTime,
        ),
        label: "Total deliveries",
        subtitle: "This month",
        icon: <CheckCircle2 size={16} />,
        accent:
          "from-slate-50 via-sky-50/85 to-blue-100/70 text-sky-900 dark:from-[#19384a] dark:via-[#122534] dark:to-[#09101d] dark:text-white",
        onClick: () => openShootHistory("delivered", { range: "mtd" }),
      },
      {
        id: "admin-cancelled-shoots",
        value: cancellationRequestCount,
        label: "Cancelled shoots",
        icon: <Flag size={16} />,
        accent:
          "from-slate-50 via-rose-50/85 to-fuchsia-100/65 text-rose-900 dark:from-[#2f2438] dark:via-[#1d1828] dark:to-[#0b0f1b] dark:text-white",
        onClick: () => setCancellationDialogOpen(true),
      },
      {
        id: "admin-pending-requests",
        value: totalAdminPendingRequestCount,
        label: "Pending requests",
        icon: <MessageSquare size={16} />,
        accent:
          "from-slate-50 via-amber-50/80 to-orange-100/70 text-amber-900 dark:from-[#342d29] dark:via-[#201b21] dark:to-[#0a101b] dark:text-white",
        onClick: () => {
          if (isMobile) {
            setMobileDashboardTab("requests");
            setTimeout(() => {
              scrollToDashboardSection("requests-queue");
            }, 150);
            return;
          }
          scrollToDashboardSection("requests-queue", {
            title: "No requests",
            description: "All requests are clear right now.",
          });
        },
      },
    ],
    [
      adminDeliveredSummaries,
      allSummaries,
      cancellationRequestCount,
      countSummariesThisMonth,
      isMobile,
      openShootHistory,
      scrollToDashboardSection,
      setCancellationDialogOpen,
      setMobileDashboardTab,
      totalAdminPendingRequestCount,
    ],
  );
};

export const useSalesDashboardMetrics = ({
  can,
  navigate,
  repDelivered,
  repSourceShoots,
  repVisibleSummaries,
  scrollToDashboardSection,
}: {
  can: CanFn;
  navigate: NavigateFunction;
  repDelivered: DashboardShootSummary[];
  repSourceShoots: ShootData[];
  repVisibleSummaries: DashboardShootSummary[];
  scrollToDashboardSection: ScrollToDashboardSection;
}) => {
  const { countShootsThisMonth } = useDashboardMetricCounters();
  const openShootHistory = useShootHistoryNavigation(navigate);
  const salesPendingAssignmentsCount = useMemo(
    () =>
      repVisibleSummaries.filter((shoot) => {
        const statusKey = getStatusKey(shoot);
        if (matchesStatus(shoot, DELIVERED_STATUS_KEYWORDS)) return false;
        if (matchesStatus(shoot, HOLD_STATUS_KEYWORDS)) return false;
        return !shoot.photographer && !REQUESTED_STATUS_KEYWORDS.some((keyword) => statusKey.includes(keyword));
      }).length,
    [repVisibleSummaries],
  );
  const salesFollowUpCount = useMemo(
    () =>
      repVisibleSummaries.filter((shoot) => {
        const statusKey = getStatusKey(shoot);
        return (
          shoot.isFlagged ||
          HOLD_STATUS_KEYWORDS.some((keyword) => statusKey.includes(keyword)) ||
          REQUESTED_STATUS_KEYWORDS.some((keyword) => statusKey.includes(keyword))
        );
      }).length,
    [repVisibleSummaries],
  );

  return useMemo<DashboardMetricTile[]>(
    () => [
      {
        id: "sales-booked-month",
        value: countShootsThisMonth(repSourceShoots, (shoot) => shoot.scheduledDate),
        label: "Shoots booked",
        subtitle: "This month",
        icon: <CalendarDays size={16} />,
        accent:
          "from-slate-50 via-emerald-50/85 to-teal-100/70 text-emerald-900 dark:from-[#173934] dark:via-[#112431] dark:to-[#09101d] dark:text-white",
        onClick: () => openShootHistory("scheduled", { range: "mtd" }),
      },
      {
        id: "sales-pending-assignments",
        value: salesPendingAssignmentsCount,
        label: "Pending assignments",
        subtitle: "Needs a photographer",
        icon: <UserPlus size={16} />,
        accent:
          "from-slate-50 via-sky-50/85 to-blue-100/70 text-sky-900 dark:from-[#19384a] dark:via-[#122534] dark:to-[#09101d] dark:text-white",
        onClick: () => {
          scrollToDashboardSection("assign-card", {
            title: "No assignments pending",
            description: "All visible shoots have coverage right now.",
          });
        },
      },
      {
        id: "sales-completed-deliveries",
        value: repDelivered.length,
        label: "Completed deliveries",
        subtitle: "Client-ready",
        icon: <CheckCircle2 size={16} />,
        accent:
          "from-slate-50 via-violet-50/85 to-indigo-100/70 text-violet-900 dark:from-[#3d315d] dark:via-[#1e1a32] dark:to-[#0b0f1c] dark:text-white",
        onClick: () => openShootHistory("delivered"),
      },
      {
        id: "sales-follow-ups",
        value: salesFollowUpCount,
        label: "Client follow-ups",
        subtitle: can("messaging-email", "view") ? "Unread or pending" : "Needs attention",
        icon: <MessageSquare size={16} />,
        accent:
          "from-slate-50 via-amber-50/80 to-orange-100/70 text-amber-900 dark:from-[#342d29] dark:via-[#201b21] dark:to-[#0a101b] dark:text-white",
        onClick: () =>
          can("messaging-email", "view")
            ? navigate("/messaging/email/inbox")
            : openShootHistory("hold"),
      },
    ],
    [
      can,
      countShootsThisMonth,
      navigate,
      openShootHistory,
      repDelivered.length,
      repSourceShoots,
      salesFollowUpCount,
      salesPendingAssignmentsCount,
      scrollToDashboardSection,
    ],
  );
};

export const useClientDashboardMetrics = ({
  clientBillingSummary,
  clientCompletedRecords,
  clientOnHoldRecords,
  clientShoots,
  navigate,
}: {
  clientBillingSummary: ClientBillingSummary;
  clientCompletedRecords: ClientShootRecord[];
  clientOnHoldRecords: ClientShootRecord[];
  clientShoots: ShootData[];
  navigate: NavigateFunction;
}) => {
  const { countShootsThisMonth } = useDashboardMetricCounters();
  const openShootHistory = useShootHistoryNavigation(navigate);
  const clientDueInvoiceCount = clientBillingSummary.dueNow.count;

  return useMemo<DashboardMetricTile[]>(
    () => [
      {
        id: "client-total-shoots-month",
        value: countShootsThisMonth(clientShoots, (shoot) => shoot.scheduledDate),
        label: "Total shoots",
        subtitle: "This month",
        icon: <CalendarDays size={16} />,
        accent:
          "from-slate-50 via-emerald-50/85 to-teal-100/70 text-emerald-900 dark:from-[#173934] dark:via-[#112431] dark:to-[#09101d] dark:text-white",
        onClick: () => openShootHistory("scheduled", { range: "mtd" }),
      },
      {
        id: "client-delivered-shoots",
        value: clientCompletedRecords.length,
        label: "Delivered shoots",
        subtitle: "Ready to use",
        icon: <CheckCircle2 size={16} />,
        accent:
          "from-slate-50 via-sky-50/85 to-blue-100/70 text-sky-900 dark:from-[#19384a] dark:via-[#122534] dark:to-[#09101d] dark:text-white",
        onClick: () => openShootHistory("delivered"),
      },
      {
        id: "client-on-hold",
        value: clientOnHoldRecords.length,
        label: "On-hold / cancelled",
        subtitle: "Needs attention",
        icon: <Flag size={16} />,
        accent:
          "from-slate-50 via-rose-50/85 to-fuchsia-100/65 text-rose-900 dark:from-[#2f2438] dark:via-[#1d1828] dark:to-[#0b0f1b] dark:text-white",
        onClick: () => openShootHistory("hold"),
      },
      {
        id: "client-due-invoices",
        value: clientDueInvoiceCount,
        label: "Due invoices",
        subtitle: "Payment required",
        icon: <CreditCard size={16} />,
        accent:
          "from-slate-50 via-amber-50/80 to-orange-100/70 text-amber-900 dark:from-[#342d29] dark:via-[#201b21] dark:to-[#0a101b] dark:text-white",
        onClick: () => navigate("/accounting"),
      },
    ],
    [
      clientCompletedRecords.length,
      clientDueInvoiceCount,
      clientOnHoldRecords.length,
      clientShoots,
      countShootsThisMonth,
      navigate,
      openShootHistory,
    ],
  );
};

export const useEditorDashboardMetrics = ({
  clientRequests,
  editingRequests,
  effectiveEditorDelivered,
  effectiveEditorSourceShoots,
  effectiveEditorUpcoming,
  navigate,
  scrollToDashboardSection,
}: {
  clientRequests: DashboardClientRequest[];
  editingRequests: EditingRequest[];
  effectiveEditorDelivered: DashboardShootSummary[];
  effectiveEditorSourceShoots: ShootData[];
  effectiveEditorUpcoming: DashboardShootSummary[];
  navigate: NavigateFunction;
  scrollToDashboardSection: ScrollToDashboardSection;
}) => {
  const openShootHistory = useShootHistoryNavigation(navigate);
  const { activeClientRequestCount, activeEditingRequestCount } = useActiveRequestCounts(
    clientRequests,
    editingRequests,
  );
  const editorOpenRequestCount = useMemo(
    () => activeClientRequestCount + activeEditingRequestCount,
    [activeClientRequestCount, activeEditingRequestCount],
  );

  return useMemo<DashboardMetricTile[]>(
    () => [
      {
        id: "editor-total-assigned",
        value: effectiveEditorSourceShoots.length,
        label: "Total edits assigned",
        subtitle: "All assigned jobs",
        icon: <FileText size={16} />,
        accent:
          "from-slate-50 via-emerald-50/85 to-teal-100/70 text-emerald-900 dark:from-[#173934] dark:via-[#112431] dark:to-[#09101d] dark:text-white",
        onClick: () => openShootHistory("editing"),
      },
      {
        id: "editor-in-progress",
        value: effectiveEditorUpcoming.length,
        label: "In progress edits",
        subtitle: "Active queue",
        icon: <UploadCloud size={16} />,
        accent:
          "from-slate-50 via-sky-50/85 to-blue-100/70 text-sky-900 dark:from-[#19384a] dark:via-[#122534] dark:to-[#09101d] dark:text-white",
        onClick: () => openShootHistory("editing"),
      },
      {
        id: "editor-delivered",
        value: effectiveEditorDelivered.length,
        label: "Delivered edits",
        subtitle: "Recently published",
        icon: <CheckCircle2 size={16} />,
        accent:
          "from-slate-50 via-violet-50/85 to-indigo-100/70 text-violet-900 dark:from-[#3d315d] dark:via-[#1e1a32] dark:to-[#0b0f1c] dark:text-white",
        onClick: () => openShootHistory("delivered"),
      },
      {
        id: "editor-revision-requests",
        value: editorOpenRequestCount,
        label: "Open requests",
        subtitle: "Needs response",
        icon: <MessageSquare size={16} />,
        accent:
          "from-slate-50 via-amber-50/80 to-orange-100/70 text-amber-900 dark:from-[#342d29] dark:via-[#201b21] dark:to-[#0a101b] dark:text-white",
        onClick: () =>
          scrollToDashboardSection("editing-requests", {
            title: "No active requests",
            description: "Open editor requests will show up here when they need attention.",
          }),
      },
    ],
    [
      effectiveEditorDelivered.length,
      effectiveEditorSourceShoots.length,
      effectiveEditorUpcoming.length,
      editorOpenRequestCount,
      openShootHistory,
      scrollToDashboardSection,
    ],
  );
};
