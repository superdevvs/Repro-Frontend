import React, { Profiler, Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
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
  Download,
  Edit3,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useShoots } from "@/context/ShootsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { WeatherInfo } from "@/services/weatherService";
import { UpcomingShootsCard } from "@/components/dashboard/v2/UpcomingShootsCard";
import { PendingReviewsCard } from "@/components/dashboard/v2/PendingReviewsCard";
import { RequestedShootsCard } from "@/components/dashboard/v2/RequestedShootsCard";
import { ShootApprovalModal } from "@/components/shoots/ShootApprovalModal";
import { ShootDeclineModal } from "@/components/shoots/ShootDeclineModal";
import { ShootEditModal } from "@/components/shoots/ShootEditModal";
import { RescheduleDialog } from "@/components/dashboard/RescheduleDialog";
import { SquarePaymentDialog } from "@/components/payments/SquarePaymentDialog";
import { Avatar, Card, StatBadge } from "@/components/dashboard/v2/SharedComponents";
import { formatWorkflowStatus } from "@/utils/status";
import {
  buildClientInvoiceSummary,
  currencyFormatter,
  getGreetingPrefix,
  getSpecialInstructions,
  matchesStatus,
  shootDataToSummary,
  DELIVERED_STATUS_KEYWORDS,
} from "@/utils/dashboardDerivedUtils";
import type { ClientShootRecord } from "@/utils/dashboardDerivedUtils";
import type { UserRole } from "@/types/auth";
import { useDashboardDerivedData } from "@/hooks/useDashboardDerivedData";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DashboardPhotographerSummary,
  DashboardShootSummary,
  DashboardClientRequest,
} from "@/types/dashboard";
import { useToast } from "@/hooks/use-toast";
import type { ShootData } from "@/types/shoots";
import { fetchAvailablePhotographers } from "@/services/dashboardService";
import { API_BASE_URL } from "@/config/env";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { QuickActionsCard, type QuickActionItem } from "@/components/dashboard/v2/QuickActionsCard";
import {
  QuickActionsEditor,
  type CustomQuickAction,
  QUICK_ACTION_ICON_MAP,
  normalizeQuickActions,
} from "@/components/dashboard/v2/QuickActionsEditor";
import { useEditingRequests } from "@/hooks/useEditingRequests";
import { useIssueManager } from "@/context/IssueManagerContext";
import { UpcomingShootsCardSkeleton } from "@/components/dashboard/v2/UpcomingShootsCardSkeleton";
import { PendingReviewsCardSkeleton } from "@/components/dashboard/v2/PendingReviewsCardSkeleton";
import { CompletedShootsCardSkeleton } from "@/components/dashboard/v2/CompletedShootsCardSkeleton";
import { AssignPhotographersCardSkeleton } from "@/components/dashboard/v2/AssignPhotographersCardSkeleton";
import { EditingRequestsCardSkeletonWrapper } from "@/components/dashboard/v2/EditingRequestsCardSkeletonWrapper";
import { ProductionWorkflowBoardSkeleton } from "@/components/dashboard/v2/ProductionWorkflowBoardSkeleton";
import { RequestedShootsCardSkeleton } from "@/components/dashboard/v2/RequestedShootsCardSkeleton";
import { RequestedShootsSection } from "@/components/dashboard/v2/RequestedShootsSection";
import { ShootsTabsCard } from "@/components/dashboard/v2/ShootsTabsCard";
import { ErrorBoundary, withErrorBoundary } from "@/components/ui/ErrorBoundary";
import { InvoiceViewDialog } from "@/components/invoices/InvoiceViewDialog";
import { CancellationRequestsDialog } from "@/components/dashboard/CancellationRequestsDialog";

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

const WORKFLOW_SEQUENCE = [
  "booked",
  "photos_uploaded",
  "editing_complete",
  "pending_review",
  "admin_verified",
  "completed",
] as const;

const QUICK_ACTIONS_STORAGE_PREFIX = "repro.dashboard.quickActions";

const buildQuickActionsStorageKey = (role?: string | null, userId?: string | number | null) => {
  const safeRole = role ?? "default";
  const safeUser = userId != null ? String(userId) : null;
  const suffix = safeUser ? `.${safeUser}` : "";
  return `${QUICK_ACTIONS_STORAGE_PREFIX}.${safeRole}${suffix}`;
};

const getToken = (sessionToken?: string | null) =>
  sessionToken ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("token") ||
  undefined;

const DASHBOARD_DESCRIPTION =
  "Here's an overview of all your shoots, approvals, and editing status.";

const isProfilerLoggingEnabled = () => {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  try {
    const flag = window.localStorage.getItem("repro.debug.profiler");
    if (flag === "1" || flag === "true") {
      return true;
    }
  } catch {
    return false;
  }
  return (window as Window & { __REPRO_DEBUG_PROFILER__?: boolean })
    .__REPRO_DEBUG_PROFILER__ === true;
};

const logDashboardProfiler: React.ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  if (!isProfilerLoggingEnabled()) return;
  console.debug(`[Profiler:${id}]`, {
    phase,
    actualDuration: Number(actualDuration.toFixed(2)),
    baseDuration: Number(baseDuration.toFixed(2)),
    startTime: Number(startTime.toFixed(2)),
    commitTime: Number(commitTime.toFixed(2)),
  });
};

const DevProfiler: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) =>
  import.meta.env.DEV ? (
    <Profiler id={id} onRender={logDashboardProfiler}>
      {children}
    </Profiler>
  ) : (
    <>{children}</>
  );

type MobileDashboardTab = "shoots" | "assign" | "requests" | "completed" | "pipeline";

type CommandBarState = {
  openRequestManager?: boolean;
  selectedRequestId?: string | null;
  openEditingRequest?: boolean;
  editingRequestId?: number | null;
};

