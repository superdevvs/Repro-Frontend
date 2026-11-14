import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Mail, Search, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatGuestDate, invitationIsActive, type GuestInvitation } from './guestShareTypes';

type Props = {
  invitations: GuestInvitation[];
  loading: boolean;
  busy: boolean;
  copiedId: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onCopy: (invitation: GuestInvitation) => void;
  onManage: (invitation: GuestInvitation, action: 'revoke' | 'resend') => void;
  onInvite: () => void;
};

const statusLabels: Record<GuestInvitation['status'], string> = {
  active: 'Invited', verified: 'Verified', expired: 'Expired', revoked: 'Revoked',
  unavailable: 'Unavailable', sending: 'Sending', failed: 'Send failed',
};

export function GuestShareManagePanel({ invitations, loading, busy, copiedId, hasMore, loadingMore, onLoadMore, onCopy, onManage, onInvite }: Props) {
  const [search, setSearch] = useState('');
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const filtered = invitations.filter(invitation => invitation.email.toLowerCase().includes(search.trim().toLowerCase()));
  if (loading && !invitations.length) return <div role="status" className="flex min-h-32 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading shared access…</div>;
  if (!invitations.length) return <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center"><h3 className="text-sm font-medium">No invitations yet</h3><p className="mb-3 mt-1 text-xs text-muted-foreground">Share media and tours with a Magic Link.</p><Button size="sm" variant="outline" className="h-9 rounded-lg text-xs" onClick={onInvite}>Invite people</Button></div>;
  return <div className="space-y-2">
    <div className="relative"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a recipient…" aria-label="Find a shared recipient" className="h-9 rounded-lg pl-9 text-xs" /></div>
    <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
      {filtered.map(invitation => {
        const active = invitationIsActive(invitation);
        const resendWait = Math.max(0, Math.ceil(((invitation.resend_available_at ? new Date(invitation.resend_available_at).getTime() : 0) - now) / 1000));
        const canRevoke = !invitation.revoked_at && invitation.status !== 'revoked' && new Date(invitation.expires_at).getTime() > now;
        const status = active ? invitation.status : invitation.status === 'active' || invitation.status === 'verified' ? 'expired' : invitation.status;
        return <article key={invitation.id} aria-label={`Access for ${invitation.email}`} className="rounded-lg border bg-muted/15 p-2.5">
          <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium" title={invitation.email}>{invitation.email}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{invitation.creator?.name ? `Shared by ${invitation.creator.name} · ` : ''}{formatGuestDate(invitation.created_at)}</p></div><span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground')}>{statusLabels[status]}</span></div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground"><span>Expires {formatGuestDate(invitation.expires_at)}</span>{invitation.last_verified_at && <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Opened {formatGuestDate(invitation.last_verified_at)}</span>}</div>
          {revokeId === invitation.id ? <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-destructive/5 p-2"><span className="text-xs">Revoke this recipient’s access?</span><div className="flex gap-1"><Button size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={busy} onClick={() => setRevokeId(null)}>Cancel</Button><Button size="sm" variant="destructive" className="h-8 rounded-md px-2 text-xs" disabled={busy} onClick={() => { setRevokeId(null); onManage(invitation, 'revoke'); }}>Revoke</Button></div></div>
            : <div className="mt-2 flex flex-wrap items-center gap-1"><Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-md px-2 text-xs" disabled={busy || !invitation.can_copy} onClick={() => onCopy(invitation)} aria-label={`Copy link for ${invitation.email}`} title={!invitation.can_copy ? 'Send a new invitation to create a copyable link.' : undefined}>{copiedId === invitation.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{copiedId === invitation.id ? 'Copied' : 'Copy link'}</Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 rounded-lg px-2 text-xs" disabled={busy || !invitation.can_resend || resendWait > 0} onClick={() => onManage(invitation, 'resend')} aria-label={`Resend invitation to ${invitation.email}`} title={resendWait ? `Available again in ${resendWait} seconds` : undefined}><Mail className="h-3.5 w-3.5" />{resendWait ? `Resend in ${resendWait}s` : invitation.can_copy ? 'Resend' : 'Send new link'}</Button>
              {canRevoke && <Button size="sm" variant="ghost" className="ml-auto h-8 gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-destructive" disabled={busy} onClick={() => setRevokeId(invitation.id)} aria-label={`Revoke access for ${invitation.email}`}><X className="h-3.5 w-3.5" />Revoke</Button>}
            </div>}
        </article>;
      })}
      {!filtered.length && <p className="py-5 text-center text-xs text-muted-foreground">No matching recipients in the loaded invitations.</p>}
    </div>
    {hasMore && <Button type="button" variant="outline" className="h-9 w-full rounded-lg text-xs" disabled={loadingMore || busy} onClick={onLoadMore}>{loadingMore ? 'Loading…' : 'Load older invitations'}</Button>}
  </div>;
}
