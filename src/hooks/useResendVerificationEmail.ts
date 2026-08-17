import { useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';

export function useResendVerificationEmail() {
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const resendVerification = async () => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in again to resend verification.',
        variant: 'destructive',
      });
      return;
    }

    setIsResendingVerification(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/email-verification/resend`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to send a verification email right now.');
      }
      if (payload?.user) {
        setUser(payload.user);
      }
      toast({
        title: 'Verification email sent',
        description: payload?.message || 'Check your inbox to verify your address.',
      });
    } catch (error) {
      toast({
        title: 'Unable to send verification',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsResendingVerification(false);
    }
  };

  return { isResendingVerification, resendVerification };
}
