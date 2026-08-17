import { useCallback, useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";

import { API_BASE_URL } from "@/config/env";
import type { useToast } from "@/hooks/use-toast";
import { useResendVerificationEmail } from "@/hooks/useResendVerificationEmail";
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
  userId,
}: UseClientDashboardActionsParams) => {
  const { resendVerification, isResendingVerification, resendFeedback } = useResendVerificationEmail();

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
    await resendVerification();
  }, [resendVerification]);

  return {
    clientEmailActionPending: isResendingVerification,
    clientEmailResendFeedback: resendFeedback,
    handleManageClientEmail,
    handleResendClientVerification,
  };
};
