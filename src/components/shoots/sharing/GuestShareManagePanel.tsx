import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2, Mail, Search, ShieldCheck, UserRound, X } from 'lucide-react';
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
  if (loading && !invitations.length) return <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading shared access…</div>;
  if (!invitations.length) return <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center"><div className="mb-3 rounded-2xl bg-primary/10 p-3 text-primary"><UserRound className="h-6 w-6" /></div><h3 className="font-semibold">No invitations yet</h3><p className="mb-5 mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">Invite someone to view this property’s media and tours. Their access will appear here.</p><Button variant="outline" className="rounded-xl" onClick={onInvite}>Invite people</Button></div>;
  return <div className="space-y-3">
    <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a recipient…" aria-label="Find a shared recipient" className="h-10 rounded-xl pl-9" /></div>
    <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
      {filtered.map(invitation => {
        const active = invitationIsActive(invitation);
        const resendWait = Math.max(0, Math.ceil(((invitation.resend_available_at ? new Date(invitation.resend_available_at).getTime() : 0) - now) / 1000));
        const canRevoke = !invitation.revoked_at && invitation.status !== 'revoked' && new Date(invitation.expires_at).getTime() > now;
        const status = active ? invitation.status : invitation.status === 'active' || invitation.status === 'verified' ? 'expired' : invitation.status;
        return <article key={invitation.id} aria-label={`Access for ${invitation.email}`} className="rounded-2xl border bg-muted/15 p-3.5">
          <div className="flex items-start gap-3"><span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold', active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{invitation.email[0].toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{invitation.email}</p><p className="mt-1 text-[11px] text-muted-foreground">{invitation.creator?.name ? `Shared by ${invitation.creator.name} · ` : ''}{formatGuestDate(invitation.created_at)}</p></div><span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground')}>{statusLabels[status]}</span></div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"><span>Expires {formatGuestDate(invitation.expires_at)}</span>{invitation.last_verified_at && <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Opened {formatGuestDate(invitation.last_verified_at)}</span>}</div>
          {revokeId === invitation.id ? <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-destructive/5 p-2"><span className="text-xs">Revoke this recipient’s access?</span><div className="flex gap-1"><Button size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={busy} onClick={() => setRevokeId(null)}>Cancel</Button><Button size="sm" variant="destructive" className="h-8 rounded-lg px-2 text-xs" disabled={busy} onClick={() => { setRevokeId(null); onManage(invitation, 'revoke'); }}>Revoke</Button></div></div>
            : <div className="mt-3 flex flex-wrap items-center gap-1.5"><Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs" disabled={busy || !invitation.can_copy} onClick={() => onCopy(invitation)} aria-label={`Copy link for ${invitation.email}`} title={!invitation.can_copy ? 'Send a new invitation to create a copyable link.' : undefined}>{copiedId === invitation.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{copiedId === invitation.id ? 'Copied' : 'Copy link'}</Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 rounded-lg px-2 text-xs" disabled={busy || !invitation.can_resend || resendWait > 0} onClick={() => onManage(invitation, 'resend')} aria-label={`Resend invitation to ${invitation.email}`} title={resendWait ? `Available again in ${resendWait} seconds` : undefined}><Mail className="h-3.5 w-3.5" />{resendWait ? `Resend in ${resendWait}s` : invitation.can_copy ? 'Resend' : 'Send new link'}</Button>
              {canRevoke && <Button size="sm" variant="ghost" className="ml-auto h-8 gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-destructive" disabled={busy} onClick={() => setRevokeId(invitation.id)} aria-label={`Revoke access for ${invitation.email}`}><X className="h-3.5 w-3.5" />Revoke</Button>}
            </div>}
        </article>;
      })}
      {!filtered.length && <p className="py-8 text-center text-sm text-muted-foreground">No matching recipients in the loaded invitations.</p>}
    </div>
    {hasMore && <Button type="button" variant="outline" className="h-9 w-full rounded-xl text-xs" disabled={loadingMore || busy} onClick={onLoadMore}>{loadingMore ? 'Loading…' : 'Load older invitations'}</Button>}
    <p className="flex items-start gap-2 pt-1 text-xs leading-relaxed text-muted-foreground"><Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />Each link belongs to its invited email. Revoking access stops that link from opening.</p>
  </div>;
}
