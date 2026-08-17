import { useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/utils/authToken';

export type ResendVerificationResult = {
  ok: boolean;
  message: string;
  email?: string;
  user?: Record<string, unknown>;
};

type AccountLike = {
  id: string | number;
  email?: string | null;
};

export function useResendVerificationEmail() {
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendingUserId, setResendingUserId] = useState<string | number | null>(null);
  const [resendFeedback, setResendFeedback] = useState<ResendVerificationResult | null>(null);

  const runResend = async (
    path: string,
    emailHint?: string | null,
    applyCurrentUser = false,
  ): Promise<ResendVerificationResult> => {
    const token = getAuthToken();
    if (!token) {
      const result = { ok: false, message: 'Please sign in again to resend verification.' };
      setResendFeedback(result);
      toast({
        title: 'Sign in required',
        description: result.message,
        variant: 'destructive',
      });
      return result;
    }

    setIsResendingVerification(true);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => ({})) as {
        sent?: boolean;
        email?: string;
        message?: string;
        user?: { id?: string | number; email?: string } & Record<string, unknown>;
      };
      const email = String(payload.email || payload.user?.email || emailHint || '');
      const ok = response.ok && payload.sent !== false;
      const message = String(
        payload.message
        || (ok
          ? `A new verification email was sent${email ? ` to ${email}` : ''}.`
          : 'Unable to send a verification email right now.'),
      );
      const result: ResendVerificationResult = {
        ok,
        message,
        email: email || undefined,
        user: payload.user,
      };
      setResendFeedback(result);

      if (!ok) {
        toast({
          title: 'Unable to send verification',
          description: message,
          variant: 'destructive',
        });
        return result;
      }

      if (applyCurrentUser && payload.user) {
        setUser(payload.user as never);
      }

      toast({
        title: 'Verification email sent',
        description: email ? `A new verification email was sent to ${email}.` : message,
      });
      return result;
    } catch {
      const result = { ok: false, message: 'Please try again.' };
      setResendFeedback(result);
      toast({
        title: 'Unable to send verification',
        description: result.message,
        variant: 'destructive',
      });
      return result;
    } finally {
      setIsResendingVerification(false);
      setResendingUserId(null);
    }
  };

  const resendVerification = async () => (
    runResend('/api/profile/email-verification/resend', undefined, true)
  );

  const resendForAccount = async (user: AccountLike) => {
    setResendingUserId(user.id);
    return runResend(`/api/admin/users/${user.id}/resend-verification`, user.email);
  };

  return {
    isResendingVerification,
    resendingUserId,
    resendFeedback,
    resendVerification,
    resendForAccount,
  };
}
