import { useCallback, useState } from "react";

import { API_BASE_URL } from "@/config/env";
import type { useToast } from "@/hooks/use-toast";
import type { DashboardShootModalTab, DashboardShootSummary } from "@/types/dashboard";
import type { ShootData } from "@/types/shoots";
import type { WeatherInfo } from "@/services/weatherService";
import { getAuthToken } from "@/utils/authToken";
import { shootDataToSummary } from "@/utils/dashboardDerivedUtils";

import type { OpenShootInModalOptions } from "../types";

type ToastFn = ReturnType<typeof useToast>["toast"];

interface UseDashboardShootModalParams {
  accessToken?: string | null;
  fetchShoots?: () => Promise<unknown>;
  shoots: ShootData[];
  summaryMap: Map<string, DashboardShootSummary>;
  toast: ToastFn;
}

export const useDashboardShootModal = ({
  accessToken,
  fetchShoots,
  shoots,
  summaryMap,
  toast,
}: UseDashboardShootModalParams) => {
  const [selectedShoot, setSelectedShoot] = useState<DashboardShootSummary | null>(null);
  const [selectedShootWeather, setSelectedShootWeather] = useState<WeatherInfo | null>(null);
  const [shootModalInitialTab, setShootModalInitialTab] =
    useState<DashboardShootModalTab>("overview");
  const [openDownloadOnSelect, setOpenDownloadOnSelect] = useState(false);

  const handleSelectShoot = useCallback(
    (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => {
      setShootModalInitialTab("overview");
      setSelectedShoot(shoot);
      setSelectedShootWeather(weather || null);
    },
    [],
  );

  const handleCloseShootModal = useCallback(() => {
    setSelectedShoot(null);
    setSelectedShootWeather(null);
    setOpenDownloadOnSelect(false);
    setShootModalInitialTab("overview");
  }, []);

  // The context update happens synchronously in the modal, so dashboard cards update immediately.
  const handleShootUpdate = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log("💾 Shoot updated - context refreshed, dashboard will update automatically via React re-render");
    }

    if (fetchShoots) {
      fetchShoots().catch((error) => {
        if (import.meta.env.DEV) {
          console.log("💾 Background fetchShoots failed (non-critical):", error);
        }
      });
    }
  }, [fetchShoots]);

  const openShootInModalById = useCallback(
    async (
      shootId: string | number,
      {
        initialTab = "overview",
        missingToast = {
          title: "Shoot unavailable",
          description: "We could not load this shoot right now.",
        },
        authToast = {
          title: "Unable to open shoot",
          description: "Missing auth session. Please refresh and try again.",
        },
        onMissing,
      }: OpenShootInModalOptions = {},
    ) => {
      const normalizedShootId = String(shootId);

      const openSummary = (summary: DashboardShootSummary) => {
        setShootModalInitialTab(initialTab);
        setSelectedShoot(summary);
        setSelectedShootWeather(null);
        return "opened" as const;
      };

      const existingSummary = summaryMap.get(normalizedShootId);
      if (existingSummary) {
        return openSummary(existingSummary);
      }

      const sourceShoot = shoots.find((shoot) => String(shoot.id) === normalizedShootId);
      if (sourceShoot) {
        return openSummary(shootDataToSummary(sourceShoot));
      }

      const token = getAuthToken(accessToken);
      if (!token) {
        if (authToast) {
          toast({
            title: authToast.title,
            description: authToast.description,
            variant: "destructive",
          });
        }
        return "unhandled" as const;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/shoots/${normalizedShootId}`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 404) {
          onMissing?.();
          if (missingToast) {
            toast({
              title: missingToast.title,
              description: missingToast.description,
              variant: "destructive",
            });
          }
          return "missing" as const;
        }

        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json?.message || "Failed to load shoot details");
        }

        const shootData = json?.data as ShootData | undefined;
        if (!shootData) {
          onMissing?.();
          if (missingToast) {
            toast({
              title: missingToast.title,
              description: missingToast.description,
              variant: "destructive",
            });
          }
          return "missing" as const;
        }

        return openSummary(shootDataToSummary(shootData));
      } catch (openShootError) {
        toast({
          title: "Unable to open shoot",
          description:
            openShootError instanceof Error
              ? openShootError.message
              : "We could not load this shoot right now.",
          variant: "destructive",
        });
        return "unhandled" as const;
      }
    },
    [accessToken, shoots, summaryMap, toast],
  );

  return {
    selectedShoot,
    selectedShootWeather,
    shootModalInitialTab,
    openDownloadOnSelect,
    setSelectedShoot,
    setOpenDownloadOnSelect,
    handleSelectShoot,
    handleCloseShootModal,
    handleShootUpdate,
    openShootInModalById,
  };
};
