import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin,
  Phone,
  Mail,
  UserPlus,
  CheckCircle2,
  CalendarDays,
  UploadCloud,
  Map as MapIcon,
  MessageSquare,
  Flag,
  Sparkles,
  CalendarPlus,
  AlertCircle,
  DownloadCloud,
  PlayCircle,
  CreditCard,
  FileText,
  FileDown,
  Sun,
} from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  differenceInCalendarDays,
  addDays,
  parse,
  parseISO,
  isValid,
} from "date-fns";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useShoots } from "@/context/ShootsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { InvoiceData } from "@/utils/invoiceUtils";
import { ShootStatsCards } from "@/components/dashboard/ShootStatsCards";
import { ShootApprovalsSection } from "@/components/dashboard/ShootApprovalsSection";
import { ShootEditingSection } from "@/components/dashboard/ShootEditingSection";
import { ShootScheduleCard } from "@/components/dashboard/ShootScheduleCard";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { WeatherInfo } from "@/services/weatherService";
import { UpcomingShootsCard } from "@/components/dashboard/v2/UpcomingShootsCard";
import { PendingReviewsCard } from "@/components/dashboard/v2/PendingReviewsCard";
import { Avatar, Card, StatBadge } from "@/components/dashboard/v2/SharedComponents";
import { formatWorkflowStatus } from "@/utils/status";
import { Button } from "@/components/ui/button";
import { getStateFullName } from "@/utils/stateUtils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DashboardPhotographerSummary,
  DashboardShootSummary,
  DashboardIssueItem,
  DashboardShootServiceTag,
} from "@/types/dashboard";
import { useToast } from "@/hooks/use-toast";
import type { ShootData } from "@/types/shoots";
import type { UserData } from "@/types/auth";
import { fetchAvailablePhotographers } from "@/services/dashboardService";
import { API_BASE_URL } from "@/config/env";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { QuickActionsCard, type QuickActionItem } from "@/components/dashboard/v2/QuickActionsCard";
import { useEditingRequests } from "@/hooks/useEditingRequests";
import { UpcomingShootsCardSkeleton } from "@/components/dashboard/v2/UpcomingShootsCardSkeleton";
import { PendingReviewsCardSkeleton } from "@/components/dashboard/v2/PendingReviewsCardSkeleton";
import { CompletedShootsCardSkeleton } from "@/components/dashboard/v2/CompletedShootsCardSkeleton";
import { AssignPhotographersCardSkeleton } from "@/components/dashboard/v2/AssignPhotographersCardSkeleton";
import { EditingRequestsCardSkeletonWrapper } from "@/components/dashboard/v2/EditingRequestsCardSkeletonWrapper";
import { ProductionWorkflowBoardSkeleton } from "@/components/dashboard/v2/ProductionWorkflowBoardSkeleton";

const LazyTaskManager = lazy(() =>
  import("@/components/dashboard/TaskManager").then((module) => ({ default: module.TaskManager })),
);

const LazyRevenueCharts = lazy(() =>
  import("@/components/accounting/RevenueCharts").then((module) => ({ default: module.RevenueCharts })),
);

const LazyAssignPhotographersCard = lazy(() =>
  import("@/components/dashboard/v2/AssignPhotographersCard").then((module) => ({
    default: module.AssignPhotographersCard,
  })),
);

const LazyCompletedShootsCard = lazy(() =>
  import("@/components/dashboard/v2/CompletedShootsCard").then((module) => ({
    default: module.CompletedShootsCard,
  })),
);

const LazyProductionWorkflowBoard = lazy(() =>
  import("@/components/dashboard/v2/ProductionWorkflowBoard").then((module) => ({
    default: module.ProductionWorkflowBoard,
  })),
);

const LazyShootDetailsModal = lazy(() =>
  import("@/components/dashboard/v2/ShootDetailsModalWrapper").then((module) => ({
    default: module.ShootDetailsModalWrapper,
  })),
);

const LazyIssuesListCard = lazy(() =>
  import("@/components/dashboard/v2/IssuesListCard").then((module) => ({
    default: module.IssuesListCard,
  })),
);

const LazyEditingRequestsCard = lazy(() =>
  import("@/components/dashboard/EditingRequestsCard").then((module) => ({
    default: module.EditingRequestsCard,
  })),
);

const LazySpecialEditingRequestDialog = lazy(() =>
  import("@/components/dashboard/SpecialEditingRequestDialog").then((module) => ({
    default: module.SpecialEditingRequestDialog,
  })),
);

const SectionFallback: React.FC<{ label?: string }> = ({ label = "Loading..." }) => (
  <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border/70 text-sm text-muted-foreground">
    {label}
  </div>
);

const WORKFLOW_SEQUENCE = [
  "booked",
  "photos_uploaded",
  "editing_complete",
  "pending_review",
  "admin_verified",
  "completed",
] as const;

const getToken = (sessionToken?: string | null) =>
  sessionToken ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("token") ||
  undefined;

const COMPLETED_STATUS_KEYWORDS = ["completed", "editing_complete", "admin_verified"];
const DELIVERED_STATUS_KEYWORDS = ["delivered", "ready_for_client", "client_delivered"];
const CANCELED_STATUS_KEYWORDS = ["canceled", "cancelled", "no_show"];
const PENDING_REVIEW_KEYWORDS = ["pending_review", "pending review", "qc", "awaiting_review", "needs_review"];
const HOLD_STATUS_KEYWORDS = ["hold", "issue", "pending_payment", "awaiting_client", "needs_client_action"];

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const toNumericId = (value?: string | number | null, fallback?: string): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    return hashString(value);
  }
  if (fallback) return hashString(fallback);
  return hashString("repro-fallback");
};

const doesShootBelongToClient = (shoot: ShootData, client?: UserData | null) => {
  if (!client) return false;
  const emailMatch = shoot.client.email && client.email && shoot.client.email === client.email;
  const nameMatch = shoot.client.name && client.name && shoot.client.name === client.name;
  const companyMatch = shoot.client.company && client.company && shoot.client.company === client.company;
  return Boolean(emailMatch || nameMatch || companyMatch);
};

const getGreetingPrefix = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Hi";
};

const DASHBOARD_DESCRIPTION =
  "Here's an overview of all your shoots, approvals, and editing status.";

const parseShootDateTime = (shoot: ShootData): Date | null => {
  if (!shoot.scheduledDate) return null;
  const patterns = ["yyyy-MM-dd h:mm aa", "yyyy-MM-dd hh:mm aa", "yyyy-MM-dd HH:mm"];
  if (shoot.time) {
    for (const pattern of patterns) {
      const parsed = parse(`${shoot.scheduledDate} ${shoot.time}`, pattern, new Date());
      if (isValid(parsed)) return parsed;
    }
  }
  const fallback = parseISO(shoot.scheduledDate);
  return isValid(fallback) ? fallback : null;
};

