import { useCallback, useEffect, useState } from "react";
import API_ROUTES from "@/lib/api";
import type { AvailabilityToastFn, GoogleCalendarAvailabilityStatus, Photographer } from "@/types/availability";

interface UseGoogleCalendarSyncOptions {
  canLaunchGoogleCalendarOAuth: boolean;
  isPhotographer: boolean;
  selectedPhotographer: string;
  photographers: Photographer[];
  isSyncModalOpen: boolean;
  authHeaders: () => Record<string, string>;
  toast: AvailabilityToastFn;
}

export function useGoogleCalendarSync({
  canLaunchGoogleCalendarOAuth,
  isPhotographer,
  selectedPhotographer,
  photographers,
  isSyncModalOpen,
  authHeaders,
  toast,
}: UseGoogleCalendarSyncOptions) {
  const [isGoogleCalendarConnecting, setIsGoogleCalendarConnecting] = useState(false);
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<GoogleCalendarAvailabilityStatus>({
    available: true,
    connected: false,
    sync_enabled: false,
  });
  const [isGoogleCalendarStatusLoading, setIsGoogleCalendarStatusLoading] = useState(false);

  const fetchGoogleCalendarAuthorizationUrl = useCallback(async () => {
    if (!canLaunchGoogleCalendarOAuth) {
      toast({
        title: "Google Calendar unavailable",
        description: "Your account cannot start Google Calendar sync from this page.",
        variant: "destructive",
      });
      return;
    }

    const selectedPhotographerRecord = photographers.find((p) => p.id === selectedPhotographer);
    const isAdminManagedConnect = !isPhotographer;

    if (isAdminManagedConnect && (!selectedPhotographer || selectedPhotographer === "all" || !selectedPhotographerRecord)) {
      toast({
        title: "Select a photographer",
        description: "Choose a specific photographer before connecting Google Calendar from Availability.",
        variant: "destructive",
      });
      return;
    }

    setIsGoogleCalendarConnecting(true);

    try {
      const response = await fetch(API_ROUTES.googleCalendar.connect, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          source: "availability",
          ...(isAdminManagedConnect && selectedPhotographerRecord
            ? { user_id: Number(selectedPhotographerRecord.id) }
            : {}),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const validationMessage = payload?.errors
          ? Object.values(payload.errors).flat().find(Boolean)
          : null;

        throw new Error(
          validationMessage ||
            payload?.message ||
            "Unable to start Google Calendar connection."
        );
      }

      const authorizationUrl = payload?.data?.authorization_url;

      if (!authorizationUrl) {
        throw new Error("Google Calendar authorization URL was not returned.");
      }

      window.location.assign(authorizationUrl);
    } catch (error) {
      toast({
        title: "Google Calendar connection failed",
        description: error instanceof Error ? error.message : "Unable to start Google Calendar connection.",
        variant: "destructive",
      });
      setIsGoogleCalendarConnecting(false);
    }
  }, [authHeaders, canLaunchGoogleCalendarOAuth, isPhotographer, photographers, selectedPhotographer, toast]);

  const fetchGoogleCalendarStatus = useCallback(async () => {
    if (!canLaunchGoogleCalendarOAuth) {
      setGoogleCalendarStatus({
        available: false,
        connected: false,
        sync_enabled: false,
        last_error: "Your account cannot view Google Calendar status.",
      });
      return;
    }

    const isAdminManagedStatus = !isPhotographer;

    if (isAdminManagedStatus && (!selectedPhotographer || selectedPhotographer === "all")) {
      setGoogleCalendarStatus({
        available: true,
        connected: false,
        sync_enabled: false,
        last_error: null,
      });
      return;
    }

    setIsGoogleCalendarStatusLoading(true);

    try {
      const params = new URLSearchParams();
      if (isAdminManagedStatus && selectedPhotographer !== "all") {
        params.set("user_id", selectedPhotographer);
      }

      const response = await fetch(
        `${API_ROUTES.googleCalendar.status}${params.toString() ? `?${params.toString()}` : ""}`,
        {
          headers: authHeaders(),
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const validationMessage = payload?.errors
          ? Object.values(payload.errors).flat().find(Boolean)
          : null;

        throw new Error(
          validationMessage ||
            payload?.message ||
            "Unable to load Google Calendar status."
        );
      }

      setGoogleCalendarStatus(payload.data);
    } catch (error) {
      setGoogleCalendarStatus({
        available: false,
        connected: false,
        sync_enabled: false,
        last_error: error instanceof Error ? error.message : "Unable to load Google Calendar status.",
      });
    } finally {
      setIsGoogleCalendarStatusLoading(false);
    }
  }, [authHeaders, canLaunchGoogleCalendarOAuth, isPhotographer, selectedPhotographer]);

  // URL param handler for OAuth callback
  useEffect(() => {
    const url = new URL(window.location.href);
    const googleCalendarState = url.searchParams.get("google_calendar");
    const message = url.searchParams.get("message");

    if (!googleCalendarState) {
      return;
    }

    if (googleCalendarState === "connected") {
      toast({
        title: "Google Calendar connected",
        description: message || "Shoot sync is now connected to Google Calendar.",
      });
    } else if (googleCalendarState === "error") {
      toast({
        title: "Google Calendar connection failed",
        description: message || "We could not connect Google Calendar.",
        variant: "destructive",
      });
    }

    url.searchParams.delete("google_calendar");
    url.searchParams.delete("message");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setIsGoogleCalendarConnecting(false);
    fetchGoogleCalendarStatus();
  }, [fetchGoogleCalendarStatus, toast]);

  // Refresh status when sync modal opens
  useEffect(() => {
    if (!isSyncModalOpen) return;
    fetchGoogleCalendarStatus();
  }, [fetchGoogleCalendarStatus, isSyncModalOpen]);

  return {
    googleCalendarStatus,
    isGoogleCalendarConnecting,
    isGoogleCalendarStatusLoading,
    fetchGoogleCalendarAuthorizationUrl,
    fetchGoogleCalendarStatus,
  };
}