const Dashboard = () => {
  const { role, session, user } = useAuth();
  const { shoots, fetchShoots } = useShoots();
  const isMobile = useIsMobile();
  const isAdminExperience = ["admin", "superadmin", "editing_manager"].includes(role);
  const canLoadAvailability = isAdminExperience || role === "salesRep";
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { openModal } = useIssueManager();
  const { data, loading, error, refresh } = useDashboardOverview();
  const [selectedShoot, setSelectedShoot] = useState<DashboardShootSummary | null>(null);
  const [selectedShootWeather, setSelectedShootWeather] = useState<WeatherInfo | null>(null);
  const [selectedPhotographer, setSelectedPhotographer] =
    useState<DashboardPhotographerSummary | null>(null);
  const [specialRequestOpen, setSpecialRequestOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);
  const [mobileDashboardTab, setMobileDashboardTab] = useState<MobileDashboardTab>("shoots");
  const canCustomizeQuickActions = Boolean(user) && (role === 'admin' || role === 'superadmin');
  const quickActionsStorageKey = useMemo(
    () => buildQuickActionsStorageKey(role, user?.id),
    [role, user?.id],
  );
  const [customQuickActions, setCustomQuickActions] = useState<CustomQuickAction[]>([]);
  const [quickActionsEditorOpen, setQuickActionsEditorOpen] = useState(false);

  // Handler for selecting a shoot with optional weather data - memoized to prevent child re-renders
  const handleSelectShoot = useCallback((shoot: DashboardShootSummary, weather?: WeatherInfo | null) => {
    setSelectedShoot(shoot);
    setSelectedShootWeather(weather || null);
  }, []);

  useEffect(() => {
    if (!quickActionsStorageKey) return;
    try {
      const stored = localStorage.getItem(quickActionsStorageKey);
      if (stored) {
        const parsed: CustomQuickAction[] = JSON.parse(stored);
        setCustomQuickActions(normalizeQuickActions(parsed));
      } else {
        setCustomQuickActions([]);
      }
    } catch (storageError) {
      console.warn("Unable to load quick actions preferences", storageError);
      setCustomQuickActions([]);
    }
  }, [quickActionsStorageKey]);

  const saveCustomQuickActions = useCallback(
    (actions: CustomQuickAction[]) => {
      const normalized = normalizeQuickActions(actions);
      setCustomQuickActions(normalized);
      if (!quickActionsStorageKey) return;
      try {
        localStorage.setItem(quickActionsStorageKey, JSON.stringify(normalized));
      } catch (storageError) {
        console.warn("Unable to persist quick actions preferences", storageError);
      }
    },
    [quickActionsStorageKey],
  );

  const customQuickActionItems = useMemo<QuickActionItem[]>(() => {
    if (!customQuickActions.length) return [];
    return customQuickActions.map((action) => {
      const IconComponent = QUICK_ACTION_ICON_MAP[action.icon] ?? CheckCircle2;
      return {
        id: `custom-${action.id}`,
        label: action.label,
        description: action.description,
        icon: <IconComponent size={16} />,
        accent: action.accent,
        onClick: () => {
          const target = action.url.trim();
          if (!target) return;
          if (/^https?:/i.test(target)) {
            if (typeof window !== "undefined") {
              window.open(target, "_blank", "noopener,noreferrer");
            }
          } else {
            navigate(target.startsWith("/") ? target : `/${target}`);
          }
        },
      } satisfies QuickActionItem;
    });
  }, [customQuickActions, navigate]);

  const handleOpenQuickActionsEditor = useCallback(() => {
    setQuickActionsEditorOpen(true);
  }, []);

  const withCustomQuickActions = useCallback(
    (actions: QuickActionItem[]) =>
      customQuickActionItems.length ? [...actions, ...customQuickActionItems] : actions,
    [customQuickActionItems],
  );

  // Refresh handler for when shoot is updated
  // The context update happens synchronously, so summaryMap and allSummaries will update immediately
  // This means the dashboard cards will show changes right away without needing a server refresh
  const handleShootUpdate = useCallback(() => {
    // The context update already happened synchronously in the modal
    // summaryMap depends on shoots from context, so it will update automatically
    // allSummaries depends on summaryMap, so it will also update
    // upcomingShootsWithoutRequested depends on allSummaries, so it will update too
    // This means the dashboard will re-render with the updated data immediately
    if (import.meta.env.DEV) {
      console.log('💾 Shoot updated - context refreshed, dashboard will update automatically via React re-render');
    }
    
    // Optionally refresh shoots from server in background (non-blocking, errors suppressed)
    // This ensures we have the latest data from server, but doesn't block the UI update
    if (fetchShoots) {
      fetchShoots().catch((error) => {
        // Silently handle errors - context is already updated, so UI already shows changes
        if (import.meta.env.DEV) {
          console.log('💾 Background fetchShoots failed (non-critical):', error);
        }
      });
    }
  }, [fetchShoots]);

  // Invoice dialog state - must be defined before shootDetailsModal
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Handler for viewing invoice from shoot cards
  const handleViewInvoice = useCallback(async (shoot: DashboardShootSummary) => {
    setInvoiceLoading(true);
    try {
      const token = session?.accessToken || localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/invoice`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch invoice');
      }

      const data = await res.json();
      const invoiceData = data.data || data;
      if (invoiceData) {
        setSelectedInvoice(invoiceData);
        setInvoiceDialogOpen(true);
      } else {
        toast({
          title: 'Invoice not found',
          description: 'Unable to load invoice for this shoot.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      toast({
        title: 'Error loading invoice',
        description: error.message || 'Unable to load invoice. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setInvoiceLoading(false);
    }
  }, [session?.accessToken, toast]);

  const shootDetailsModal = (
    <>
      <Suspense fallback={null}>
        <LazyShootDetailsModal 
          shoot={selectedShoot} 
          onClose={() => { setSelectedShoot(null); setSelectedShootWeather(null); }} 
          weather={selectedShootWeather}
          onShootUpdate={handleShootUpdate}
          onViewInvoice={handleViewInvoice}
        />
      </Suspense>
      {/* Invoice View Dialog */}
      {selectedInvoice && (
        <InvoiceViewDialog
          isOpen={invoiceDialogOpen}
          onClose={() => {
            setInvoiceDialogOpen(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
        />
      )}
    </>
  );

  const quickActionsEditor = canCustomizeQuickActions ? (
    <QuickActionsEditor
      open={quickActionsEditorOpen}
      actions={customQuickActions}
      onOpenChange={setQuickActionsEditorOpen}
      onSave={saveCustomQuickActions}
    />
  ) : null;

  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";
  const greetingPrefix = getGreetingPrefix();
  const greetingTitle = (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span className="font-light">{greetingPrefix}</span>
      <span className="font-bold">{firstName}</span>
    </span>
  );

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

  const {
    allSummaries,
    editorUpcoming,
    editorPendingReviews,
    editorCompleted,
    editorDelivered,
    photographerUpcoming,
    photographerCompleted,
    photographerDelivered,
    photographerPendingReviews,
    requestedShoots,
    upcomingShootsWithoutRequested,
    clientShoots,
    clientUpcomingRecords,
    clientCompletedRecords,
    clientOnHoldRecords,
    repVisibleSummaries,
    repUpcoming,
    repPendingReviews,
    repDelivered,
    clientLatestCompleted,
    clientInvoiceSummary,
    fallbackPhotographers,
  } = useDashboardDerivedData({ shoots, role, user: user ?? null });

  // Fetch actual invoices for client invoice summary
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  
  useEffect(() => {
    if (role !== 'client' || !user) return;
    
    const fetchInvoices = async () => {
      setInvoicesLoading(true);
      try {
        // The global fetch polyfill in api.ts automatically injects
        // Authorization and X-Impersonate-User-Id headers for /api/ calls.
        const res = await fetch(`${API_BASE_URL}/api/invoices?client_id=${user.id}`, {
          headers: { 'Accept': 'application/json' },
        });
        
        if (res.ok) {
          const json = await res.json();
          const invoices = json.data || json || [];
          setClientInvoices(Array.isArray(invoices) ? invoices : []);
        }
      } catch (error) {
        console.error('Error fetching invoices:', error);
        setClientInvoices([]);
      } finally {
        setInvoicesLoading(false);
      }
    };
    
    fetchInvoices();
  }, [role, user, clientShoots.length]);
  
  const shouldLoadEditingRequests = isAdminExperience || role === "salesRep" || role === "editor";
  const { 
    requests: editingRequests, 
    loading: editingRequestsLoading,
    updateRequest: updateEditingRequest,
    removeRequest: removeEditingRequest,
    refresh: refreshEditingRequests,
  } = useEditingRequests(shouldLoadEditingRequests);

  // Fetch client requests for admin dashboard
  const [clientRequests, setClientRequests] = useState<DashboardClientRequest[]>([]);
  const [clientRequestsLoading, setClientRequestsLoading] = useState(false);
  
  useEffect(() => {
    if (!isAdminExperience) return;
    
    const fetchClientRequests = async () => {
      setClientRequestsLoading(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/client-requests`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        
        if (res.ok) {
          const json = await res.json();
          const data = Array.isArray(json.data) ? json.data : [];
          setClientRequests(data as DashboardClientRequest[]);
        } else {
          setClientRequests([]);
        }
      } catch (error) {
        console.error('Error fetching client requests:', error);
        setClientRequests([]);
      } finally {
        setClientRequestsLoading(false);
      }
    };
    
    fetchClientRequests();
  }, [isAdminExperience]);

  // Count shoots with pending cancellation requests (requested but not yet cancelled)
  const cancellationRequestCount = useMemo(() => {
    if (!isAdminExperience) return 0;
    return shoots.filter(s => {
      const hasRequest = !!(s.cancellationRequestedAt || (s as any).cancellation_requested_at);
      if (!hasRequest) return false;
      const status = (s.workflowStatus || s.status || '').toLowerCase();
      return !status.includes('canceled') && !status.includes('cancelled');
    }).length;
  }, [shoots, isAdminExperience]);

  useEffect(() => {
    const state = location.state as CommandBarState | null;
    if (!state) return;

    let handled = false;

    if (state.openRequestManager && isAdminExperience && !clientRequestsLoading) {
      openModal(clientRequests, state.selectedRequestId ?? null);
      handled = true;
    }

    if (state.openEditingRequest) {
      setSelectedRequestId(
        typeof state.editingRequestId === "number" ? state.editingRequestId : null,
      );
      setSpecialRequestOpen(true);
      handled = true;
    }

    if (handled) {
      navigate("/dashboard", { replace: true, state: {} });
    }
  }, [
    clientRequests,
    clientRequestsLoading,
    isAdminExperience,
    location.state,
    navigate,
    openModal,
  ]);

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
        accent: "from-white/95 via-emerald-50/70 to-emerald-100/80 text-emerald-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-emerald-900/30 dark:text-emerald-200",
        onClick: handleClientBookShoot,
      },
      {
        id: "make-request",
        label: "Make a request",
        description: "Request edits or changes",
        icon: <AlertCircle size={16} />,
        accent: "from-white/95 via-rose-50/70 to-rose-100/80 text-rose-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-rose-900/30 dark:text-rose-200",
        onClick: handleClientReportIssue,
      },
      {
        id: "download-last",
        label: "Download last shoot",
        description: "Grab final files instantly",
        icon: <DownloadCloud size={16} />,
        accent: "from-white/95 via-sky-50/70 to-sky-100/80 text-sky-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-sky-900/30 dark:text-sky-200",
        onClick: handleClientDownloadLast,
      },
      {
        id: "view-tour",
        label: "View a tour",
        description: "Open a delivered 3D tour",
        icon: <PlayCircle size={16} />,
        accent: "from-white/95 via-violet-50/70 to-violet-100/80 text-violet-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-violet-900/30 dark:text-violet-200",
        onClick: handleClientViewTour,
      },
    ];
  }, [role, handleClientBookShoot, handleClientReportIssue, handleClientDownloadLast, handleClientViewTour]);

  const assignPhotographers = Array.isArray(data?.photographers) && data.photographers.length
    ? data.photographers
    : Array.isArray(fallbackPhotographers) ? fallbackPhotographers : [];

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
      id: "requests-queue",
      label: "Requests",
      description: "View active requests",
      icon: <CheckCircle2 size={16} />,
      accent: "from-white/95 via-emerald-50/70 to-emerald-100/80 text-emerald-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-emerald-900/30 dark:text-emerald-200",
      onClick: () => {
        const requestsSection = document.getElementById('requests-queue');
        if (requestsSection) {
          requestsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        toast({
          title: "No requests",
          description: "All requests are clear right now.",
        });
      },
    },
    {
      id: "manage-availability",
      label: "Manage availability",
      description: "Update roster coverage",
      icon: <CalendarDays size={16} />,
      accent: "from-white/95 via-amber-50/70 to-amber-100/80 text-amber-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-amber-900/30 dark:text-amber-200",
      onClick: () => navigate("/availability"),
    },
    {
      id: "chat-with-robbie",
      label: "Chat with robbie",
      description: "Get instant answers",
      icon: <MessageSquare size={16} />,
      accent: "from-white/95 via-sky-50/70 to-sky-100/80 text-sky-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-sky-900/30 dark:text-sky-200",
      onClick: () => navigate("/chat-with-reproai"),
    },
    {
      id: "special-editing-request",
      label: "Special editing request",
      description: "Route tasks to editors",
      icon: <Sparkles size={16} />,
      accent: "from-white/95 via-violet-50/70 to-violet-100/80 text-violet-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-violet-900/30 dark:text-violet-200",
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

  // Delivered shoots - filter for ready_for_client, delivered, admin_verified statuses
  const deliveredShoots = useMemo(() => {
    if (!data?.workflow || !Array.isArray(data.workflow.columns)) return [];
    return data.workflow.columns
      .filter((column) => {
        const key = column.key.toLowerCase();
        // Focus on delivered/ready statuses only
        return key.includes("ready") || key.includes("deliver") || key.includes("verified");
      })
      .flatMap((column) => Array.isArray(column.shoots) ? column.shoots : [])
      .sort((a, b) => {
        // Sort by most recent first
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

  // Handle pipeline move back
  const handleMoveBack = useCallback(
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
      if (index <= 0) {
        toast({
          title: "Already at first stage",
          description: "This shoot cannot be moved back further.",
        });
        return;
      }

      const prev = WORKFLOW_SEQUENCE[index - 1];

      try {
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ workflow_status: prev }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to update workflow status");
        toast({
          title: "Workflow moved back",
          description: `Shoot moved to ${prev.replace("_", " ")}.`,
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

  // Listen for pipeline:move-back custom event
  useEffect(() => {
    const handler = (e: CustomEvent<DashboardShootSummary>) => {
      handleMoveBack(e.detail);
    };
    window.addEventListener('pipeline:move-back', handler as EventListener);
    return () => window.removeEventListener('pipeline:move-back', handler as EventListener);
  }, [handleMoveBack]);

  // Pipeline date filter
  const [pipelineFilter, setPipelineFilter] = useState<"today" | "this_week" | "month">("this_week");

  const renderAssignPhotographersCard = () => (
    <ErrorBoundary
      fallback={
        <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Unable to load photographers
        </div>
      }
    >
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
    </ErrorBoundary>
  );

  const [approvalModalShoot, setApprovalModalShoot] = useState<DashboardShootSummary | null>(null);
  const [declineModalShoot, setDeclineModalShoot] = useState<DashboardShootSummary | null>(null);
  const [editModalShoot, setEditModalShoot] = useState<DashboardShootSummary | null>(null);

  // Client-specific state (must be declared unconditionally per React hooks rules)
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [shootToReschedule, setShootToReschedule] = useState<ShootData | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [shootToPay, setShootToPay] = useState<ClientShootRecord | null>(null);
  const [squarePaymentOpen, setSquarePaymentOpen] = useState(false);
  const [paymentSelectionOpen, setPaymentSelectionOpen] = useState(false);
  const [selectedShootsForPayment, setSelectedShootsForPayment] = useState<ClientShootRecord[]>([]);
  const [multiPaymentOpen, setMultiPaymentOpen] = useState(false);

  const renderUpcomingCard = () =>
    loading && !data ? (
      <UpcomingShootsCardSkeleton />
    ) : (
      <UpcomingShootsCard 
        shoots={upcomingShootsWithoutRequested} 
        onSelect={handleSelectShoot}
        onViewInvoice={handleViewInvoice}
        role={role}
      />
    );

  const renderPendingReviewsCard = () =>
    loading && !data ? (
      <PendingReviewsCardSkeleton />
    ) : (
      <PendingReviewsCard
        reviews={data?.pendingReviews || []}
        issues={[]}
        onSelect={(shoot) => handleSelectShoot(shoot)}
        emptyRequestsText="No active requests."
        title="Requests"
        editingRequests={editingRequests}
        editingRequestsLoading={editingRequestsLoading}
        onCreateEditingRequest={() => {
          setSelectedRequestId(null);
          setSpecialRequestOpen(true);
        }}
        onEditingRequestClick={(requestId) => {
          setSelectedRequestId(requestId);
          setSpecialRequestOpen(true);
        }}
        showEditingTab={shouldLoadEditingRequests}
        clientRequests={clientRequests}
        clientRequestsLoading={clientRequestsLoading}
        showClientTab={isAdminExperience}
      />
    );

  const renderCompletedShootsCard = () => (
    <Suspense fallback={<CompletedShootsCardSkeleton />}>
      <LazyCompletedShootsCard 
        shoots={deliveredShoots} 
        onSelect={handleSelectShoot}
        onViewInvoice={handleViewInvoice}
        onViewAll={() => navigate('/shoot-history?tab=delivered')}
      />
    </Suspense>
  );

  const renderEditingRequestsCard = () =>
    shouldLoadEditingRequests ? (
      <Suspense fallback={<EditingRequestsCardSkeletonWrapper />}>
        <LazyEditingRequestsCard
          requests={editingRequests}
          loading={editingRequestsLoading}
          onCreate={() => {
            setSelectedRequestId(null);
            setSpecialRequestOpen(true);
          }}
          onRequestClick={(requestId) => {
            setSelectedRequestId(requestId);
            setSpecialRequestOpen(true);
          }}
          onUpdate={updateEditingRequest}
          onDelete={isAdminExperience ? removeEditingRequest : undefined}
        />
      </Suspense>
    ) : null;

  const renderRequestedShootsSection = () =>
    loading && !data ? (
      <RequestedShootsCardSkeleton />
    ) : requestedShoots.length > 0 ? (
      <RequestedShootsSection
        shoots={requestedShoots}
        onSelect={handleSelectShoot}
        onApprove={(shoot) => setApprovalModalShoot(shoot)}
        onDecline={(shoot) => setDeclineModalShoot(shoot)}
        onModify={(shoot) => setEditModalShoot(shoot)}
      />
    ) : null;

  const renderShootsTabsCard = () =>
    loading && !data ? (
      <UpcomingShootsCardSkeleton />
    ) : (
      <ShootsTabsCard
        upcomingShoots={upcomingShootsWithoutRequested}
        requestedShoots={requestedShoots}
        onSelect={handleSelectShoot}
        onApprove={(shoot) => setApprovalModalShoot(shoot)}
        onDecline={(shoot) => setDeclineModalShoot(shoot)}
        onModify={(shoot) => setEditModalShoot(shoot)}
        onViewInvoice={handleViewInvoice}
      />
    );

  const pipelineFilterButtons = [
    { key: 'today' as const, label: 'Today' },
    { key: 'this_week' as const, label: 'This Week' },
    { key: 'month' as const, label: 'Month' },
  ];

  const renderPipelineSection = () => (
    <div className="space-y-3 w-full max-w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-[0.3em]">
          Pipeline
        </h2>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
          {pipelineFilterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setPipelineFilter(btn.key)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                pipelineFilter === btn.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      <ErrorBoundary
        fallback={
          <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-3xl text-muted-foreground">
            <p className="text-sm">Unable to load workflow board</p>
          </div>
        }
      >
        <Suspense fallback={<ProductionWorkflowBoardSkeleton />}>
          <LazyProductionWorkflowBoard
            workflow={filteredWorkflow}
            loading={loading}
            onSelectShoot={handleSelectShoot}
            onAdvanceStage={handleAdvanceStage}
            filter={pipelineFilter}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );

  // Optimize workflow filtering
  // Show all shoots in pipeline regardless of date - only exclude delivered shoots
  // The date range filter is removed so uploaded/editing shoots from past dates remain visible
  const filteredWorkflow = useMemo(() => {
    if (!data?.workflow || !Array.isArray(data.workflow.columns)) return null;

    // Return all workflow columns without date filtering
    // This ensures scheduled, uploaded, and editing shoots are visible until delivered
    const columns = data.workflow.columns.map((column) => {
      // Ensure shoots is an array
      const shoots = Array.isArray(column.shoots) ? column.shoots : [];
      
      // Filter out delivered shoots only (they should not appear in pipeline)
      const filteredShoots = shoots.filter((shoot) => {
        const statusKey = (shoot.workflowStatus || shoot.status || '').toLowerCase();
        // Exclude delivered/finalized shoots
        return !matchesStatus(shoot, DELIVERED_STATUS_KEYWORDS);
      });
      
      return {
        ...column,
        shoots: filteredShoots,
        count: filteredShoots.length,
      };
    });

    return { columns };
  }, [data?.workflow]);

  if (!isAdminExperience) {
    if (role === "client") {
      const handleReschedule = (record: ClientShootRecord) => {
        setShootToReschedule(record.data);
        setRescheduleDialogOpen(true);
      };
      const handleCancelShoot = async (record: ClientShootRecord) => {
        try {
          const token = localStorage.getItem('authToken') || localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/shoots/${record.data.id}/request-cancellation`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ reason: 'Client requested cancellation' }),
          });
          
          if (response.ok) {
            toast({
              title: "Cancellation request submitted",
              description: `Your cancellation request for ${record.summary.addressLine} is pending admin approval.`,
            });
            refresh();
          } else {
            const error = await response.json();
            toast({
              title: "Error",
              description: error.message || "Failed to request cancellation",
              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to request cancellation. Please try again.",
            variant: "destructive",
          });
        }
      };
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
              <PageHeader title={greetingTitle} description={DASHBOARD_DESCRIPTION} />
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
                <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6">
                  <QuickActionsCard
                    actions={withCustomQuickActions(clientQuickActions)}
                    eyebrow="Quick actions"
                    columns={1}
                    onEdit={canCustomizeQuickActions ? handleOpenQuickActionsEditor : undefined}
                  />
                  <ClientInvoicesCard
                    summary={clientInvoiceSummary}
                    onViewAll={() => navigate("/invoices")}
                    onDownload={() => navigate("/invoices")}
                    onPay={() => {
                      setSelectedShootsForPayment([]);
                      setPaymentSelectionOpen(true);
                    }}
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
                    onPayment={(record) => {
                      setShootToPay(record);
                      setPaymentModalOpen(true);
                    }}
                    onBookNewShoot={() => navigate("/book-shoot")}
                  />
                </div>
              </div>
            </div>
          </DashboardLayout>
          {shootDetailsModal}
          {quickActionsEditor}
          {shootToReschedule && (
            <RescheduleDialog
              shoot={shootToReschedule}
              isOpen={rescheduleDialogOpen}
              onClose={() => {
                setRescheduleDialogOpen(false);
                setShootToReschedule(null);
              }}
              onSuccess={() => {
                refresh();
              }}
            />
          )}
          
          {/* Payment Modal */}
          <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Complete Payment
                </DialogTitle>
                <DialogDescription>
                  Secure your booking by completing the payment now.
                </DialogDescription>
              </DialogHeader>
              
              {shootToPay && (
                <div className="space-y-4 py-4">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Property</span>
                      <span className="font-medium">{shootToPay.summary.addressLine}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Scheduled</span>
                      <span className="font-medium">
                        {shootToPay.summary.startTime 
                          ? format(new Date(shootToPay.summary.startTime), "MMM d, yyyy 'at' h:mm a")
                          : shootToPay.data.scheduledDate || "TBD"
                        }
                      </span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Balance Due</span>
                      <span className="font-bold text-lg text-green-600">
                        ${((shootToPay.data.payment?.totalQuote ?? 0) - (shootToPay.data.payment?.totalPaid ?? 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground text-center">
                    You can also pay later from your invoices page.
                  </p>
                </div>
              )}
              
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Pay Later
                </Button>
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700" 
                  onClick={() => {
                    setPaymentModalOpen(false);
                    // Open Square Payment Dialog
                    setSquarePaymentOpen(true);
                  }}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay Now
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Square Payment Dialog */}
          {shootToPay && (
            <SquarePaymentDialog
              isOpen={squarePaymentOpen}
              onClose={() => {
                setSquarePaymentOpen(false);
                setShootToPay(null);
              }}
              amount={(shootToPay.data.payment?.totalQuote ?? 0) - (shootToPay.data.payment?.totalPaid ?? 0)}
              shootId={shootToPay.data.id}
              shootAddress={shootToPay.summary.addressLine}
              shootServices={shootToPay.summary.services?.map((s: any) => typeof s === 'string' ? s : s?.name || s?.label || String(s)).filter(Boolean) || []}
              shootDate={shootToPay.data.scheduledDate}
              shootTime={shootToPay.data.time}
              clientName={user?.name}
              clientEmail={user?.email}
              totalQuote={shootToPay.data.payment?.totalQuote}
              totalPaid={shootToPay.data.payment?.totalPaid}
              onPaymentSuccess={() => {
                setSquarePaymentOpen(false);
                setShootToPay(null);
                refresh();
                toast({
                  title: "Payment successful",
                  description: "Your payment has been processed successfully.",
                });
              }}
            />
          )}

          {/* Payment Selection Modal */}
          <Dialog open={paymentSelectionOpen} onOpenChange={setPaymentSelectionOpen}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Select Shoots to Pay
                </DialogTitle>
                <DialogDescription>
                  Choose one or more shoots to pay. You can pay multiple at once.
                </DialogDescription>
              </DialogHeader>
              
              {(() => {
                // Get all unpaid shoots
                const allUnpaidShoots = [...clientUpcomingRecords, ...clientCompletedRecords, ...clientOnHoldRecords]
                  .filter(record => {
                    const balance = (record.data.payment?.totalQuote ?? 0) - (record.data.payment?.totalPaid ?? 0);
                    return balance > 1;
                  });
                
                const deliveredStatuses = ['delivered', 'admin_verified', 'ready', 'ready_for_client', 'completed', 'finalized'];
                const dueNowShoots = allUnpaidShoots.filter(record => {
                  const status = (record.data.workflowStatus || record.data.status || '').toLowerCase();
                  return deliveredStatuses.some(s => status.includes(s));
                });
                const upcomingShoots = allUnpaidShoots.filter(record => {
                  const status = (record.data.workflowStatus || record.data.status || '').toLowerCase();
                  return !deliveredStatuses.some(s => status.includes(s));
                });
                
                const isSelected = (record: ClientShootRecord) => 
                  selectedShootsForPayment.some(s => s.data.id === record.data.id);
                
                const toggleSelection = (record: ClientShootRecord) => {
                  if (isSelected(record)) {
                    setSelectedShootsForPayment(prev => prev.filter(s => s.data.id !== record.data.id));
                  } else {
                    setSelectedShootsForPayment(prev => [...prev, record]);
                  }
                };
                
                const totalSelected = selectedShootsForPayment.reduce((sum, record) => {
                  return sum + ((record.data.payment?.totalQuote ?? 0) - (record.data.payment?.totalPaid ?? 0));
                }, 0);
                
                const renderShootItem = (record: ClientShootRecord) => {
                  const balance = (record.data.payment?.totalQuote ?? 0) - (record.data.payment?.totalPaid ?? 0);
                  return (
                    <div 
                      key={record.data.id}
                      onClick={() => toggleSelection(record)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected(record) 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected(record)}
                        onChange={() => toggleSelection(record)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{record.summary.addressLine}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.data.scheduledDate ? format(new Date(record.data.scheduledDate), 'MMM d, yyyy') : 'TBD'}
                        </p>
                      </div>
                      <span className="font-bold text-green-600">${balance.toFixed(2)}</span>
                    </div>
                  );
                };
                
                return (
                  <div className="space-y-4 py-2">
                    {dueNowShoots.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-red-600 mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          Due Now ({dueNowShoots.length})
                        </h4>
                        <div className="space-y-2">
                          {dueNowShoots.map(renderShootItem)}
                        </div>
                      </div>
                    )}
                    
                    {upcomingShoots.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-blue-600 mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          Upcoming ({upcomingShoots.length})
                        </h4>
                        <div className="space-y-2">
                          {upcomingShoots.map(renderShootItem)}
                        </div>
                      </div>
                    )}
                    
                    {allUnpaidShoots.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No outstanding payments</p>
                      </div>
                    )}
                    
                    {selectedShootsForPayment.length > 0 && (
                      <div className="border-t pt-4 mt-4">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-sm text-muted-foreground">
                            {selectedShootsForPayment.length} shoot{selectedShootsForPayment.length > 1 ? 's' : ''} selected
                          </span>
                          <span className="font-bold text-lg text-green-600">
                            Total: ${totalSelected.toFixed(2)}
                          </span>
                        </div>
                        <Button 
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            setPaymentSelectionOpen(false);
                            if (selectedShootsForPayment.length === 1) {
                              setShootToPay(selectedShootsForPayment[0]);
                              setSquarePaymentOpen(true);
                            } else {
                              setMultiPaymentOpen(true);
                            }
                          }}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Pay ${totalSelected.toFixed(2)}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>

          {/* Multi-Payment Dialog */}
          {selectedShootsForPayment.length > 1 && (
            <SquarePaymentDialog
              isOpen={multiPaymentOpen}
              onClose={() => {
                setMultiPaymentOpen(false);
                setSelectedShootsForPayment([]);
              }}
              amount={selectedShootsForPayment.reduce((sum, record) => 
                sum + ((record.data.payment?.totalQuote ?? 0) - (record.data.payment?.totalPaid ?? 0)), 0
              )}
              shootId={selectedShootsForPayment.map(r => r.data.id).join(',')}
              shootAddress={`${selectedShootsForPayment.length} shoots selected`}
              shootServices={[`${selectedShootsForPayment.length} shoots`]}
              clientName={user?.name}
              clientEmail={user?.email}
              totalQuote={selectedShootsForPayment.reduce((sum, r) => sum + (r.data.payment?.totalQuote ?? 0), 0)}
              totalPaid={selectedShootsForPayment.reduce((sum, r) => sum + (r.data.payment?.totalPaid ?? 0), 0)}
              onPaymentSuccess={() => {
                setMultiPaymentOpen(false);
                setSelectedShootsForPayment([]);
                refresh();
                toast({
                  title: "Payment successful",
                  description: `Payment for ${selectedShootsForPayment.length} shoots has been processed successfully.`,
                });
              }}
            />
          )}
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
            title={greetingTitle}
            description="Field schedule, quick actions, and delivery milestones."
            quickActions={withCustomQuickActions(quickActions)}
            quickActionsEyebrow="Workflow"
            leftColumnCard={
              <PendingReviewsCard
                title="Requests"
                reviews={[]}
                issues={[]}
                onSelect={(shoot) => handleSelectShoot(shoot)}
                emptyRequestsText="No active requests."
              />
            }
            rightColumnCards={[
              <Suspense key="completed-shoots" fallback={<CompletedShootsCardSkeleton />}>
                <LazyCompletedShootsCard
                  shoots={photographerDelivered}
                  title="Completed shoots"
                  subtitle="Ready for clients"
                  emptyStateText="No completed shoots yet."
                  onViewAll={() => navigate('/shoot-history?tab=delivered')}
                />
              </Suspense>,
            ]}
            upcomingShoots={photographerUpcoming}
            pendingReviews={photographerPendingReviews}
            pendingCard={null}
            onSelectShoot={handleSelectShoot}
            canCustomizeQuickActions={canCustomizeQuickActions}
            onEditQuickActions={handleOpenQuickActionsEditor}
            role="photographer"
          />
          {shootDetailsModal}
          {quickActionsEditor}
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
            quickActions={withCustomQuickActions(quickActions)}
            quickActionsEyebrow="Pipeline"
            leftColumnCard={
              <ErrorBoundary
                fallback={
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Unable to load photographers
                  </div>
                }
              >
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
              </ErrorBoundary>
            }
            rightColumnCards={[
              <Suspense key="rep-delivered" fallback={<CompletedShootsCardSkeleton />}>
                <LazyCompletedShootsCard
                  shoots={repDelivered}
                  title="Delivered shoots"
                  subtitle="Most recent handoffs"
                  emptyStateText="No delivered shoots yet."
                  onViewAll={() => navigate('/shoot-history?tab=delivered')}
                />
              </Suspense>,
              shouldLoadEditingRequests ? (
                <Suspense key="rep-editing-requests" fallback={<EditingRequestsCardSkeletonWrapper />}>
                  <LazyEditingRequestsCard
                    requests={editingRequests}
                    loading={editingRequestsLoading}
                    onCreate={() => {
                      setSelectedRequestId(null);
                      setSpecialRequestOpen(true);
                    }}
                    onRequestClick={(requestId) => {
                      setSelectedRequestId(requestId);
                      setSpecialRequestOpen(true);
                    }}
                    onUpdate={updateEditingRequest}
                    onDelete={isAdminExperience ? removeEditingRequest : undefined}
                  />
                </Suspense>
              ) : null,
            ]}
            upcomingShoots={repUpcoming}
            pendingReviews={repPendingReviews}
            pendingCard={
              <PendingReviewsCard
                title="Requests"
                reviews={[]}
                issues={[]}
                onSelect={(shoot) => handleSelectShoot(shoot)}
                emptyRequestsText="No active requests."
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
          description: "Document blockers for review",
          icon: <Flag size={16} />,
          accent: "from-amber-50 to-white text-amber-600 dark:from-amber-900/80 dark:to-amber-800/80 dark:text-amber-200",
          onClick: () =>
            toast({
              title: "Flag noted",
              description: "Tag ops in requests so they can follow up.",
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
            description="Upcoming edits, requests, and delivery progress."
            quickActions={withCustomQuickActions(quickActions)}
            quickActionsEyebrow="Production"
            leftColumnCard={
              shouldLoadEditingRequests ? (
                <Suspense fallback={<EditingRequestsCardSkeletonWrapper />}>
                  <LazyEditingRequestsCard
                    requests={editingRequests}
                    loading={editingRequestsLoading}
                    onUpdate={updateEditingRequest}
                  />
                </Suspense>
              ) : (
                <Suspense fallback={<EditingRequestsCardSkeletonWrapper />}>
                  <LazyEditingRequestsCard
                    requests={[]}
                    loading={editingRequestsLoading}
                  />
                </Suspense>
              )
            }
            rightColumnCards={[
              <Suspense key="delivered-edits" fallback={<CompletedShootsCardSkeleton />}>
                <LazyCompletedShootsCard
                  shoots={editorDelivered}
                  title="Delivered edits"
                  subtitle="Recently published"
                  emptyStateText="No delivered edits yet."
                  onViewAll={() => navigate('/shoot-history?tab=delivered')}
                />
              </Suspense>,
              null,
            ]}
            upcomingShoots={editorUpcoming}
            upcomingTitle="Editing queue"
            upcomingSubtitle="Uploads & active edits"
            upcomingEmptyStateText="No edits in progress yet."
            upcomingDefaultShowPastDays
            pendingReviews={editorPendingReviews}
            onSelectShoot={handleSelectShoot}
            role="editor"
          />
          {shootDetailsModal}
        </>
      );
    }

    return null;
  }

  const mobileTabs = [
    {
      id: "shoots",
      label: "Shoots",
      content: renderShootsTabsCard(),
    },
    {
      id: "completed",
      label: "Completed",
      content: renderCompletedShootsCard(),
    },
    {
      id: "assign",
      label: "Assign",
      content: renderAssignPhotographersCard(),
    },
    {
      id: "requests",
      label: "Requests",
      content: renderPendingReviewsCard(),
    },
    {
      id: "pipeline",
      label: "Pipeline",
      content: renderPipelineSection(),
    },
  ] as const;

  const adminDesktopContent = (
    <>
      {/* Requested shoots section at top, then Upcoming Shoots below */}
      {/* KPI cards temporarily removed by request */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-start">
        <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6 md:sticky md:top-6 h-full order-1 md:order-none">
          <div className="order-1 md:order-none">
            <QuickActionsCard
              actions={withCustomQuickActions(adminQuickActions)}
              columns={1}
              onEdit={canCustomizeQuickActions ? handleOpenQuickActionsEditor : undefined}
            />
          </div>
          <div id="assign-card" className="flex-1 min-h-0 flex flex-col hidden md:flex order-3 md:order-none">
            {renderAssignPhotographersCard()}
          </div>
        </div>

        <div className="md:col-span-6 flex flex-col gap-4 sm:gap-6 h-full order-2 md:order-none">
          {/* Combined Shoots Card with Upcoming/Requested tabs */}
          {renderShootsTabsCard()}
        </div>

        <div className="lg:hidden order-3">{renderAssignPhotographersCard()}</div>

        <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6 md:sticky md:top-6 h-full order-4 md:order-none">
          {renderPendingReviewsCard()}
          {renderCompletedShootsCard()}
        </div>
      </div>

      {renderPipelineSection()}
    </>
  );

  const adminMobileContent = (
    <Tabs
      value={mobileDashboardTab}
      onValueChange={(val) => setMobileDashboardTab(val as MobileDashboardTab)}
      className="space-y-4 flex-1 flex flex-col dashboard-mobile-tabs"
    >
      <div className="sticky top-[-0.25rem] z-20 pb-2 -mx-2 px-2 sm:-mx-3 sm:px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="overflow-x-auto hidden-scrollbar">
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
        <TabsContent key={tab.id} value={tab.id} className="focus-visible:outline-none flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col min-h-0 pt-2">
            {tab.content}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );

  return (
    <DashboardLayout>
      <div className="px-2 pt-3 pb-3 sm:p-6 flex flex-col min-h-full gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <PageHeader title={greetingTitle} description={DASHBOARD_DESCRIPTION} />
          </div>
          {cancellationRequestCount > 0 && (
            <button
              onClick={() => setCancellationDialogOpen(true)}
              className="flex-shrink-0 rounded-2xl border border-rose-200/80 dark:border-rose-800/40 bg-white dark:bg-card shadow-sm px-4 py-3 flex items-center gap-3 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-center h-9 w-9 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30">
                <span className="text-base font-bold text-rose-600 dark:text-rose-400">{cancellationRequestCount}</span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground leading-tight text-left">Cancellation{cancellationRequestCount !== 1 ? 's' : ''}<br />pending</span>
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50 rounded-2xl text-sm text-rose-700 dark:text-rose-300">
            <p className="font-semibold mb-1">Error loading dashboard:</p>
            <p>{error}</p>
            <button 
              onClick={() => refresh()} 
              className="mt-2 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        {!error && data && (!data.workflow || !Array.isArray(data.workflow.columns)) && (
          <div className="p-4 border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 rounded-2xl text-sm text-amber-700 dark:text-amber-300">
            <p>Workflow data is missing. <button onClick={() => refresh()} className="underline font-semibold">Refresh</button></p>
          </div>
        )}

        {isMobile ? adminMobileContent : adminDesktopContent}
      </div>

      {shootDetailsModal}
      {quickActionsEditor}

      {/* Approval Modal for requested shoots */}
      {approvalModalShoot && (
        <ShootApprovalModal
          isOpen={!!approvalModalShoot}
          onClose={() => setApprovalModalShoot(null)}
          shootId={approvalModalShoot.id}
          shootAddress={approvalModalShoot.addressLine || ''}
          currentScheduledAt={approvalModalShoot.startTime}
          onApproved={() => {
            setApprovalModalShoot(null);
            refresh();
          }}
          photographers={Array.isArray(data?.photographers) ? data.photographers.map((p) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
          })) : []}
        />
      )}

      {/* Decline Modal for requested shoots */}
      {declineModalShoot && (
        <ShootDeclineModal
          isOpen={!!declineModalShoot}
          onClose={() => setDeclineModalShoot(null)}
          shootId={declineModalShoot.id}
          shootAddress={declineModalShoot.addressLine || ''}
          onDeclined={() => {
            setDeclineModalShoot(null);
            refresh();
          }}
        />
      )}

      {/* Edit Modal for modifying shoot requests */}
      {editModalShoot && (
        <ShootEditModal
          isOpen={!!editModalShoot}
          onClose={() => setEditModalShoot(null)}
          shootId={editModalShoot.id}
          onSaved={() => {
            setEditModalShoot(null);
            refresh();
          }}
        />
      )}

      <Suspense fallback={null}>
        <LazySpecialEditingRequestDialog
          open={specialRequestOpen}
          onOpenChange={(open) => {
            setSpecialRequestOpen(open);
            if (!open) {
              setSelectedRequestId(null);
            }
          }}
          shoots={role === "salesRep" ? repVisibleSummaries : data?.upcomingShoots || []}
          onSuccess={refreshEditingRequests}
          requests={editingRequests}
          selectedRequestId={selectedRequestId}
          onUpdate={updateEditingRequest}
          onDelete={isAdminExperience ? removeEditingRequest : undefined}
        />
      </Suspense>

      <CancellationRequestsDialog
        open={cancellationDialogOpen}
        onOpenChange={setCancellationDialogOpen}
        onActionComplete={() => {
          refresh();
          if (fetchShoots) fetchShoots().catch(() => {});
        }}
      />
    </DashboardLayout>
  );
};

interface RoleDashboardLayoutProps {
  title: React.ReactNode;
  description: string;
  quickActions: QuickActionItem[];
  quickActionsEyebrow?: string;
  leftColumnCard: React.ReactNode;
  rightColumnCards?: React.ReactNode[];
  upcomingShoots: DashboardShootSummary[];
  pendingReviews: DashboardShootSummary[];
  onSelectShoot: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
  upcomingTitle?: string;
  upcomingSubtitle?: string;
  upcomingEmptyStateText?: string;
  upcomingDefaultShowPastDays?: boolean;
  pendingCard?: React.ReactNode;
  pendingTitle?: string;
  emptyPendingText?: string;
  canCustomizeQuickActions?: boolean;
  onEditQuickActions?: () => void;
  role?: UserRole;
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
  onSelectShoot,
  upcomingTitle,
  upcomingSubtitle,
  upcomingEmptyStateText,
  upcomingDefaultShowPastDays,
  pendingCard,
  pendingTitle = "Requests",
  emptyPendingText = "No active requests.",
  canCustomizeQuickActions,
  onEditQuickActions,
  role,
}) => {
  const pendingContent =
    pendingCard ||
    (
      <PendingReviewsCard
        title={pendingTitle}
        reviews={[]}
        issues={[]}
        onSelect={onSelectShoot}
        emptyRequestsText={emptyPendingText}
      />
    );

  return (
    <DevProfiler id={`RoleDashboardLayout:${role ?? "default"}`}>
      <DashboardLayout>
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          <PageHeader title={title} description={description} />
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6 h-full order-1 md:order-none">
              <div className="order-1 md:order-none">
                <ErrorBoundary
                  fallback={
                    <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      Unable to load quick actions
                    </div>
                  }
                >
                  <QuickActionsCard
                    actions={quickActions}
                    eyebrow={quickActionsEyebrow}
                    columns={1}
                    onEdit={
                      canCustomizeQuickActions && onEditQuickActions
                        ? onEditQuickActions
                        : undefined
                    }
                  />
                </ErrorBoundary>
              </div>
              <div className="flex-1 min-h-0 flex flex-col hidden md:flex order-3 md:order-none">
                <ErrorBoundary
                  fallback={
                    <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      Unable to load card
                    </div>
                  }
                >
                  {leftColumnCard}
                </ErrorBoundary>
              </div>
            </div>
            <div className="md:col-span-6 flex flex-col h-full order-2 md:order-none">
              <ErrorBoundary
                fallback={
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Unable to load upcoming shoots
                  </div>
                }
              >
                <UpcomingShootsCard 
                  shoots={upcomingShoots} 
                  onSelect={(shoot, weather) => onSelectShoot(shoot, weather)}
                  role={role}
                  title={upcomingTitle}
                  subtitle={upcomingSubtitle}
                  emptyStateText={upcomingEmptyStateText}
                  defaultShowPastDays={upcomingDefaultShowPastDays}
                />
              </ErrorBoundary>
            </div>
            {/* Left Column Card - Mobile only, appears after Upcoming Shoots */}
            <div className="md:hidden order-3">
              <ErrorBoundary
                fallback={
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Unable to load card
                  </div>
                }
              >
                {leftColumnCard}
              </ErrorBoundary>
            </div>
          <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6 h-full order-4 md:order-none">
            <ErrorBoundary
              fallback={
                <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Unable to load pending reviews
                </div>
              }
            >
              {pendingContent}
            </ErrorBoundary>
            {rightColumnCards
              .filter((card): card is React.ReactNode => Boolean(card))
              .map((card, index) => (
                <ErrorBoundary
                  key={index}
                  fallback={
                    <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      Unable to load card
                    </div>
                  }
                >
                  {card}
                </ErrorBoundary>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </DevProfiler>
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
  onPayment: (record: ClientShootRecord) => void;
  onBookNewShoot: () => void;
}

const ClientMyShoots: React.FC<ClientMyShootsProps> = React.memo(({
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
  onPayment,
  onBookNewShoot,
}) => {
  const tabs: Array<{ key: "upcoming" | "completed" | "hold"; label: string; count: number }> = [
    { key: "upcoming", label: "Scheduled", count: upcoming.length },
    { key: "completed", label: "Delivered", count: completed.length },
    // Only show On hold tab if there are items
    ...(onHold.length > 0 ? [{ key: "hold" as const, label: "On hold", count: onHold.length }] : []),
  ];
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("upcoming");
  const list =
    activeTab === "upcoming" ? upcoming : activeTab === "completed" ? completed : onHold;

  return (
    <DevProfiler id="ClientMyShoots">
      <Card className="h-full flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">My shoots</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Track everything from booking to delivery.</p>
          </div>
          <div className="flex gap-2 sm:gap-4 text-xs sm:text-sm font-semibold overflow-visible pb-2 pt-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-1 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
                }`}
              >
                {tab.label}
                {tab.key === "completed" && tab.count > 0 ? (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-blue-500 rounded-full animate-bounce">
                    {tab.count}
                  </span>
                ) : (
                  <span>({tab.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                {activeTab === "upcoming" && "No scheduled shoots"}
                {activeTab === "completed" && "No delivered shoots yet"}
                {activeTab === "hold" && "No shoots on hold"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                {activeTab === "upcoming" && "You don't have any shoots scheduled. Book a new shoot to get started!"}
                {activeTab === "completed" && "Once your shoots are delivered, they'll appear here."}
                {activeTab === "hold" && "Shoots requiring your attention will appear here."}
              </p>
              {(activeTab === "upcoming" || activeTab === "completed") && (
                <Button onClick={onBookNewShoot} className="gap-2">
                  <CalendarPlus className="h-4 w-4" />
                  Book New Shoot
                </Button>
              )}
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
                onPayment={onPayment}
              />
            ))
          )}
        </div>
        </Card>
      </DevProfiler>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for ClientMyShoots
    return (
      prevProps.upcoming.length === nextProps.upcoming.length &&
      prevProps.completed.length === nextProps.completed.length &&
      prevProps.onHold.length === nextProps.onHold.length &&
      prevProps.onSelect === nextProps.onSelect &&
      prevProps.onReschedule === nextProps.onReschedule &&
      prevProps.onCancel === nextProps.onCancel &&
      prevProps.onContactSupport === nextProps.onContactSupport &&
      prevProps.onDownload === nextProps.onDownload &&
      prevProps.onRebook === nextProps.onRebook &&
      prevProps.onRequestRevision === nextProps.onRequestRevision &&
      prevProps.onHoldAction === nextProps.onHoldAction &&
      prevProps.onPayment === nextProps.onPayment &&
      prevProps.onBookNewShoot === nextProps.onBookNewShoot
    );
  }
);

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
  onPayment?: (record: ClientShootRecord) => void;
}

const ClientShootTile: React.FC<ClientShootTileProps> = React.memo(({
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
  onPayment,
}) => {
  const { formatTime, formatDate } = useUserPreferences();
  const { data, summary } = record;
  
  // Calculate if payment is pending
  const totalQuote = data.payment?.totalQuote ?? 0;
  const totalPaid = data.payment?.totalPaid ?? 0;
  const hasPendingPayment = totalQuote > 0 && totalPaid < totalQuote;
  const balanceDue = Math.max(totalQuote - totalPaid, 0);
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

  // Get photos for delivered shoots
  const getDeliveredPhotos = () => {
    const allPhotos: string[] = [];
    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    
    // Helper to resolve URL - prefix with API URL if relative path
    const resolveUrl = (url: string | null | undefined): string | null => {
      if (!url) return null;
      // Already absolute URL
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      // Relative path - prefix with API URL
      if (url.startsWith('/')) return `${API_URL}${url}`;
      return `${API_URL}/${url}`;
    };
    
    // Check media.images first
    if (data.media?.images) {
      data.media.images.forEach((img: any) => {
        // Try resolved URLs first, then fall back to paths
        const url = img.thumbnail_url || img.web_url || resolveUrl(img.thumbnail_path || img.web_path || img.url || img.path);
        if (url) allPhotos.push(url);
      });
    }
    // Fallback to files - only include edited/final files (not raw)
    if (allPhotos.length === 0 && data.files) {
      data.files.forEach((file: any) => {
        const stage = (file.workflow_stage || file.workflowStage || '').toLowerCase();
        // Only include edited, completed, final, or delivered files - NOT raw/todo
        if (stage === 'raw' || stage === 'todo' || stage === 'uploaded') return;
        
        // Try resolved URLs first (from backend), then fall back to paths
        const url = file.thumbnail_url || file.web_url || file.placeholder_url || 
                    resolveUrl(file.thumbnail_path || file.web_path || file.url || file.path);
        if (url) allPhotos.push(url);
      });
    }
    return allPhotos;
  };

  // Delivered variant - new layout with info on left and photos on right
  // Photo cycling state
  const [photoIndex, setPhotoIndex] = useState(0);
  const allPhotosRef = React.useRef<string[]>([]);
  
  // Auto-cycle photos every 3 seconds for delivered shoots
  useEffect(() => {
    if (variant !== "completed") return;
    const photos = allPhotosRef.current;
    if (photos.length <= 3) return; // No need to cycle if 3 or fewer photos
    
    const interval = setInterval(() => {
      setPhotoIndex((prev) => (prev + 1) % photos.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [variant]);
  
  if (variant === "completed") {
    const allPhotos = getDeliveredPhotos();
    allPhotosRef.current = allPhotos;
    const totalCount = allPhotos.length;
    
    // Get 3 photos starting from current index, cycling through
    const getDisplayPhotos = () => {
      if (allPhotos.length === 0) return [];
      if (allPhotos.length <= 3) return allPhotos;
      const photos: string[] = [];
      for (let i = 0; i < 3; i++) {
        photos.push(allPhotos[(photoIndex + i) % allPhotos.length]);
      }
      return photos;
    };
    const displayPhotos = getDisplayPhotos();

    return (
      <div className="border border-border rounded-2xl sm:rounded-3xl overflow-hidden hover:border-primary/40 transition-colors bg-card">
        <div className="flex flex-col lg:flex-row">
          {/* Left side - Info */}
          <div className="flex-1 p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{dateLabel}</span>
              <span>•</span>
              <span>{timeLabel}</span>
            </div>
            
            <button onClick={() => onSelect(record)} className="text-lg sm:text-xl font-semibold text-left hover:underline break-words block">
              {summary.addressLine}
            </button>
            
            <div className="flex flex-wrap gap-2">
              {serviceBadges.map((service) => (
                <Badge key={service} variant="secondary" className="rounded-full text-[10px] sm:text-xs bg-muted/50">
                  {service}
                </Badge>
              ))}
              {overflow > 0 && (
                <Badge variant="secondary" className="rounded-full text-[10px] sm:text-xs bg-muted/50">
                  +{overflow}
                </Badge>
              )}
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p className="flex items-center gap-2">
                <span className="uppercase text-[10px] tracking-wider">Photographer</span>
                {data.photographer?.avatar && (
                  <img src={data.photographer.avatar} alt="" className="w-5 h-5 rounded-full" />
                )}
                <span className="text-foreground font-medium">{photographerLabel}</span>
              </p>
              {instructions && (
                <p>
                  <span className="uppercase text-[10px] tracking-wider">Notes</span>
                  <span className="block text-foreground/80 italic line-clamp-2">"{instructions}"</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Badge className="bg-green-600/20 text-green-500 border-green-600/30 hover:bg-green-600/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
                DELIVERED
              </Badge>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              {hasPendingPayment && onPayment && (
                <Button 
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onPayment(record)}
                >
                  <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                  Pay ${balanceDue.toFixed(0)}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onDownload(record)}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download
              </Button>
              <Button size="sm" variant="outline" onClick={() => onRequestRevision(record)}>
                <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                Revision
              </Button>
              <Button size="sm" variant="outline" onClick={() => onRebook(record)}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Rebook
              </Button>
            </div>
          </div>

          {/* Right side - Photo stack */}
          {displayPhotos.length > 0 && (
            <div className="relative w-full lg:w-[280px] h-[200px] lg:h-auto lg:min-h-[260px] bg-gradient-to-br from-muted/20 to-transparent overflow-hidden">
              {/* Background blur photos */}
              {displayPhotos[0] && (
                <div 
                  className="absolute inset-0 opacity-20 blur-2xl scale-125"
                  style={{ 
                    backgroundImage: `url(${displayPhotos[0]})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
              )}
              
              {/* Stacked photos */}
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="relative w-full h-full max-w-[320px] max-h-[240px]">
                  {/* Back photo (left) - lower, floating down animation */}
                  <div 
                    className="absolute left-0 w-[45%] aspect-[4/3] rounded-lg overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)] -rotate-12 opacity-85 animate-float-down"
                    style={{ zIndex: 1, top: '75%' }}
                  >
                    {displayPhotos[2] && (
                      <img 
                        src={displayPhotos[2]} 
                        alt="Preview 3"
                        className="w-full h-full object-cover transition-all duration-1000 ease-in-out"
                        style={{ opacity: 1 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                  
                  {/* Back photo (right) - higher, floating up animation */}
                  <div 
                    className="absolute right-0 w-[45%] aspect-[4/3] rounded-lg overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)] rotate-12 opacity-85 animate-float-up"
                    style={{ zIndex: 2, top: '25%' }}
                  >
                    {displayPhotos[1] && (
                      <img 
                        src={displayPhotos[1]} 
                        alt="Preview 2"
                        className="w-full h-full object-cover transition-all duration-1000 ease-in-out"
                        style={{ opacity: 1 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                  
                  {/* Front photo (center) - larger */}
                  <div 
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] aspect-[4/3] rounded-lg overflow-hidden shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
                    style={{ zIndex: 3 }}
                  >
                    {displayPhotos[0] && (
                      <img 
                        src={displayPhotos[0]} 
                        alt="Preview 1"
                        className="w-full h-full object-cover transition-all duration-1000 ease-in-out"
                        style={{ opacity: 1 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>
              </div>
              
              {/* Photo count badge */}
              {totalCount > 0 && (
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
                  {totalCount} photo{totalCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default layout for upcoming and hold variants
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
        <div className="text-right flex-shrink-0">
          <Badge variant="outline" className="uppercase tracking-widest text-[9px] sm:text-[10px]">
            {statusLabel}
          </Badge>
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

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {variant === "upcoming" && (
            <>
              <Button size="sm" className="text-xs sm:text-sm" onClick={() => onReschedule(record)}>
                Reschedule
              </Button>
              <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={onContactSupport}>
                Contact support
              </Button>
              {/* Only show cancel button for requested shoots (not yet approved) */}
              {(summary.workflowStatus || summary.status || '').toLowerCase() === 'requested' && (
                <Button 
                  size="sm" 
                  variant={record.data.cancellationRequestedAt ? "outline" : "destructive"}
                  className={`text-xs sm:text-sm ${record.data.cancellationRequestedAt ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !record.data.cancellationRequestedAt && onCancel(record)}
                  disabled={!!record.data.cancellationRequestedAt}
                >
                  {record.data.cancellationRequestedAt ? 'Requested cancellation' : 'Cancel shoot'}
                </Button>
              )}
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
        {hasPendingPayment && onPayment && (
          <Button 
            size="sm" 
            variant="default"
            className="text-xs sm:text-sm bg-green-600 hover:bg-green-700"
            onClick={() => onPayment(record)}
          >
            <CreditCard className="w-3 h-3 mr-1" />
            Pay ${balanceDue.toFixed(0)}
          </Button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for ClientShootTile
  return (
    prevProps.record.data.id === nextProps.record.data.id &&
    prevProps.variant === nextProps.variant &&
    prevProps.onSelect === nextProps.onSelect &&
    prevProps.onReschedule === nextProps.onReschedule &&
    prevProps.onCancel === nextProps.onCancel &&
    prevProps.onContactSupport === nextProps.onContactSupport &&
    prevProps.onDownload === nextProps.onDownload &&
    prevProps.onRebook === nextProps.onRebook &&
    prevProps.onRequestRevision === nextProps.onRequestRevision &&
    prevProps.onHoldAction === nextProps.onHoldAction &&
    prevProps.onPayment === nextProps.onPayment
  );
});

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

const DashboardWithProfiler = () => (
  <DevProfiler id="Dashboard">
    <Dashboard />
  </DevProfiler>
);

const DashboardWithBoundary = withErrorBoundary(DashboardWithProfiler);

export default React.memo(DashboardWithBoundary);
