import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/context/PermissionsContext';
import { getMessagingBadgeCounts } from '@/services/messaging';
import type { MessagingBadgeCounts } from '@/types/messaging';

const EMPTY: MessagingBadgeCounts = { email: 0, sms: 0, call: 0, total: 0 };

/** Display ceiling matching the notification bell (99+). */
export const formatNavBadgeCount = (count: number): string | null => {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? '99+' : String(Math.floor(count));
};

/**
 * Polls lightweight messaging channel unread/attention counts for sidebar badges.
 */
export const useMessagingBadgeCounts = () => {
  const { user } = useAuth();
  const { can, isLoading: permissionsLoading } = usePermissions();

  const canEmail = can('messaging-email', 'view') || can('messaging-overview', 'view');
  const canSms = can('messaging-sms', 'view');
  const canCalls = can('voice-calls', 'view');
  const enabled = Boolean(user?.id) && !permissionsLoading && (canEmail || canSms || canCalls);

  const query = useQuery({
    queryKey: ['messaging-badge-counts', user?.id, canEmail, canSms, canCalls],
    queryFn: getMessagingBadgeCounts,
    enabled,
    staleTime: 15_000,
    refetchInterval: (q) => {
      if (typeof document !== 'undefined' && document.hidden) return false;
      return 60_000;
    },
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const counts = query.data ?? EMPTY;

  return {
    counts,
    email: canEmail ? counts.email : 0,
    sms: canSms ? counts.sms : 0,
    call: canCalls ? counts.call : 0,
    total:
      (canEmail ? counts.email : 0) +
      (canSms ? counts.sms : 0) +
      (canCalls ? counts.call : 0),
    loading: query.isLoading,
    refresh: query.refetch,
  };
};
