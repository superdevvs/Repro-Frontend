import { format, startOfDay, differenceInCalendarDays, parse, parseISO, isValid } from "date-fns";

import type {
  DashboardIssueItem,
  DashboardPhotographerSummary,
  DashboardShootServiceTag,
  DashboardShootSummary,
} from "@/types/dashboard";
import type { ShootData } from "@/types/shoots";
import type { UserData } from "@/types/auth";
import { getStateFullName } from "@/utils/stateUtils";

// Only exclude delivered/finalized shoots from dashboard
// Keep uploaded, editing, review visible until delivered
export const DELIVERED_STATUS_KEYWORDS = [
  "delivered",
  "ready_for_client",
  "client_delivered",
  "admin_verified", // Maps to delivered
  "ready", // Maps to delivered
  "workflow_completed", // Maps to delivered
];
export const CANCELED_STATUS_KEYWORDS = ["canceled", "cancelled", "no_show"];
export const DECLINED_STATUS_KEYWORDS = ["declined"];
export const REQUESTED_STATUS_KEYWORDS = ["requested"];
export const PENDING_REVIEW_KEYWORDS = [
  "pending_review",
  "pending review",
  "qc",
  "awaiting_review",
  "needs_review",
  "review",
];
export const HOLD_STATUS_KEYWORDS = [
  "hold",
  "issue",
  "pending_payment",
  "awaiting_client",
  "needs_client_action",
  "on_hold",
];
// Legacy completed status - can mean uploaded (not delivered) or delivered, so we check it separately
export const COMPLETED_STATUS_KEYWORDS = ["completed", "editing_complete"];

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const toNumericId = (value?: string | number | null, fallback?: string): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    return hashString(value);
  }
  if (fallback) return hashString(fallback);
  return hashString("repro-fallback");
};

export const doesShootBelongToClient = (shoot: ShootData, client?: UserData | null) => {
  if (!client) return false;
  // Primary check: match by client ID (most reliable)
  const idMatch = shoot.client?.id && client.id && String(shoot.client.id) === String(client.id);
  if (idMatch) return true;
  // Fallback checks for legacy data
  const emailMatch = shoot.client?.email && client.email && shoot.client.email === client.email;
  const nameMatch = shoot.client?.name && client.name && shoot.client.name === client.name;
  const companyMatch = shoot.client?.company && client.company && shoot.client.company === client.company;
  return Boolean(emailMatch || nameMatch || companyMatch);
};

export const getGreetingPrefix = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Hi";
};

export const parseShootDateTime = (shoot: ShootData): Date | null => {
  if (!shoot.scheduledDate) return null;

  // Normalize scheduledDate to just the date portion (YYYY-MM-DD)
  // Backend may return "2026-01-13 00:00:00" or "2026-01-13T00:00:00Z" or just "2026-01-13"
  const dateOnly = shoot.scheduledDate.split(/[T\s]/)[0];

  const patterns = ["yyyy-MM-dd h:mm aa", "yyyy-MM-dd hh:mm aa", "yyyy-MM-dd HH:mm", "yyyy-MM-dd H:mm"];
  if (shoot.time) {
    // Normalize time - remove any extra spaces and handle various formats
    const normalizedTime = shoot.time.trim();
    for (const pattern of patterns) {
      const parsed = parse(`${dateOnly} ${normalizedTime}`, pattern, new Date());
      if (isValid(parsed)) return parsed;
    }
  }
  const fallback = parseISO(dateOnly);
  return isValid(fallback) ? fallback : null;
};

