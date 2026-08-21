import { useCallback } from "react";
import type { NavigateFunction } from "react-router-dom";

import { useResendVerificationEmail } from "@/hooks/useResendVerificationEmail";

interface UseClientDashboardActionsParams {
  navigate: NavigateFunction;
}

export const useClientDashboardActions = ({
  navigate,
}: UseClientDashboardActionsParams) => {
  const { resendVerification, isResendingVerification, resendFeedback } = useResendVerificationEmail();

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
