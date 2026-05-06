import { useCallback, useEffect, useState } from "react";
import type { Location, NavigateFunction } from "react-router-dom";

import { API_BASE_URL } from "@/config/env";
import type { useToast } from "@/hooks/use-toast";
import type {
  DashboardClientRequest,
  DashboardShootModalNavigationState,
} from "@/types/dashboard";
import type { EditingRequest } from "@/services/editingRequestService";

import type { CommandBarState, OpenShootInModalOptions } from "../types";

type ToastFn = ReturnType<typeof useToast>["toast"];
type OpenShootInModalById = (
  shootId: string | number,
  options?: OpenShootInModalOptions,
) => Promise<"opened" | "missing" | "unhandled">;
type OpenRequestManager = (
  requests: DashboardClientRequest[],
  selectedRequestId?: string | null,
) => void;
type RegisterShootOpenHandler = (
  handler: ((request: DashboardClientRequest) => Promise<"opened" | "missing" | "unhandled">) | null,
) => void;

interface UseDashboardRequestsParams {
  canViewDashboardClientRequests: boolean;
  location: Location;
  navigate: NavigateFunction;
  openModal: OpenRequestManager;
  openShootInModalById: OpenShootInModalById;
  registerShootOpenHandler: RegisterShootOpenHandler;
  removeRequest: (requestId: string) => void;
  toast: ToastFn;
}

export const useDashboardRequests = ({
  canViewDashboardClientRequests,
  location,
  navigate,
  openModal,
  openShootInModalById,
  registerShootOpenHandler,
  removeRequest,
  toast,
}: UseDashboardRequestsParams) => {
  const dashboardNavigationState = location.state as DashboardShootModalNavigationState | null;
  const [specialRequestOpen, setSpecialRequestOpen] = useState(false);
  const [specialRequestInitialTab, setSpecialRequestInitialTab] =
    useState<"new" | "ongoing">("new");
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [clientRequests, setClientRequests] = useState<DashboardClientRequest[]>([]);
  const [clientRequestsLoading, setClientRequestsLoading] = useState(false);

  const fetchClientRequests = useCallback(async () => {
    if (!canViewDashboardClientRequests) return;

    setClientRequestsLoading(true);
    try {
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/client-requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
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
      console.error("Error fetching client requests:", error);
      setClientRequests([]);
    } finally {
      setClientRequestsLoading(false);
    }
  }, [canViewDashboardClientRequests]);

  useEffect(() => {
    void fetchClientRequests();
  }, [fetchClientRequests]);

  useEffect(() => {
    if (!canViewDashboardClientRequests || typeof window === "undefined") return;

    const handleShootRequestSync = () => {
      void fetchClientRequests();
    };

    window.addEventListener("shoot-request-created", handleShootRequestSync);
    window.addEventListener("shoot-request-updated", handleShootRequestSync);
    return () => {
      window.removeEventListener("shoot-request-created", handleShootRequestSync);
      window.removeEventListener("shoot-request-updated", handleShootRequestSync);
    };
  }, [canViewDashboardClientRequests, fetchClientRequests]);

  const removeDeletedClientRequest = useCallback(
    (requestId: string | number) => {
      const normalizedRequestId = String(requestId);
      removeRequest(normalizedRequestId);
      setClientRequests((prev) =>
        prev.filter((request) => String(request.id) !== normalizedRequestId),
      );
    },
    [removeRequest],
  );

  const openShootRequestsFromRequestManager = useCallback(
    async (request: DashboardClientRequest) => {
      const requestId = String(request.id);
      const requestShootId = request.shootId ?? request.shoot?.id;

      if (!requestShootId) {
        removeDeletedClientRequest(requestId);
        return "missing" as const;
      }

      return openShootInModalById(requestShootId, {
        initialTab: "issues",
        missingToast: null,
        authToast: null,
        onMissing: () => removeDeletedClientRequest(requestId),
      });
    },
    [openShootInModalById, removeDeletedClientRequest],
  );

  const openShootOverviewFromEditingRequest = useCallback(
    async (request: EditingRequest) => {
      const requestShootId = request.shoot_id ?? request.shoot?.id;
      if (!requestShootId) {
        toast({
          title: "Shoot unavailable",
          description: "This request is not linked to a shoot.",
          variant: "destructive",
        });
        return;
      }

      await openShootInModalById(requestShootId, {
        initialTab: "overview",
        missingToast: {
          title: "Shoot unavailable",
          description: "This shoot no longer exists.",
        },
      });
    },
    [openShootInModalById, toast],
  );

  useEffect(() => {
    if (location.pathname !== "/dashboard" || !dashboardNavigationState?.openShootId) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        await openShootInModalById(dashboardNavigationState.openShootId, {
          initialTab: dashboardNavigationState.openShootTab ?? "overview",
          missingToast: {
            title: "Shoot unavailable",
            description: "This shoot no longer exists.",
          },
        });
      } finally {
        if (!isCancelled) {
          const remainingState =
            location.state && typeof location.state === "object"
              ? { ...(location.state as Record<string, unknown>) }
              : {};
          delete remainingState.openShootId;
          delete remainingState.openShootTab;

          navigate(
            {
              pathname: location.pathname,
              search: location.search,
            },
            {
              replace: true,
              state: Object.keys(remainingState).length > 0 ? remainingState : null,
            },
          );
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    dashboardNavigationState,
    location.pathname,
    location.search,
    navigate,
    openShootInModalById,
  ]);

  useEffect(() => {
    registerShootOpenHandler(openShootRequestsFromRequestManager);
    return () => registerShootOpenHandler(null);
  }, [openShootRequestsFromRequestManager, registerShootOpenHandler]);

  useEffect(() => {
    const state = location.state as CommandBarState | null;
    if (!state) return;

    let handled = false;

    if (state.openRequestManager && canViewDashboardClientRequests && !clientRequestsLoading) {
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
    canViewDashboardClientRequests,
    location.state,
    navigate,
    openModal,
  ]);

  const openEditingRequestCenter = useCallback(() => {
    setSelectedRequestId(null);
    setSpecialRequestInitialTab("ongoing");
    setSpecialRequestOpen(true);
  }, []);

  const openEditingRequestById = useCallback((requestId: number) => {
    setSelectedRequestId(requestId);
    setSpecialRequestInitialTab("ongoing");
    setSpecialRequestOpen(true);
  }, []);

  return {
    clientRequests,
    clientRequestsLoading,
    specialRequestOpen,
    setSpecialRequestOpen,
    specialRequestInitialTab,
    setSpecialRequestInitialTab,
    selectedRequestId,
    setSelectedRequestId,
    openEditingRequestCenter,
    openEditingRequestById,
    openShootOverviewFromEditingRequest,
  };
};