export const getDayLabel = (date: Date | null) => {
  if (!date) return "Upcoming";
  const today = startOfDay(new Date());
  const diff = differenceInCalendarDays(startOfDay(date), today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return format(date, "EEEE");
  return format(date, "MMM d");
};

// Cache normalized services to avoid recalculation
const servicesCache = new Map<string, DashboardShootServiceTag[]>();

export const normalizeServices = (
  services?: string[] | Array<{ name?: string; id?: number | string }>,
): DashboardShootServiceTag[] => {
  if (!services?.length) return [{ label: "Standard Package", type: "primary" }];

  // Create cache key
  const cacheKey = JSON.stringify(services);
  if (servicesCache.has(cacheKey)) {
    return servicesCache.get(cacheKey)!;
  }

  // Convert services to strings first - handle both string arrays and object arrays
  const serviceStrings = services
    .map((service) => {
      if (typeof service === "string") {
        return service;
      }
      if (service && typeof service === "object") {
        // Handle object format: {id: 1, name: "Service Name", ...}
        const serviceObject = service as {
          name?: string;
          label?: string;
          service_name?: string;
        };
        return serviceObject.name ?? serviceObject.label ?? serviceObject.service_name ?? String(service);
      }
      return String(service);
    })
    .filter(Boolean) as string[];

  const tags = serviceStrings.flatMap((service) =>
    service
      .split(/[,/|•+]+/g)
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const result = tags.map((label) => {
    const lower = label.toLowerCase();
    let type: DashboardShootServiceTag["type"] = "primary";
    if (lower.includes("drone")) type = "drone";
    if (lower.includes("video") || lower.includes("edit")) type = "video";
    return { label, type };
  });

  // Cache result (limit cache size to prevent memory issues)
  if (servicesCache.size > 1000) {
    const firstKey = servicesCache.keys().next().value;
    servicesCache.delete(firstKey);
  }
  servicesCache.set(cacheKey, result);
  return result;
};

export type ClientShootRecord = {
  data: ShootData;
  summary: DashboardShootSummary;
};

export const isCompletedSummary = (summary: DashboardShootSummary) =>
  matchesStatus(summary, [...COMPLETED_STATUS_KEYWORDS, ...DELIVERED_STATUS_KEYWORDS]);

export const isCanceledSummary = (summary: DashboardShootSummary) =>
  matchesStatus(summary, CANCELED_STATUS_KEYWORDS);

// Active working statuses should NOT be considered "on hold" even if flagged
const ACTIVE_WORKING_STATUSES = ["editing", "uploaded", "review", "in_progress", "scheduled", "booked"];

export const isOnHoldRecord = (record: ClientShootRecord) => {
  const statusKey = (record.summary.workflowStatus || record.summary.status || "").toLowerCase();
  // If shoot is in an active working status, it's NOT on hold (even if flagged with revision request)
  if (ACTIVE_WORKING_STATUSES.some((status) => statusKey.includes(status))) {
    return false;
  }
  // Only consider on hold if explicitly marked as hold status
  return matchesStatus(record.summary, HOLD_STATUS_KEYWORDS);
};

export const getSpecialInstructions = (shoot: ShootData) => {
  if (!shoot.notes) return undefined;
  if (typeof shoot.notes === "string") return shoot.notes;
  return (
    shoot.notes.shootNotes ||
    shoot.notes.photographerNotes ||
    shoot.notes.companyNotes ||
    shoot.notes.editingNotes ||
    undefined
  );
};

export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const buildClientInvoiceSummary = (shoots: ShootData[]) => {
  const summary = {
    dueNow: { amount: 0, count: 0 },
    upcoming: { amount: 0, count: 0 },
    paid: { amount: 0, count: 0 },
  };

  // Delivered statuses - these are "due now" if unpaid
  const deliveredStatuses = ["delivered", "admin_verified", "ready", "ready_for_client", "completed", "finalized"];

  shoots.forEach((shoot) => {
    const payment = shoot.payment;
    if (!payment) return;
    const total = payment.totalQuote ?? 0;
    const paid = payment.totalPaid ?? 0;
    const balance = Math.max(total - paid, 0);

    if (balance > 1) {
      // Check if shoot is delivered - delivered unpaid goes to "Due Now"
      // Scheduled/requested unpaid goes to "Upcoming"
      const status = (shoot.workflowStatus || shoot.status || "").toLowerCase();
      const isDelivered = deliveredStatuses.some((statusKey) => status.includes(statusKey));
      const target = isDelivered ? "dueNow" : "upcoming";
      summary[target].amount += balance;
      summary[target].count += 1;
    } else if (total > 0) {
      summary.paid.amount += paid;
      summary.paid.count += 1;
    }
  });

  return summary;
};

export const extractMetadataArray = (
  metadata: Record<string, unknown>,
  keys: string[],
  transform?: (value: string) => string,
): string[] => {
  for (const key of keys) {
    const raw = metadata?.[key];
    if (Array.isArray(raw)) {
      return raw
        .map((item) => {
          if (item == null) return "";
          const value = String(item).trim();
          return transform ? transform(value) : value;
        })
        .filter(Boolean);
    }
  }
  return [];
};

export const extractStateToken = (value?: string | null) => {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length < 2) return null;
  const token = parts[1]?.trim().split(" ")[0];
  return token ? token.toLowerCase() : null;
};

// Memoize shootDataToSummary to avoid recalculating for same shoot
const shootDataToSummaryCache = new WeakMap<ShootData, DashboardShootSummary>();

export const shootDataToSummary = (shoot: ShootData): DashboardShootSummary => {
  // Always regenerate summary to ensure it reflects latest shoot data
  // The WeakMap cache helps with performance but we want fresh data when shoot updates
  // Note: WeakMap keys are object references, so updated shoots (new objects) won't hit cache

  const start = parseShootDateTime(shoot);
  const location = shoot.location || { address: "No address", city: "", state: "", zip: "" };

  // Calculate payment status from payment data
  const totalPaid = shoot.payment?.totalPaid || 0;
  const totalQuote = shoot.payment?.totalQuote || 0;
  let paymentStatus: "paid" | "unpaid" | "partial" | null = null;
  if (totalPaid <= 0) {
    paymentStatus = "unpaid";
  } else if (totalPaid >= totalQuote) {
    paymentStatus = "paid";
  } else {
    paymentStatus = "partial";
  }

  const summary: DashboardShootSummary = {
    id: toNumericId(shoot.id, `${location.address}-${shoot.scheduledDate}`),
    dayLabel: getDayLabel(start),
    timeLabel: start ? format(start, "h:mm a") : shoot.time || null,
    startTime: start ? start.toISOString() : null,
    addressLine: location.address || "No address on file",
    cityStateZip: [location.city, getStateFullName(location.state), location.zip].filter(Boolean).join(", "),
    status: shoot.status || null,
    workflowStatus: shoot.workflowStatus || shoot.status || null,
    clientName: shoot.client?.name || null,
    clientId: shoot.client?.id,
    temperature: undefined,
    services: normalizeServices(shoot.services),
    photographer: shoot.photographer?.name
      ? {
          id: toNumericId(shoot.photographer.id, shoot.photographer.name),
          name: shoot.photographer.name,
          avatar: shoot.photographer.avatar,
        }
      : null,
    isFlagged: Boolean(shoot.isFlagged),
    deliveryDeadline: shoot.completedDate ?? null,
    submittedForReviewAt: shoot.submittedForReviewAt ?? null,
    adminIssueNotes: typeof shoot.adminIssueNotes === "string" ? shoot.adminIssueNotes : undefined,
    paymentStatus,
  };

  // Cache the result for this shoot object reference
  shootDataToSummaryCache.set(shoot, summary);
  return summary;
};

export const getStatusKey = (shoot: DashboardShootSummary) =>
  (shoot.workflowStatus || shoot.status || "").toLowerCase();

export const matchesStatus = (shoot: DashboardShootSummary, keywords: string[]) =>
  keywords.some((keyword) => getStatusKey(shoot).includes(keyword));

export const sortByStartAsc = (a: DashboardShootSummary, b: DashboardShootSummary) => {
  const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
};

export const sortByStartDesc = (a: DashboardShootSummary, b: DashboardShootSummary) =>
  -sortByStartAsc(a, b);

export const filterUpcomingShoots = (shoots: DashboardShootSummary[], userRole?: string) => {
  return shoots
    .filter((shoot) => {
      const statusKey = getStatusKey(shoot);
      const isAdmin = userRole === "admin" || userRole === "superadmin";

      // Admins should see all shoots including delivered ones
      if (isAdmin) {
        // Only exclude canceled/declined/requested (these are handled separately)
        if (
          matchesStatus(shoot, [...CANCELED_STATUS_KEYWORDS, ...DECLINED_STATUS_KEYWORDS, ...REQUESTED_STATUS_KEYWORDS])
        ) {
          return false;
        }
        return true; // Admins see everything else
      }

      // For clients: Include unpaid delivered shoots in dashboard
      if (userRole === "client" && matchesStatus(shoot, DELIVERED_STATUS_KEYWORDS)) {
        const paymentStatus = shoot.paymentStatus || "unpaid";
        if (paymentStatus !== "paid") {
          // Show unpaid/partial delivered shoots to clients
          return true;
        }
        // Hide paid delivered shoots from client dashboard
        return false;
      }

      // For photographers/editors: Show shoots until delivered to client
      // This includes scheduled, uploaded, editing, review statuses
      if (userRole === "photographer" || userRole === "editor") {
        // Only exclude delivered/finalized shoots
        if (matchesStatus(shoot, DELIVERED_STATUS_KEYWORDS)) {
          return false;
        }
        // Exclude canceled, declined, requested
        if (
          matchesStatus(shoot, [...CANCELED_STATUS_KEYWORDS, ...DECLINED_STATUS_KEYWORDS, ...REQUESTED_STATUS_KEYWORDS])
        ) {
          return false;
        }
        // Show all other statuses (scheduled, uploaded, editing, review, etc.)
        return true;
      }

      // For other roles: Exclude delivered/finalized shoots (these should not appear in dashboard)
      if (matchesStatus(shoot, DELIVERED_STATUS_KEYWORDS)) {
        return false;
      }

      // Exclude canceled, declined, and requested shoots
      // Requested shoots are shown separately in the Requested Shoots section
      if (
        matchesStatus(shoot, [...CANCELED_STATUS_KEYWORDS, ...DECLINED_STATUS_KEYWORDS, ...REQUESTED_STATUS_KEYWORDS])
      ) {
        return false;
      }

      // Keep uploaded, editing, review, scheduled, booked visible regardless of date
      // "completed" can mean "uploaded" (not delivered), so we only exclude it if it's also delivered
      // Check if it's a legacy "completed" that maps to delivered
      if (statusKey.includes("completed") || statusKey.includes("editing_complete")) {
        // Only exclude if it's also marked as delivered/admin_verified
        if (matchesStatus(shoot, DELIVERED_STATUS_KEYWORDS)) {
          // It's both completed and delivered - exclude it
          return false;
        }
        // Otherwise, it's "completed" but not delivered (likely "uploaded") - keep it visible
      }

      // No date filter - show all shoots with these statuses regardless of when they were scheduled
      // This ensures uploaded/editing shoots from past dates remain visible until delivered
      return true;
    })
    .sort(sortByStartAsc);
};

export const filterRequestedShoots = (shoots: DashboardShootSummary[]) =>
  shoots.filter((shoot) => matchesStatus(shoot, REQUESTED_STATUS_KEYWORDS)).sort(sortByStartDesc);

export const filterDeclinedShoots = (shoots: DashboardShootSummary[]) =>
  shoots.filter((shoot) => matchesStatus(shoot, DECLINED_STATUS_KEYWORDS)).sort(sortByStartDesc);

export const filterCompletedShoots = (shoots: DashboardShootSummary[]) =>
  // Completed shoots are those that are uploaded/editing but not yet delivered
  shoots
    .filter((shoot) => {
      const statusKey = getStatusKey(shoot);
      // Include uploaded, editing, or legacy completed (if not delivered)
      return (
        statusKey.includes("uploaded") ||
        statusKey.includes("editing") ||
        (statusKey.includes("completed") && !matchesStatus(shoot, DELIVERED_STATUS_KEYWORDS))
      ) && !matchesStatus(shoot, DELIVERED_STATUS_KEYWORDS);
    })
    .sort(sortByStartDesc);

export const filterDeliveredShoots = (shoots: DashboardShootSummary[]) =>
  shoots.filter((shoot) => matchesStatus(shoot, DELIVERED_STATUS_KEYWORDS)).sort(sortByStartDesc);

export const filterPendingReviews = (shoots: DashboardShootSummary[]) =>
  []; // No pending reviews - review status removed

export const buildIssuesFromShoots = (
  shoots: ShootData[],
  options?: { deliveredOnly?: boolean },
): DashboardIssueItem[] => {
  const deliveredOnly = Boolean(options?.deliveredOnly);
  return shoots
    .filter((shoot) => {
      if (!(shoot.isFlagged || shoot.adminIssueNotes)) return false;
      if (!deliveredOnly) return true;
      const statusKey = (shoot.workflowStatus || shoot.status || "").toLowerCase();
      return [...COMPLETED_STATUS_KEYWORDS, ...DELIVERED_STATUS_KEYWORDS].some((keyword) =>
        statusKey.includes(keyword),
      );
    })
    .map((shoot) => ({
      id: toNumericId(shoot.id, shoot.location?.address || "issue"),
      message: shoot.adminIssueNotes || "Flagged shoot",
      severity: shoot.isFlagged ? "high" : "medium",
      status: shoot.status,
      client: shoot.client?.name,
      updatedAt: shoot.completedDate || shoot.scheduledDate || null,
    }));
};

export const isAssignmentMatch = (shoot: ShootData, user: UserData | null, role: "photographer" | "editor") => {
  if (!user) return false;
  const assignment = role === "photographer" ? shoot.photographer : shoot.editor;
  if (!assignment?.name && !assignment?.id) return false;
  const assignmentId = assignment?.id != null ? String(assignment.id) : undefined;
  const userId = user.id != null ? String(user.id) : undefined;
  if (assignmentId && userId && assignmentId === userId) return true;
  const metadata = user.metadata as Record<string, unknown> | undefined;
  const rawMetaId = metadata?.[`${role}Id`];
  const metaId = rawMetaId != null ? String(rawMetaId) : undefined;
  if (assignmentId && metaId && assignmentId === metaId) return true;
  const assignmentName = (assignment?.name || "").trim().toLowerCase();
  const userName = (user.name || "").trim().toLowerCase();
  return Boolean(assignmentName && userName && assignmentName === userName);
};

export const buildPhotographerSummariesFromShoots = (shoots: ShootData[]): DashboardPhotographerSummary[] => {
  const map = new Map<string, DashboardPhotographerSummary & { load: number }>();
  shoots.forEach((shoot) => {
    const name = shoot.photographer?.name;
    if (!name) return;
    const id = toNumericId(shoot.photographer.id, name);
    const existing = map.get(name) ?? {
      id,
      name,
      region: shoot.location?.state || "Local market",
      loadToday: 0,
      load: 0,
      availableFrom: "09:00",
      nextSlot: "15:00",
      avatar: shoot.photographer.avatar,
      status: "free" as DashboardPhotographerSummary["status"],
    };
    existing.loadToday += 1;
    existing.load += 1;
    map.set(name, existing);
  });
  return Array.from(map.values()).map((photographer) => ({
    ...photographer,
    status:
      photographer.loadToday > 4
        ? "busy"
        : photographer.loadToday > 2
          ? "editing"
          : "free",
  }));
};
