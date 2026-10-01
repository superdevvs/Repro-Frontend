import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { getLegacySupportTicket } from '@/services/supportTickets';
import { canUseEmailWorkspace } from '@/utils/messagingRoles';
import { getSupportComposePrefill, supportInboxRedirect } from './messagingSupport';

/** Keep email queries and compose effects unmounted for support-only accounts. */
export function StaffEmailRoute({ children, compose = false }: { children: ReactNode; compose?: boolean }) {
  const { role, user, isLoading } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const composeState = location.state as { mode?: string; message?: { id?: number } } | null;
  const legacyId = Number(compose && composeState?.mode === 'reply' ? composeState.message?.id : params.get('message'));
  const lookup = useQuery({
    queryKey: ['support-legacy-message', user?.id, role, legacyId],
    queryFn: async ({ signal }) => {
      try { return await getLegacySupportTicket(legacyId, signal); }
      catch (error) {
        if ((error as { response?: { status?: number } }).response?.status === 404) return null;
        throw error;
      }
    },
    enabled: !isLoading && Boolean(user?.id) && Number.isInteger(legacyId) && legacyId > 0,
    retry: false, staleTime: 30000, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  if (isLoading) return null;
  if (lookup.isLoading) return <p role="status" className="p-4 text-sm">Opening support request…</p>;
  if (lookup.isError) return <div role="alert" className="p-4 text-sm">Could not open this request.<Button variant="outline" className="ml-2" onClick={() => void lookup.refetch()}>Retry</Button></div>;
  if (lookup.data?.support_ticket_id) {
    params.set('ticket', String(lookup.data.support_ticket_id)); params.delete('message'); params.delete('new');
    const prefill = compose ? getSupportComposePrefill(location.search, location.state, user?.id) : undefined;
    params.delete('subject'); params.delete('body'); params.delete('body_text');
    return <Navigate replace to={supportInboxRedirect(params.toString(), location.hash)} state={prefill ? { supportReplyPrefill: { ...prefill, ticketId: lookup.data.support_ticket_id } } : undefined} />;
  }
  if (canUseEmailWorkspace(role)) return children;
  params.delete('message');
  if (compose) params.set('new', '1');
  // The draft stays in navigation state, not a new URL containing private text.
  const prefill = compose ? getSupportComposePrefill(location.search, location.state, user?.id) : undefined;
  params.delete('subject');
  params.delete('body');
  params.delete('body_text');
  return <Navigate replace to={supportInboxRedirect(params.toString(), location.hash)} state={prefill ? { supportPrefill: prefill } : undefined} />;
}
