import { useCallback, useEffect, useState } from "react";
import type { NavigateFunction } from "react-router-dom";

import { API_BASE_URL } from "@/config/env";
import type { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/utils/authToken";

type ToastFn = ReturnType<typeof useToast>["toast"];

interface UseClientDashboardActionsParams {
  accessToken?: string | null;
  navigate: NavigateFunction;
  role: string;
  setUser: (user: any) => void;
  toast: ToastFn;
  userId?: string | number | null;
}

export const useClientDashboardActions = ({
  accessToken,
  navigate,
  role,
  setUser,
  toast,
  userId,
}: UseClientDashboardActionsParams) => {
  const [clientEmailActionPending, setClientEmailActionPending] = useState(false);

  useEffect(() => {
    if (role !== "client" || !userId) {
      return;
    }

    const token = getAuthToken(accessToken);
    if (!token) {
      return;
    }

    let cancelled = false;

    const refreshCurrentUser = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/user`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok || cancelled) {
          return;
        }

        const nextUser = await response.json();
        if (!cancelled) {
          setUser(nextUser as any);
        }
      } catch {
        // Keep the dashboard responsive even if the profile refresh fails.
      }
    };

    refreshCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [accessToken, role, setUser, userId]);

  const handleManageClientEmail = useCallback(() => {
    navigate("/settings?tab=profile");
  }, [navigate]);

  const handleResendClientVerification = useCallback(async () => {
    const token = getAuthToken(accessToken);
    if (!token) {
      toast({
        title: "Sign in required",
        description: "Please sign in again to resend verification.",
        variant: "destructive",
      });
      return;
    }

    setClientEmailActionPending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/email-verification/resend`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to send a verification email right now.");
      }

      if (payload?.user) {
        setUser(payload.user as any);
      }

      toast({
        title: "Verification email sent",
        description: payload?.message || "Check your inbox to verify your email address.",
      });
    } catch (error) {
      toast({
        title: "Unable to send verification",
        description:
          error instanceof Error ? error.message : "Unable to send a verification email right now.",
        variant: "destructive",
      });
    } finally {
      setClientEmailActionPending(false);
    }
  }, [accessToken, setUser, toast]);

  return {
    clientEmailActionPending,
    handleManageClientEmail,
    handleResendClientVerification,
  };
};