const getDayLabel = (date: Date | null) => {
  if (!date) return "Upcoming";
  const today = startOfDay(new Date());
  const diff = differenceInCalendarDays(startOfDay(date), today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return format(date, "EEEE");
  return format(date, "MMM d");
};

const normalizeServices = (services?: string[] | Array<{ name?: string; id?: number | string }>): DashboardShootServiceTag[] => {
  if (!services?.length) return [{ label: "Standard Package", type: "primary" }];
  
  // Convert services to strings first - handle both string arrays and object arrays
  const serviceStrings = services.map((service) => {
    if (typeof service === 'string') {
      return service;
    }
    if (service && typeof service === 'object') {
      // Handle object format: {id: 1, name: "Service Name", ...}
      return (service as any).name ?? (service as any).label ?? (service as any).service_name ?? String(service);
    }
    return String(service);
  }).filter(Boolean) as string[];
  
  const tags = serviceStrings.flatMap((service) =>
    service
      .split(/[,/|•+]+/g)
      .map((item) => item.trim())
      .filter(Boolean),
  );
  return tags.map((label) => {
    const lower = label.toLowerCase();
    let type: DashboardShootServiceTag["type"] = "primary";
    if (lower.includes("drone")) type = "drone";
    if (lower.includes("video") || lower.includes("edit")) type = "video";
    return { label, type };
  });
};

type ClientShootRecord = {
  data: ShootData;
  summary: DashboardShootSummary;
};

const isCompletedSummary = (summary: DashboardShootSummary) =>
  matchesStatus(summary, [...COMPLETED_STATUS_KEYWORDS, ...DELIVERED_STATUS_KEYWORDS]);

const isCanceledSummary = (summary: DashboardShootSummary) =>
  matchesStatus(summary, CANCELED_STATUS_KEYWORDS);

const isOnHoldRecord = (record: ClientShootRecord) =>
  record.data.isFlagged || matchesStatus(record.summary, HOLD_STATUS_KEYWORDS);

const getSpecialInstructions = (shoot: ShootData) => {
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

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const buildClientInvoiceSummary = (shoots: ShootData[]) => {
  const summary = {
    dueNow: { amount: 0, count: 0 },
    upcoming: { amount: 0, count: 0 },
    paid: { amount: 0, count: 0 },
  };
  const now = new Date();

  shoots.forEach((shoot) => {
    const payment = shoot.payment;
    if (!payment) return;
    const total = payment.totalQuote ?? 0;
    const paid = payment.totalPaid ?? 0;
    const balance = Math.max(total - paid, 0);
    if (balance > 1) {
      const scheduledDate = shoot.scheduledDate ? parseISO(shoot.scheduledDate) : null;
      const target = scheduledDate && isValid(scheduledDate) && scheduledDate > now ? "upcoming" : "dueNow";
      summary[target].amount += balance;
      summary[target].count += 1;
    } else {
      summary.paid.amount += total;
      summary.paid.count += 1;
    }
  });

  return summary;
};

const extractMetadataArray = (
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

const extractStateToken = (value?: string | null) => {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length < 2) return null;
  const token = parts[1]?.trim().split(" ")[0];
  return token ? token.toLowerCase() : null;
};

const shootDataToSummary = (shoot: ShootData): DashboardShootSummary => {
  const start = parseShootDateTime(shoot);
  const location = shoot.location || { address: "No address", city: "", state: "", zip: "" };
  return {
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
    adminIssueNotes:
      typeof shoot.adminIssueNotes === "string" ? shoot.adminIssueNotes : undefined,
  };
};

const getStatusKey = (shoot: DashboardShootSummary) =>
  (shoot.workflowStatus || shoot.status || "").toLowerCase();

const matchesStatus = (shoot: DashboardShootSummary, keywords: string[]) =>
  keywords.some((keyword) => getStatusKey(shoot).includes(keyword));

const sortByStartAsc = (a: DashboardShootSummary, b: DashboardShootSummary) => {
  const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
};

const sortByStartDesc = (a: DashboardShootSummary, b: DashboardShootSummary) =>
  -sortByStartAsc(a, b);

const filterUpcomingShoots = (shoots: DashboardShootSummary[]) => {
  const todayStart = startOfDay(new Date()).getTime();
  return shoots
    .filter((shoot) => {
      if (matchesStatus(shoot, [...COMPLETED_STATUS_KEYWORDS, ...DELIVERED_STATUS_KEYWORDS, ...CANCELED_STATUS_KEYWORDS])) {
        return false;
      }
      if (!shoot.startTime) return true;
      const ts = new Date(shoot.startTime).getTime();
      if (Number.isNaN(ts)) return true;
      return ts >= todayStart - 24 * 60 * 60 * 1000;
    })
    .sort(sortByStartAsc);
};

const filterCompletedShoots = (shoots: DashboardShootSummary[]) =>
  shoots.filter((shoot) => matchesStatus(shoot, COMPLETED_STATUS_KEYWORDS)).sort(sortByStartDesc);

const filterDeliveredShoots = (shoots: DashboardShootSummary[]) =>
  shoots.filter((shoot) => matchesStatus(shoot, DELIVERED_STATUS_KEYWORDS)).sort(sortByStartDesc);

const filterPendingReviews = (shoots: DashboardShootSummary[]) =>
  shoots.filter((shoot) => matchesStatus(shoot, PENDING_REVIEW_KEYWORDS)).sort(sortByStartAsc);

const buildIssuesFromShoots = (
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

const isAssignmentMatch = (shoot: ShootData, user: UserData | null, role: "photographer" | "editor") => {
  if (!user) return false;
  const assignment = role === "photographer" ? shoot.photographer : shoot.editor;
  if (!assignment?.name && !assignment?.id) return false;
  if (assignment?.id && assignment.id === user.id) return true;
  const metadata = user.metadata as Record<string, unknown> | undefined;
  const metaId =
    typeof metadata?.[`${role}Id`] === "string"
      ? (metadata?.[`${role}Id`] as string)
      : undefined;
  if (assignment?.id && metaId && assignment.id === metaId) return true;
  const assignmentName = (assignment?.name || "").trim().toLowerCase();
  const userName = (user.name || "").trim().toLowerCase();
  return Boolean(assignmentName && userName && assignmentName === userName);
};

const buildPhotographerSummariesFromShoots = (shoots: ShootData[]): DashboardPhotographerSummary[] => {
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
      availableFrom: "09:00",
      nextSlot: "15:00",
      avatar: shoot.photographer.avatar,
      status: "free" as DashboardPhotographerSummary["status"],
    };
    existing.loadToday += 1;
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

type MobileDashboardTab = "upcoming" | "assign" | "reviews" | "completed" | "pipeline";

const Dashboard = () => {
  const { role, session, user } = useAuth();
  const { shoots } = useShoots();
  const isMobile = useIsMobile();
  const isAdminExperience = ["admin", "superadmin"].includes(role);
  const canLoadAvailability = isAdminExperience || role === "salesRep";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, loading, error, refresh } = useDashboardOverview();
  const [selectedShoot, setSelectedShoot] = useState<DashboardShootSummary | null>(null);
  const [selectedShootWeather, setSelectedShootWeather] = useState<WeatherInfo | null>(null);
  const [selectedPhotographer, setSelectedPhotographer] =
    useState<DashboardPhotographerSummary | null>(null);
  const [specialRequestOpen, setSpecialRequestOpen] = useState(false);
  const [mobileDashboardTab, setMobileDashboardTab] = useState<MobileDashboardTab>("upcoming");

  // Handler for selecting a shoot with optional weather data
  const handleSelectShoot = useCallback((shoot: DashboardShootSummary, weather?: WeatherInfo | null) => {
    setSelectedShoot(shoot);
    setSelectedShootWeather(weather || null);
  }, []);

  const shootDetailsModal = (
    <Suspense fallback={null}>
      <LazyShootDetailsModal shoot={selectedShoot} onClose={() => { setSelectedShoot(null); setSelectedShootWeather(null); }} weather={selectedShootWeather} />
    </Suspense>
  );

  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";
  const greetingTitle = `${getGreetingPrefix()} ${firstName}`;

  const [availabilityWindow, setAvailabilityWindow] = useState(() => ({
    date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    end_time: "17:00",
  }));
  const [availablePhotographerIds, setAvailablePhotographerIds] = useState<number[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!canLoadAvailability) return;
    const token = getToken(session?.accessToken);
    if (!token) {
      setAvailabilityError("Missing auth token");
      return;
    }
    setAvailabilityLoading(true);
    fetchAvailablePhotographers(availabilityWindow, token)
      .then((ids) => {
        setAvailablePhotographerIds(ids);
        setAvailabilityError(null);
      })
      .catch((err) => {
        setAvailabilityError(err instanceof Error ? err.message : "Unable to load availability");
      })
      .finally(() => setAvailabilityLoading(false));
  }, [availabilityWindow, canLoadAvailability, session?.accessToken]);

  const summaryMap = useMemo(() => {
    const map = new Map<string, DashboardShootSummary>();
    shoots.forEach((shoot) => map.set(shoot.id, shootDataToSummary(shoot)));
    return map;
  }, [shoots]);

  const toSummaryList = useCallback(
    (source: ShootData[]) =>
      source
        .map((shoot) => summaryMap.get(shoot.id))
        .filter((item): item is DashboardShootSummary => Boolean(item)),
    [summaryMap],
  );

  const allSummaries = useMemo(() => Array.from(summaryMap.values()), [summaryMap]);

  const photographerSourceShoots = useMemo(
    () => shoots.filter((shoot) => isAssignmentMatch(shoot, user, "photographer")),
    [shoots, user],
  );
  const editorSourceShoots = useMemo(
    () => shoots.filter((shoot) => isAssignmentMatch(shoot, user, "editor")),
    [shoots, user],
  );

  const photographerSummaries = useMemo(
    () => toSummaryList(photographerSourceShoots),
    [photographerSourceShoots, toSummaryList],
  );
  const editorSummaries = useMemo(
    () => toSummaryList(editorSourceShoots),
    [editorSourceShoots, toSummaryList],
  );
  const editorUpcoming = useMemo(
    () => filterUpcomingShoots(editorSummaries),
    [editorSummaries],
  );

  const photographerUpcoming = useMemo(
    () => filterUpcomingShoots(photographerSummaries),
    [photographerSummaries],
  );
  const photographerCompleted = useMemo(
    () => filterCompletedShoots(photographerSummaries),
    [photographerSummaries],
  );
  const photographerDelivered = useMemo(
    () => filterDeliveredShoots(photographerSummaries),
    [photographerSummaries],
  );
  const photographerPendingReviews = useMemo(
    () => filterPendingReviews(photographerSummaries),
    [photographerSummaries],
  );
  const photographerIssues = useMemo(
    () => buildIssuesFromShoots(photographerSourceShoots, { deliveredOnly: true }),
    [photographerSourceShoots],
  );

  const editorPendingReviews = useMemo(
    () => filterPendingReviews(editorSummaries),
    [editorSummaries],
  );
  const editorDelivered = useMemo(
    () => filterDeliveredShoots(editorSummaries),
    [editorSummaries],
  );
  const editorIssues = useMemo(
    () => buildIssuesFromShoots(editorSourceShoots),
    [editorSourceShoots],
  );

  const clientShoots = useMemo(() => {
    if (role !== "client") return [];
    const matches = shoots.filter((shoot) => doesShootBelongToClient(shoot, user));
    if (matches.length > 0) return matches;
    return shoots;
  }, [role, shoots, user]);

  const clientRecords = useMemo(() => {
    if (!clientShoots.length) return [];
    return clientShoots
      .map((shoot) => {
        const summary = summaryMap.get(shoot.id);
        if (!summary) return null;
        return { data: shoot, summary };
      })
      .filter((record): record is ClientShootRecord => Boolean(record));
  }, [clientShoots, summaryMap]);

  const clientUpcomingRecords = useMemo(() => {
    return clientRecords
      .filter(
        (record) =>
          !isCompletedSummary(record.summary) &&
          !isCanceledSummary(record.summary) &&
          !isOnHoldRecord(record),
      )
      .sort((a, b) => sortByStartAsc(a.summary, b.summary));
  }, [clientRecords]);

  const clientCompletedRecords = useMemo(() => {
    return clientRecords
      .filter((record) => isCompletedSummary(record.summary))
      .sort((a, b) => sortByStartDesc(a.summary, b.summary));
  }, [clientRecords]);

  const clientOnHoldRecords = useMemo(() => {
    return clientRecords
      .filter((record) => isOnHoldRecord(record))
      .sort((a, b) => sortByStartAsc(a.summary, b.summary));
  }, [clientRecords]);

  const clientInvoiceSummary = useMemo(
    () => buildClientInvoiceSummary(clientShoots),
    [clientShoots],
  );

  const shouldLoadEditingRequests = isAdminExperience || role === "salesRep" || role === "editor";
  const { requests: editingRequests, loading: editingRequestsLoading } = useEditingRequests(shouldLoadEditingRequests);

  const repScope = useMemo(() => {
    const metadata = (user?.metadata as Record<string, unknown>) || {};
    const clientIds = extractMetadataArray(metadata, ["managedClientIds", "clientIds"]).map((value) =>
      value.toString(),
    );
    const clientNames = extractMetadataArray(
      metadata,
      ["managedClientNames", "clientNames"],
      (value) => value.toLowerCase(),
    );
    const regions = extractMetadataArray(
      metadata,
      ["regions", "managedRegions", "territories"],
      (value) => value.toLowerCase(),
    );
    const hasScope = clientIds.length > 0 || clientNames.length > 0 || regions.length > 0;
    return { clientIds, clientNames, regions, hasScope };
  }, [user?.metadata]);

  const repVisibleSummaries = useMemo(() => {
    if (!repScope.hasScope) return allSummaries;
    return allSummaries.filter((shoot) => {
      if (repScope.clientIds.length && shoot.clientId && repScope.clientIds.includes(String(shoot.clientId))) {
        return true;
      }
      const clientName = shoot.clientName?.toLowerCase();
      if (repScope.clientNames.length && clientName && repScope.clientNames.includes(clientName)) {
        return true;
      }
      if (repScope.regions.length) {
        const stateToken = extractStateToken(shoot.cityStateZip);
        if (stateToken && repScope.regions.includes(stateToken)) {
          return true;
        }
      }
      return false;
    });
  }, [allSummaries, repScope]);

  const repSourceShoots = useMemo(() => {
    if (!repScope.hasScope) return shoots;
    return shoots.filter((shoot) => {
      if (repScope.clientIds.length && shoot.client?.id && repScope.clientIds.includes(String(shoot.client.id))) {
        return true;
      }
      const clientName = shoot.client?.name?.toLowerCase();
      if (repScope.clientNames.length && clientName && repScope.clientNames.includes(clientName)) {
        return true;
      }
      const stateToken = shoot.location?.state?.toLowerCase();
      if (repScope.regions.length && stateToken && repScope.regions.includes(stateToken)) {
        return true;
      }
      return false;
    });
  }, [repScope, shoots]);

  const repUpcoming = useMemo(() => filterUpcomingShoots(repVisibleSummaries), [repVisibleSummaries]);
  const repPendingReviews = useMemo(
    () => filterPendingReviews(repVisibleSummaries),
    [repVisibleSummaries],
  );
  const repDelivered = useMemo(() => filterDeliveredShoots(repVisibleSummaries), [repVisibleSummaries]);
  const repIssues = useMemo(() => buildIssuesFromShoots(repSourceShoots), [repSourceShoots]);

  const clientLatestCompleted = clientCompletedRecords[0] ?? null;

  const openSupportEmail = useCallback(
    (subject: string, body?: string) => {
      const fallback = () =>
        toast({
          title: "Contact support",
          description: "Please email support@reprohq.com.",
        });

      if (typeof window === "undefined") {
        fallback();
        return;
      }

      const params = new URLSearchParams();
      if (subject) params.set("subject", subject);
      if (body) params.set("body", body);
      window.location.href = `mailto:support@reprohq.com${
        params.toString() ? `?${params.toString()}` : ""
      }`;
    },
    [toast],
  );

  const handleClientBookShoot = useCallback(() => {
    navigate("/book-shoot");
  }, [navigate]);

  const handleClientReportIssue = useCallback(() => {
    openSupportEmail("Shoot issue");
  }, [openSupportEmail]);

  const handleClientDownloadLast = useCallback(() => {
    if (clientLatestCompleted) {
      setSelectedShoot(clientLatestCompleted.summary);
    } else {
      toast({
        title: "No completed shoots yet",
        description: "We'll notify you when files are ready.",
      });
    }
  }, [clientLatestCompleted, toast]);

  const handleClientViewTour = useCallback(() => {
    if (clientLatestCompleted) {
      setSelectedShoot(clientLatestCompleted.summary);
    } else {
      toast({
        title: "No tours available",
        description: "Once a tour is ready, it will appear here.",
      });
    }
  }, [clientLatestCompleted, toast]);

  const clientQuickActions = useMemo<QuickActionItem[]>(() => {
    if (role !== "client") return [];
    return [
      {
        id: "book",
        label: "Book a new shoot",
        description: "Schedule coverage for a listing",
        icon: <CalendarPlus size={16} />,
        accent: "from-emerald-50 to-white text-emerald-600 dark:from-emerald-900/80 dark:to-emerald-800/80 dark:text-emerald-200",
        onClick: handleClientBookShoot,
      },
      {
        id: "report-issue",
        label: "Report an issue",
        description: "Flag missing edits or problems",
        icon: <AlertCircle size={16} />,
        accent: "from-rose-50 to-white text-rose-600 dark:from-rose-900/80 dark:to-rose-800/80 dark:text-rose-200",
        onClick: handleClientReportIssue,
      },
      {
        id: "download-last",
        label: "Download last shoot",
        description: "Grab final files instantly",
        icon: <DownloadCloud size={16} />,
        accent: "from-sky-50 to-white text-sky-600 dark:from-sky-900/80 dark:to-sky-800/80 dark:text-sky-200",
        onClick: handleClientDownloadLast,
      },
      {
        id: "view-tour",
        label: "View a tour",
        description: "Open a delivered 3D tour",
        icon: <PlayCircle size={16} />,
        accent: "from-indigo-50 to-white text-indigo-600 dark:from-indigo-900/80 dark:to-indigo-800/80 dark:text-indigo-200",
        onClick: handleClientViewTour,
      },
    ];
  }, [role, handleClientBookShoot, handleClientReportIssue, handleClientDownloadLast, handleClientViewTour]);

  const fallbackPhotographers = useMemo(
    () => buildPhotographerSummariesFromShoots(shoots),
    [shoots],
  );
  const assignPhotographers = data?.photographers?.length
    ? data.photographers
    : fallbackPhotographers;

  const photographerSchedule = useMemo(() => {
    if (!selectedPhotographer) return [];
    if (data?.upcomingShoots?.length) {
      return data.upcomingShoots.filter(
        (shoot) => shoot.photographer?.id === selectedPhotographer.id,
      );
    }
    return allSummaries.filter((shoot) => shoot.photographer?.id === selectedPhotographer.id);
  }, [selectedPhotographer, data?.upcomingShoots, allSummaries]);

  const openFirstPendingShoot = (
    queue: DashboardShootSummary[],
    context: string,
  ) => {
    if (queue.length > 0) {
      setSelectedShoot(queue[0]);
    } else {
      toast({
        title: `No ${context}`,
        description: "Everything looks clear right now.",
      });
    }
  };

  const adminQuickActions: QuickActionItem[] = [
    {
      id: "review-queue",
      label: "Review queue",
      description: "Jump into approvals",
      icon: <CheckCircle2 size={16} />,
      accent: "from-emerald-50 to-white text-emerald-600 dark:from-emerald-950/60 dark:to-emerald-900/60 dark:text-emerald-300",
      onClick: () => {
        const target = data?.pendingReviews?.[0];
        if (target) {
          setSelectedShoot(target);
        } else {
          toast({
            title: "Nothing to review",
            description: "All shoots are clear right now.",
          });
        }
      },
    },
    {
      id: "manage-availability",
      label: "Manage availability",
      description: "Update roster coverage",
      icon: <CalendarDays size={16} />,
      accent: "from-amber-50 to-white text-amber-600 dark:from-amber-950/60 dark:to-amber-900/60 dark:text-amber-300",
      onClick: () => navigate("/availability"),
    },
    {
      id: "chat-with-robbie",
      label: "Chat with robbie",
      description: "Get instant answers",
      icon: <MessageSquare size={16} />,
      accent: "from-sky-50 to-white text-sky-600 dark:from-sky-950/60 dark:to-sky-900/60 dark:text-sky-300",
      onClick: () => navigate("/chat-with-reproai"),
    },
    {
      id: "special-editing-request",
      label: "Special editing request",
      description: "Route tasks to editors",
      icon: <Sparkles size={16} />,
      accent: "from-violet-50 to-white text-violet-600 dark:from-violet-950/60 dark:to-violet-900/60 dark:text-violet-300",
      onClick: () => setSpecialRequestOpen(true),
    },
  ];

  const stats = data?.stats;
  const totals = {
    totalShoots: stats?.totalShoots ?? 0,
    scheduledToday: stats?.scheduledToday ?? 0,
    flaggedShoots: stats?.flaggedShoots ?? 0,
    pendingReviews: stats?.pendingReviews ?? 0,
  };
  const nextShoot = data?.upcomingShoots?.[0];

  const completedShoots = useMemo(() => {
    if (!data?.workflow) return [];
    return data.workflow.columns
      .filter((column) => {
        const key = column.key.toLowerCase();
        return key.includes("ready") || key.includes("deliver") || key.includes("complete");
      })
      .flatMap((column) => column.shoots)
      .sort((a, b) => {
        const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
        const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 6);
  }, [data?.workflow]);

  const handleAdvanceStage = useCallback(
    async (shoot: DashboardShootSummary) => {
      const token = getToken(session?.accessToken);
      if (!token) {
        toast({
          title: "Authentication required",
          description: "Please log in again to update workflow status.",
          variant: "destructive",
        });
        return;
      }

      const current = shoot.workflowStatus || "booked";
      const index = WORKFLOW_SEQUENCE.indexOf(current as (typeof WORKFLOW_SEQUENCE)[number]);
      if (index === -1 || index === WORKFLOW_SEQUENCE.length - 1) {
        toast({
          title: "Already at final stage",
          description: "This shoot cannot be advanced further.",
        });
        return;
      }

      const next = WORKFLOW_SEQUENCE[index + 1];

      try {
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ workflow_status: next }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to update workflow status");
        toast({
          title: "Workflow advanced",
          description: `Shoot moved to ${next.replace("_", " ")}.`,
        });
        refresh();
      } catch (err) {
        toast({
          title: "Update failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [session?.accessToken, refresh, toast],
  );

  const [pipelineRange, setPipelineRange] = useState<"today" | "week">("today");

  const renderAssignPhotographersCard = () => (
    <Suspense fallback={<AssignPhotographersCardSkeleton />}>
      <LazyAssignPhotographersCard
        photographers={assignPhotographers}
        onPhotographerSelect={setSelectedPhotographer}
        onViewSchedule={() => navigate("/availability")}
        availablePhotographerIds={availablePhotographerIds}
        availabilityWindow={availabilityWindow}
        onAvailabilityWindowChange={setAvailabilityWindow}
        availabilityLoading={availabilityLoading}
        availabilityError={availabilityError}
        showContactActions={role === "salesRep"}
      />
    </Suspense>
  );

  const renderUpcomingCard = () =>
    loading && !data ? (
      <UpcomingShootsCardSkeleton />
    ) : (
      <UpcomingShootsCard shoots={data?.upcomingShoots || []} onSelect={handleSelectShoot} />
    );

  const renderPendingReviewsCard = () =>
    loading && !data ? (
      <PendingReviewsCardSkeleton />
    ) : (
      <PendingReviewsCard
        reviews={data?.pendingReviews || []}
        issues={data?.issues || []}
        onSelect={(shoot) => handleSelectShoot(shoot)}
      />
    );

  const renderCompletedShootsCard = () => (
    <Suspense fallback={<CompletedShootsCardSkeleton />}>
      <LazyCompletedShootsCard shoots={completedShoots} />
    </Suspense>
  );

  const renderEditingRequestsCard = () =>
    shouldLoadEditingRequests ? (
      <Suspense fallback={<EditingRequestsCardSkeletonWrapper />}>
        <LazyEditingRequestsCard
          requests={editingRequests}
          loading={editingRequestsLoading}
          onCreate={() => setSpecialRequestOpen(true)}
        />
      </Suspense>
    ) : null;

  const renderPipelineSection = () => (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-[0.3em]">
          Pipeline
        </h2>
        <div className="flex items-center gap-2 text-[11px] font-semibold">
          {(["today", "week"] as Array<"today" | "week">).map((range) => (
            <button
              key={range}
              onClick={() => setPipelineRange(range)}
              className={`px-3 py-1 rounded-full border ${
                pipelineRange === range
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {range === "today" ? "Today" : "This week"}
            </button>
          ))}
        </div>
      </div>
      <Suspense fallback={<ProductionWorkflowBoardSkeleton />}>
        <LazyProductionWorkflowBoard
          workflow={filteredWorkflow}
          loading={loading}
          onSelectShoot={handleSelectShoot}
          onAdvanceStage={handleAdvanceStage}
        />
      </Suspense>
    </div>
  );

  const filteredWorkflow = useMemo(() => {
    if (!data?.workflow) return null;
    const now = new Date();
    const rangeStart =
      pipelineRange === "today"
        ? startOfDay(now).getTime()
        : startOfWeek(now, { weekStartsOn: 0 }).getTime();
    const rangeEnd =
      pipelineRange === "today"
        ? endOfDay(now).getTime()
        : endOfWeek(now, { weekStartsOn: 0 }).getTime();

    const filterShoot = (shoot: DashboardShootSummary) => {
      if (!shoot.startTime) return true;
      const time = new Date(shoot.startTime).getTime();
      if (Number.isNaN(time)) return true;
      return time >= rangeStart && time <= rangeEnd;
    };

    return {
      columns: data.workflow.columns.map((column) => {
        const filteredShoots = column.shoots.filter(filterShoot);
        return {
          ...column,
          shoots: filteredShoots,
          count: filteredShoots.length,
        };
      }),
    };
  }, [data?.workflow, pipelineRange]);

  if (!isAdminExperience) {
    if (role === "client") {
      const handleReschedule = (record: ClientShootRecord) =>
        navigate(`/book-shoot?reschedule=${record.data.id}`);
      const handleCancelShoot = (record: ClientShootRecord) =>
        toast({
          title: "Cancellation request received",
          description: `We'll confirm the cancellation for ${record.summary.addressLine}.`,
        });
      const handleContactSupport = () => openSupportEmail("Client dashboard support");
      const handleDownloadShoot = (record: ClientShootRecord) => setSelectedShoot(record.summary);
      const handleRebookShoot = (record: ClientShootRecord) =>
        navigate(`/book-shoot?template=${record.data.id}`);
      const handleRequestRevision = (record: ClientShootRecord) =>
        openSupportEmail(
          `Revision request for shoot #${record.data.id}`,
          `Please assist with revisions for shoot #${record.data.id}.`,
        );
      const handleHoldAction = (record: ClientShootRecord) => {
        const status = (record.summary.workflowStatus || record.summary.status || "").toLowerCase();
        if (status.includes("payment")) {
          navigate("/invoices");
          return;
        }
        openSupportEmail("Shoot assistance needed");
      };

      return (
        <>
          <DashboardLayout>
            <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
              <PageHeader
                badge="Client"
                title={greetingTitle}
                description={DASHBOARD_DESCRIPTION}
              />
              {error && (
                <div className="p-4 border border-rose-200 bg-rose-50 rounded-2xl text-sm text-rose-700">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
                <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6">
                  <QuickActionsCard actions={clientQuickActions} eyebrow="Quick actions" columns={1} />
                  <ClientInvoicesCard
                    summary={clientInvoiceSummary}
                    onViewAll={() => navigate("/invoices")}
                    onDownload={() => navigate("/invoices")}
                    onPay={() => navigate("/invoices")}
                  />
                </div>
                <div className="md:col-span-9">
                  <ClientMyShoots
                    upcoming={clientUpcomingRecords}
                    completed={clientCompletedRecords}
                    onHold={clientOnHoldRecords}
                    onSelect={(record) => setSelectedShoot(record.summary)}
                    onReschedule={handleReschedule}
                    onCancel={handleCancelShoot}
                    onContactSupport={() => handleContactSupport()}
                    onDownload={handleDownloadShoot}
                    onRebook={handleRebookShoot}
                    onRequestRevision={handleRequestRevision}
                    onHoldAction={handleHoldAction}
                  />
                </div>
              </div>
            </div>
          </DashboardLayout>
          {shootDetailsModal}
        </>
      );
    }

    if (role === "photographer") {
      const quickActions: QuickActionItem[] = [
        {
          id: "route",
          label: "Today's route",
          description: "Review schedule & maps",
          icon: <MapIcon size={16} />,
          accent: "from-sky-50 to-white text-sky-600 dark:from-sky-900/80 dark:to-sky-800/80 dark:text-sky-200",
          onClick: () => navigate("/shoot-history"),
        },
        {
          id: "next-review",
          label: "Next review",
          description: "Open pending delivery",
          icon: <CheckCircle2 size={16} />,
          accent: "from-emerald-50 to-white text-emerald-600 dark:from-emerald-900/80 dark:to-emerald-800/80 dark:text-emerald-200",
          onClick: () => openFirstPendingShoot(photographerPendingReviews, "pending reviews"),
        },
        {
          id: "upload-raws",
          label: "Upload RAWs",
          description: "Send files to editors",
          icon: <UploadCloud size={16} />,
          accent: "from-indigo-50 to-white text-indigo-600 dark:from-indigo-900/80 dark:to-indigo-800/80 dark:text-indigo-200",
          onClick: () => navigate("/media"),
        },
        {
          id: "availability",
          label: "Update availability",
          description: "Set days off & travel",
          icon: <CalendarDays size={16} />,
          accent: "from-amber-50 to-white text-amber-600 dark:from-amber-900/80 dark:to-amber-800/80 dark:text-amber-200",
          onClick: () => navigate("/photographer-availability"),
        },
      ];

      return (
        <>
          <RoleDashboardLayout
            title="Photographers"
            description="Field schedule, quick actions, and delivery milestones."
            quickActions={quickActions}
            quickActionsEyebrow="Workflow"
            leftColumnCard={
              <Suspense fallback={<CompletedShootsCardSkeleton />}>
                <LazyCompletedShootsCard
                  shoots={photographerCompleted}
                  title="Completed shoots"
                  subtitle="Awaiting delivery / handoff"
                  emptyStateText="No completed shoots yet today."
                />
              </Suspense>
            }
            rightColumnCards={[
              <Suspense key="delivered-shoots" fallback={<CompletedShootsCardSkeleton />}>
                <LazyCompletedShootsCard
                  shoots={photographerDelivered}
                  title="Delivered shoots"
                  subtitle="Ready for clients"
                  emptyStateText="No delivered shoots yet."
                />
              </Suspense>,
              <Suspense key="photographer-issues" fallback={<PendingReviewsCardSkeleton />}>
                <LazyIssuesListCard
                  issues={photographerIssues}
                  title="Post-delivery issues"
                  emptyStateText="No issues flagged."
                />
              </Suspense>,
            ]}
            upcomingShoots={photographerUpcoming}
            pendingReviews={photographerPendingReviews}
            issues={photographerIssues}
            pendingCard={
              <PendingReviewsCard
                title="In review"
                variant="reviews-only"
                reviews={photographerPendingReviews}
                issues={[]}
                onSelect={(shoot) => handleSelectShoot(shoot)}
                emptyReviewsText="Nothing waiting for you."
              />
            }
            onSelectShoot={handleSelectShoot}
          />
          {shootDetailsModal}
        </>
      );
    }

    if (role === "salesRep") {
      const quickActions: QuickActionItem[] = [
        {
          id: "assign",
          label: "Assign photographer",
          description: "Match next booking",
          icon: <UserPlus size={16} />,
          accent: "from-indigo-50 to-white text-indigo-600 dark:from-indigo-900/80 dark:to-indigo-800/80 dark:text-indigo-200",
          onClick: () => {
            setSelectedPhotographer(null);
            document.getElementById("assign-card")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          },
        },
        {
          id: "book-shoot",
          label: "Book a shoot",
          description: "Create new order",
          icon: <CalendarDays size={16} />,
          accent: "from-emerald-50 to-white text-emerald-600 dark:from-emerald-900/80 dark:to-emerald-800/80 dark:text-emerald-200",
          onClick: () => navigate("/book-shoot"),
        },
        {
          id: "message-client",
          label: "Message client",
          description: "Send update or reminder",
          icon: <MessageSquare size={16} />,
          accent: "from-amber-50 to-white text-amber-600 dark:from-amber-900/80 dark:to-amber-800/80 dark:text-amber-200",
          onClick: () => openSupportEmail("Client outreach request"),
        },
      ];

      return (
        <>
          <RoleDashboardLayout
            title="Rep"
            description="Assign coverage, monitor reviews, and close the loop."
            quickActions={quickActions}
            quickActionsEyebrow="Pipeline"
            leftColumnCard={
              <div id="assign-card" className="h-full flex flex-col">
                <Suspense fallback={<AssignPhotographersCardSkeleton />}>
                  <LazyAssignPhotographersCard
                    photographers={assignPhotographers}
                    onPhotographerSelect={setSelectedPhotographer}
                    onViewSchedule={() => navigate("/availability")}
                    availablePhotographerIds={availablePhotographerIds}
                    availabilityWindow={availabilityWindow}
                    onAvailabilityWindowChange={setAvailabilityWindow}
                    availabilityLoading={availabilityLoading}
                    availabilityError={availabilityError}
                  />
                </Suspense>
              </div>
            }
            rightColumnCards={[
              <Suspense key="rep-delivered" fallback={<CompletedShootsCardSkeleton />}>
                <LazyCompletedShootsCard
                  shoots={repDelivered}
                  title="Delivered shoots"
                  subtitle="Most recent handoffs"
                  emptyStateText="No delivered shoots yet."
                />
              </Suspense>,
              <Suspense key="rep-issues" fallback={<PendingReviewsCardSkeleton />}>
                <LazyIssuesListCard
                  issues={repIssues}
                  title="Client issues"
                  emptyStateText="No client issues right now."
                />
              </Suspense>,
              shouldLoadEditingRequests ? (
                <Suspense key="rep-editing-requests" fallback={<EditingRequestsCardSkeletonWrapper />}>
                  <LazyEditingRequestsCard
                    requests={editingRequests}
                    loading={editingRequestsLoading}
                    onCreate={() => setSpecialRequestOpen(true)}
                  />
                </Suspense>
              ) : null,
            ]}
            upcomingShoots={repUpcoming}
            pendingReviews={repPendingReviews}
            issues={repIssues}
            pendingCard={
              <PendingReviewsCard
                title="Pending reviews"
                reviews={repPendingReviews}
                issues={repIssues}
                onSelect={(shoot) => handleSelectShoot(shoot)}
                emptyReviewsText="No reviews awaiting attention."
                emptyIssuesText="No open issues."
              />
            }
            onSelectShoot={handleSelectShoot}
          />
          {shootDetailsModal}
        </>
      );
    }

    if (role === "editor") {
      const quickActions: QuickActionItem[] = [
        {
          id: "start-edit",
          label: "Start next edit",
          description: "Open top priority",
          icon: <Sparkles size={16} />,
          accent: "from-indigo-50 to-white text-indigo-600 dark:from-indigo-900/80 dark:to-indigo-800/80 dark:text-indigo-200",
          onClick: () => openFirstPendingShoot(editorPendingReviews, "editing queue"),
        },
        {
          id: "upload-edits",
          label: "Deliver edits",
          description: "Send to client",
          icon: <UploadCloud size={16} />,
          accent: "from-emerald-50 to-white text-emerald-600 dark:from-emerald-900/80 dark:to-emerald-800/80 dark:text-emerald-200",
          onClick: () => navigate("/media"),
        },
        {
          id: "flag",
          label: "Flag a shoot",
          description: "Document blockers",
          icon: <Flag size={16} />,
          accent: "from-amber-50 to-white text-amber-600 dark:from-amber-900/80 dark:to-amber-800/80 dark:text-amber-200",
          onClick: () =>
            toast({
              title: "Flag noted",
              description: "Tag ops in issues so they can follow up.",
            }),
        },
        {
          id: "sync-team",
          label: "Sync with team",
          description: "Drop a note in chat",
          icon: <MessageSquare size={16} />,
          accent: "from-rose-50 to-white text-rose-600 dark:from-rose-900/80 dark:to-rose-800/80 dark:text-rose-200",
          onClick: () => openSupportEmail("Team sync request"),
        },
      ];

      return (
        <>
          <RoleDashboardLayout
            title="Editor"
            description="Upcoming edits, review queue, and delivery progress."
            quickActions={quickActions}
            quickActionsEyebrow="Production"
            leftColumnCard={
              <Suspense fallback={<PendingReviewsCardSkeleton />}>
                <LazyIssuesListCard
                  issues={editorIssues}
                  title="Issues"
                  emptyStateText="No issues reported."
                />
              </Suspense>
            }
            rightColumnCards={[
              <Suspense key="delivered-edits" fallback={<CompletedShootsCardSkeleton />}>
                <LazyCompletedShootsCard
                  shoots={editorDelivered}
                  title="Delivered edits"
                  subtitle="Recently published"
                  emptyStateText="No delivered edits yet."
                />
              </Suspense>,
              shouldLoadEditingRequests ? (
                <Suspense key="editor-editing-requests" fallback={<EditingRequestsCardSkeletonWrapper />}>
                  <LazyEditingRequestsCard
                    requests={editingRequests}
                    loading={editingRequestsLoading}
                    onCreate={() => setSpecialRequestOpen(true)}
                  />
                </Suspense>
              ) : null,
            ]}
            upcomingShoots={editorUpcoming}
            pendingReviews={editorPendingReviews}
            issues={editorIssues}
            pendingCard={
              <PendingReviewsCard
                title="Editing queue"
                variant="reviews-only"
                reviews={editorPendingReviews}
                issues={[]}
                onSelect={(shoot) => handleSelectShoot(shoot)}
                emptyReviewsText="You're caught up!"
              />
            }
            onSelectShoot={handleSelectShoot}
          />
          {shootDetailsModal}
        </>
      );
    }

    return (
      <LegacyDashboardView
        shoots={shoots}
        role={role}
        title={greetingTitle}
        description={DASHBOARD_DESCRIPTION}
      />
    );
  }

  const mobileTabs = [
    {
      id: "upcoming",
      label: "Upcoming",
      content: renderUpcomingCard(),
    },
    {
      id: "completed",
      label: "Completed",
      content: renderCompletedShootsCard(),
    },
    {
      id: "assign",
      label: "Assign Photographers",
      content: renderAssignPhotographersCard(),
    },
    {
      id: "reviews",
      label: "Reviews & Requests",
      content: (
        <div className="space-y-4">
          {renderPendingReviewsCard()}
          {renderEditingRequestsCard()}
        </div>
      ),
    },
    {
      id: "pipeline",
      label: "Pipeline",
      content: renderPipelineSection(),
    },
  ] as const;

  const adminDesktopContent = (
    <>
      {/* KPI cards temporarily removed by request */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6 md:sticky md:top-6 h-full order-1 md:order-none">
          <div className="order-1 md:order-none">
            <QuickActionsCard actions={adminQuickActions} columns={1} />
          </div>
          <div id="assign-card" className="flex-1 min-h-0 flex flex-col hidden md:flex order-3 md:order-none">
            {renderAssignPhotographersCard()}
          </div>
        </div>

        <div className="md:col-span-6 flex flex-col h-full order-2 md:order-none">
          {renderUpcomingCard()}
        </div>

        <div className="lg:hidden order-3">{renderAssignPhotographersCard()}</div>

        <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6 md:sticky md:top-6 h-full order-4 md:order-none">
          {renderPendingReviewsCard()}
          {renderCompletedShootsCard()}
          {renderEditingRequestsCard()}
        </div>
      </div>

      {renderPipelineSection()}
    </>
  );

  const adminMobileContent = (
    <Tabs
      value={mobileDashboardTab}
      onValueChange={(val) => setMobileDashboardTab(val as MobileDashboardTab)}
      className="space-y-4"
    >
      <div className="sticky top-[-0.25rem] z-20 pb-2 -mx-3 px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="overflow-x-auto">
          <TabsList className="mx-auto inline-flex gap-2 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5">
            {mobileTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold tracking-tight transition-all duration-150 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground/80"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>
      {mobileTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-2 focus-visible:outline-none">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );

  return (
    <DashboardLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <PageHeader
          badge="Dashboard"
          title={greetingTitle}
          description={DASHBOARD_DESCRIPTION}
        />

        {error && (
          <div className="p-4 border border-rose-200 bg-rose-50 rounded-2xl text-sm text-rose-700">
            {error}
          </div>
        )}

        {isMobile ? adminMobileContent : adminDesktopContent}
      </div>

      {shootDetailsModal}

      <Suspense fallback={null}>
        <LazySpecialEditingRequestDialog
          open={specialRequestOpen}
          onOpenChange={setSpecialRequestOpen}
          shoots={role === "salesRep" ? repVisibleSummaries : data?.upcomingShoots || []}
        />
      </Suspense>
    </DashboardLayout>
  );
};

const LegacyDashboardView = ({
  shoots,
  role,
  title,
  description,
}: {
  shoots: ShootData[];
  role: string;
  title: string;
  description: string;
}) => {
  const showRevenue = ["admin", "superadmin"].includes(role);
  const showClientInterface = role === "client";
  const [invoiceTimeFilter, setInvoiceTimeFilter] = useState<
    "day" | "week" | "month" | "quarter" | "year"
  >("month");
  const invoices: InvoiceData[] = [];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          badge="Dashboard"
          title={title}
          description={description}
        />
        <ShootStatsCards shoots={shoots} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ShootScheduleCard shoots={shoots} />
            </motion.div>
          </div>
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <ShootApprovalsSection shoots={shoots} />
            </motion.div>
          </div>
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <ShootEditingSection shoots={shoots} />
            </motion.div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {!showClientInterface && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Suspense fallback={<SectionFallback label="Loading task manager..." />}>
                <LazyTaskManager />
              </Suspense>
            </motion.div>
          )}
          {showRevenue && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Suspense fallback={<SectionFallback label="Loading revenue trends..." />}>
                <LazyRevenueCharts
                  invoices={invoices}
                  timeFilter={invoiceTimeFilter}
                  onTimeFilterChange={setInvoiceTimeFilter}
                  variant="compact"
                />
              </Suspense>
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

interface RoleDashboardLayoutProps {
  title: string;
  description: string;
  quickActions: QuickActionItem[];
  quickActionsEyebrow?: string;
  leftColumnCard: React.ReactNode;
  rightColumnCards?: React.ReactNode[];
  upcomingShoots: DashboardShootSummary[];
  pendingReviews: DashboardShootSummary[];
  issues: DashboardIssueItem[];
  onSelectShoot: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
  pendingCard?: React.ReactNode;
  pendingTitle?: string;
  emptyPendingText?: string;
}

const RoleDashboardLayout: React.FC<RoleDashboardLayoutProps> = ({
  title,
  description,
  quickActions,
  quickActionsEyebrow,
  leftColumnCard,
  rightColumnCards = [],
  upcomingShoots,
  pendingReviews,
  issues,
  onSelectShoot,
  pendingCard,
  pendingTitle = "Pending reviews",
  emptyPendingText = "No items waiting.",
}) => {
  const pendingContent =
    pendingCard ||
    (
      <PendingReviewsCard
        title={pendingTitle}
        variant="reviews-only"
        reviews={pendingReviews}
        issues={issues}
        onSelect={onSelectShoot}
        emptyReviewsText={emptyPendingText}
      />
    );

  return (
    <DashboardLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <PageHeader badge="Dashboard" title={title} description={description} />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6 h-full order-1 md:order-none">
            <div className="order-1 md:order-none">
              <QuickActionsCard actions={quickActions} eyebrow={quickActionsEyebrow} columns={1} />
            </div>
            <div className="flex-1 min-h-0 flex flex-col hidden md:flex order-3 md:order-none">
              {leftColumnCard}
            </div>
          </div>
          <div className="md:col-span-6 flex flex-col h-full order-2 md:order-none">
            <UpcomingShootsCard shoots={upcomingShoots} onSelect={(shoot, weather) => onSelectShoot(shoot, weather)} />
          </div>
          {/* Left Column Card - Mobile only, appears after Upcoming Shoots */}
          <div className="md:hidden order-3">
            {leftColumnCard}
          </div>
        <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6 h-full order-4 md:order-none">
          {pendingContent}
          {rightColumnCards
            .filter((card): card is React.ReactNode => Boolean(card))
            .map((card, index) => (
              <React.Fragment key={index}>{card}</React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

interface ClientMyShootsProps {
  upcoming: ClientShootRecord[];
  completed: ClientShootRecord[];
  onHold: ClientShootRecord[];
  onSelect: (record: ClientShootRecord) => void;
  onReschedule: (record: ClientShootRecord) => void;
  onCancel: (record: ClientShootRecord) => void;
  onContactSupport: () => void;
  onDownload: (record: ClientShootRecord) => void;
  onRebook: (record: ClientShootRecord) => void;
  onRequestRevision: (record: ClientShootRecord) => void;
  onHoldAction: (record: ClientShootRecord) => void;
}

const ClientMyShoots: React.FC<ClientMyShootsProps> = ({
  upcoming,
  completed,
  onHold,
  onSelect,
  onReschedule,
  onCancel,
  onContactSupport,
  onDownload,
  onRebook,
  onRequestRevision,
  onHoldAction,
}) => {
  const tabs: Array<{ key: "upcoming" | "completed" | "hold"; label: string; count: number }> = [
    { key: "upcoming", label: "Upcoming", count: upcoming.length },
    { key: "completed", label: "Completed", count: completed.length },
    { key: "hold", label: "On hold", count: onHold.length },
  ];
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("upcoming");
  const list =
    activeTab === "upcoming" ? upcoming : activeTab === "completed" ? completed : onHold;

  return (
    <Card className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground">My shoots</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Track everything from booking to delivery.</p>
        </div>
        <div className="flex gap-2 sm:gap-4 text-xs sm:text-sm font-semibold overflow-x-auto pb-1 -mx-1 px-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-1 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {list.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">
            {activeTab === "upcoming" && "No upcoming shoots yet."}
            {activeTab === "completed" && "No delivered shoots yet."}
            {activeTab === "hold" && "No shoots on hold."}
          </div>
        ) : (
          list.map((record) => (
            <ClientShootTile
              key={record.data.id}
              record={record}
              variant={activeTab}
              onSelect={onSelect}
              onReschedule={onReschedule}
              onCancel={onCancel}
              onContactSupport={onContactSupport}
              onDownload={onDownload}
              onRebook={onRebook}
              onRequestRevision={onRequestRevision}
              onHoldAction={onHoldAction}
            />
          ))
        )}
      </div>
    </Card>
  );
};

interface ClientShootTileProps {
  record: ClientShootRecord;
  variant: "upcoming" | "completed" | "hold";
  onSelect: (record: ClientShootRecord) => void;
  onReschedule: (record: ClientShootRecord) => void;
  onCancel: (record: ClientShootRecord) => void;
  onContactSupport: () => void;
  onDownload: (record: ClientShootRecord) => void;
  onRebook: (record: ClientShootRecord) => void;
  onRequestRevision: (record: ClientShootRecord) => void;
  onHoldAction: (record: ClientShootRecord) => void;
}

const ClientShootTile: React.FC<ClientShootTileProps> = ({
  record,
  variant,
  onSelect,
  onReschedule,
  onCancel,
  onContactSupport,
  onDownload,
  onRebook,
  onRequestRevision,
  onHoldAction,
}) => {
  const { formatTime, formatDate } = useUserPreferences();
  const { data, summary } = record;
  const startDate = summary.startTime ? new Date(summary.startTime) : null;
  const completedDate = data.completedDate ? parseISO(data.completedDate) : null;
  const dateLabel = variant === "completed" && completedDate
    ? formatDate(completedDate)
    : startDate
      ? formatDate(startDate)
      : data.scheduledDate
        ? formatDate(parseISO(data.scheduledDate))
        : "Date TBD";
  const timeLabel = formatTime(summary.timeLabel || data.time || (variant === "completed" ? "Delivered" : "Time TBD"));
  const services = data.services?.length ? data.services : summary.services.map((service) => service.label);
  const instructions = getSpecialInstructions(data);
  const statusLabel = formatWorkflowStatus(summary.workflowStatus || summary.status);
  const weatherLabel = summary.temperature || "—";
  const photographerLabel = data.photographer?.name ? `${data.photographer.name}${data.photographer.avatar ? "" : ""}` : "Assigning";

  const holdActionLabel = (() => {
    const status = (summary.workflowStatus || summary.status || "").toLowerCase();
    if (status.includes("payment")) return "Pay invoice";
    if (status.includes("access")) return "Provide access info";
    if (status.includes("reschedule")) return "Confirm reschedule";
    if (status.includes("document")) return "Upload documents";
    return "Contact support";
  })();

  const serviceBadges = services.slice(0, 4);
  const overflow = services.length - serviceBadges.length;

  return (
    <div className="border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3 sm:space-y-4 hover:border-primary/40 transition-colors bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {dateLabel} • {timeLabel}
          </p>
          <button onClick={() => onSelect(record)} className="text-base sm:text-lg font-semibold text-left hover:underline break-words">
            {summary.addressLine}
          </button>
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-3">
            {serviceBadges.map((service) => (
              <Badge key={service} variant="outline" className="rounded-full text-[10px] sm:text-xs">
                {service}
              </Badge>
            ))}
            {overflow > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px] sm:text-xs">
                +{overflow}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right space-y-2 flex-shrink-0">
          <Badge variant="outline" className="uppercase tracking-widest text-[9px] sm:text-[10px]">
            {statusLabel}
          </Badge>
          <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
            <Sun size={12} className="sm:w-3.5 sm:h-3.5" />
            <span>{weatherLabel}</span>
          </div>
        </div>
      </div>

      {variant !== "hold" && (
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Photographer{" "}
            <span className="text-foreground font-semibold">
              • {photographerLabel}
            </span>
          </p>
          {instructions && (
            <p className="line-clamp-2">
              Instructions: <span className="text-foreground">{instructions}</span>
            </p>
          )}
        </div>
      )}

      {variant === "hold" && (
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Reason: {data.adminIssueNotes || "Awaiting your action"}</p>
          <p className="text-xs">
            Scheduled for {summary.startTime ? format(new Date(summary.startTime), "MMM d, h:mm a") : "TBD"}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {variant === "upcoming" && (
          <>
            <Button size="sm" className="text-xs sm:text-sm" onClick={() => onReschedule(record)}>
              Reschedule
            </Button>
            <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={onContactSupport}>
              Contact support
            </Button>
            <Button size="sm" variant="destructive" className="text-xs sm:text-sm" onClick={() => onCancel(record)}>
              Cancel shoot
            </Button>
          </>
        )}
        {variant === "completed" && (
          <>
            <Button size="sm" className="text-xs sm:text-sm" onClick={() => onDownload(record)}>
              Download final files
            </Button>
            <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={() => onRequestRevision(record)}>
              Request revision
            </Button>
            <Button size="sm" variant="ghost" className="text-xs sm:text-sm" onClick={() => onRebook(record)}>
              Rebook this shoot
            </Button>
          </>
        )}
        {variant === "hold" && (
          <>
            <Button size="sm" className="text-xs sm:text-sm" onClick={() => onHoldAction(record)}>
              {holdActionLabel}
            </Button>
            <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={onContactSupport}>
              Contact support
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

interface ClientInvoicesCardProps {
  summary: ReturnType<typeof buildClientInvoiceSummary>;
  onViewAll: () => void;
  onDownload: () => void;
  onPay: () => void;
}

const ClientInvoicesCard: React.FC<ClientInvoicesCardProps> = ({ summary, onViewAll, onDownload, onPay }) => (
  <Card className="flex flex-col gap-3 sm:gap-4">
    <div>
      <h2 className="text-base sm:text-lg font-bold text-foreground">Invoices & payments</h2>
      <p className="text-xs sm:text-sm text-muted-foreground">Stay current on outstanding balances.</p>
    </div>
    <div className="space-y-2 sm:space-y-3">
      {[
        { label: "Due now", data: summary.dueNow, icon: <CreditCard size={12} className="sm:w-3.5 sm:h-3.5" /> },
        { label: "Upcoming", data: summary.upcoming, icon: <FileText size={12} className="sm:w-3.5 sm:h-3.5" /> },
        { label: "Paid", data: summary.paid, icon: <FileDown size={12} className="sm:w-3.5 sm:h-3.5" /> },
      ].map((item) => (
        <div key={item.label} className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-border/70 px-2.5 sm:px-3 py-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
            {item.icon}
            {item.label}
          </div>
          <div className="text-right">
            <p className="text-base sm:text-lg font-semibold">{currencyFormatter.format(item.data.amount)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{item.data.count} invoices</p>
          </div>
        </div>
      ))}
    </div>
    <div className="grid gap-2">
      <Button size="sm" className="text-xs sm:text-sm" onClick={onViewAll}>
        View all invoices
      </Button>
      <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={onDownload}>
        Download invoice PDFs
      </Button>
      <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={onPay}>
        Make a payment
      </Button>
    </div>
  </Card>
);

export default Dashboard;
