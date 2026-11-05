import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';
import { getApiHeaders } from '@/services/api';
import type { UserData } from '@/types/auth';
import { canImpersonateAccount } from '@/utils/impersonation';

export function useAccountImpersonation() {
  const { user, role, impersonate, isImpersonating } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const identity = `${user?.id}:${role}:${isImpersonating}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;

  return async (target: UserData) => {
    if (pending.current || !canImpersonateAccount(role, target)) return;
    pending.current = true;

    try {
      let authorizedTarget = target;
      if (role === 'salesRep') {
        // Check the current server assignment before changing local identity.
        const response = await fetch(`${API_BASE_URL}/api/user`, {
          headers: { ...getApiHeaders(), 'X-Impersonate-User-Id': String(target.id) },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || 'Unable to open this client account.');
        }
        if (String(payload.id) !== String(target.id) || payload.role !== 'client') {
          throw new Error('Unable to open this client account. Refresh Accounts and try again.');
        }
        authorizedTarget = { ...target, ...payload, id: String(payload.id) };
      }

      // A late authorization response must not replace a changed sign-in.
      if (!mounted.current || identityRef.current !== identity) return;
      impersonate(authorizedTarget);
      toast({ title: 'Impersonating user', description: `You are now viewing the dashboard as ${authorizedTarget.name}.` });
      navigate('/dashboard');
    } catch (error) {
      if (mounted.current && identityRef.current === identity) {
        toast({
          title: 'Unable to impersonate',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      pending.current = false;
    }
  };
}
