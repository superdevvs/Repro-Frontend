import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL } from "@/config/env";
import type { useToast } from "@/hooks/use-toast";
import type { DashboardCancellationItem } from "@/types/dashboard";

type ToastFn = ReturnType<typeof useToast>["toast"];

interface CancellationResponseItem {
  id: number | string;
  location?: { fullAddress?: string; address?: string };
  address?: string;
  address_line?: string;
  client?: { name?: string };
  client_name?: string;
  cancellationReason?: string;
  cancellation_reason?: string;
}

interface UseCancellationRequestsParams {
  canReviewCancellationRequests: boolean;
  viewerScope: string;
  fetchShoots?: () => Promise<unknown>;
  pendingCancellations?: DashboardCancellationItem[];
  refresh: () => void | Promise<void>;
  toast: ToastFn;
}

export const useCancellationRequests = ({
  canReviewCancellationRequests,
  viewerScope,
  fetchShoots,
  pendingCancellations,
  refresh,
  toast,
}: UseCancellationRequestsParams) => {
  const requestController = useRef<AbortController | null>(null);
  const [loadedScope, setLoadedScope] = useState(viewerScope);
  const [liveCancellationShoots, setLiveCancellationShoots] = useState<DashboardCancellationItem[]>([]);
  const [liveCancellationLoading, setLiveCancellationLoading] = useState(false);
  const [liveCancellationLoaded, setLiveCancellationLoaded] = useState(false);

  const fetchPendingCancellationShoots = useCallback(async () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoadedScope(viewerScope);
    setLiveCancellationShoots([]);
    if (!canReviewCancellationRequests) {
      setLiveCancellationShoots([]);
      setLiveCancellationLoading(false);
      return;
    }

    setLiveCancellationLoading(true);
    try {
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/shoots/pending-cancellations`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (controller.signal.aborted) return;
      if (!res.ok) {
        setLiveCancellationShoots([]);
        return;
      }

      const json = await res.json();
      if (controller.signal.aborted) return;
      const items = Array.isArray(json.data) ? json.data : [];
      setLiveCancellationShoots(
        items.map((item: CancellationResponseItem) => ({
          id: Number(item.id),
          address:
            item.location?.fullAddress ||
            item.location?.address ||
            item.address ||
            item.address_line ||
            `Shoot #${item.id}`,
          clientName: item.client?.name || item.client_name || undefined,
          cancellationReason:
            item.cancellationReason || item.cancellation_reason || undefined,
        })),
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("Error fetching pending cancellations:", error);
      setLiveCancellationShoots([]);
    } finally {
      if (!controller.signal.aborted) {
        setLiveCancellationLoaded(true);
        setLiveCancellationLoading(false);
      }
    }
  }, [canReviewCancellationRequests, viewerScope]);

  useEffect(() => {
    void fetchPendingCancellationShoots();
    return () => requestController.current?.abort();
  }, [fetchPendingCancellationShoots]);

  // Cancellation shoots come from the dashboard overview response (already fetched)
  const cancellationShoots: DashboardCancellationItem[] = useMemo(() => {
    if (!canReviewCancellationRequests || loadedScope !== viewerScope) return [];
    if (liveCancellationLoaded || liveCancellationLoading) {
      return liveCancellationShoots;
    }
    return pendingCancellations ?? [];
  }, [
    canReviewCancellationRequests,
    loadedScope,
    viewerScope,
    liveCancellationLoaded,
    liveCancellationLoading,
    liveCancellationShoots,
    pendingCancellations,
  ]);

  const cancellationRequestCount = cancellationShoots.length;

  const handleApproveCancellation = async (shootId: number, decision: "charge_fee" | "waive_fee" = "charge_fee") => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/approve-cancellation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        decision,
        ...(decision === "charge_fee" ? { cancellation_fee: 60 } : {}),
      }),
    });
    if (res.ok) {
      toast({
        title: "Cancellation approved",
        description: decision === "charge_fee"
          ? "Shoot has been cancelled and a $60 cancellation fee was applied."
          : "Shoot has been cancelled with no cancellation fee.",
      });
      refresh();
      void fetchPendingCancellationShoots();
      if (fetchShoots) fetchShoots().catch(() => {});
    } else {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Error",
        description: err.message || "Failed to approve",
        variant: "destructive",
      });
    }
  };

  const handleRejectCancellation = async (shootId: number) => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/reject-cancellation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    if (res.ok) {
      toast({ title: "Cancellation rejected", description: "Request has been dismissed." });
      refresh();
      void fetchPendingCancellationShoots();
      if (fetchShoots) fetchShoots().catch(() => {});
    } else {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Error",
        description: err.message || "Failed to reject",
        variant: "destructive",
      });
    }
  };

  return {
    cancellationShoots,
    cancellationRequestCount,
    fetchPendingCancellationShoots,
    handleApproveCancellation,
    handleRejectCancellation,
  };
};
