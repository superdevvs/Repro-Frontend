import { useCallback, useEffect, useRef, useState } from 'react';
import { Share2, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/auth';
import { getApiHeaders } from '@/services/api';
import { API_BASE_URL } from '@/config/env';
import type { ShootData } from '@/types/shoots';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Invitation = { id: number; email: string; expires_at: string; revoked_at: string | null; last_verified_at: string | null };

type ShareButtonProps = { shoot: ShootData; compact?: boolean; className?: string };

export function ShootGuestShareButton(props: ShareButtonProps) {
  const { user, role: activeRole } = useAuth();
  const role = String(activeRole || user?.role || '').toLowerCase().replace(/[_ -]/g, '');
  const allowed = ['admin', 'superadmin', 'editingmanager'].includes(role)
    || (role === 'client' && user?.id != null && props.shoot.client?.id != null && String(props.shoot.client.id) === String(user.id));
  return allowed ? <GuestShareControl key={`${props.shoot.id}:${user?.id}:${role}`} {...props} /> : null;
}

function GuestShareControl({ shoot, compact = false, className }: ShareButtonProps) {
  const pendingRequests = useRef(new Set<AbortController>());
  useEffect(() => { const pending = pendingRequests.current; return () => { pending.forEach(controller => controller.abort()); }; }, []);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const endpoint = `${API_BASE_URL}/api/shoots/${encodeURIComponent(shoot.id)}/guest-shares`;
  const request = useCallback(async (url: string, method = 'GET', body?: object) => {
    const controller = new AbortController(); pendingRequests.current.add(controller);
    try {
      const response = await fetch(url, { method, credentials: 'include', signal: controller.signal, headers: getApiHeaders(), ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
      if (!response.ok) throw new Error(data.message || 'Unable to update guest access.');
      return data;
    } finally { pendingRequests.current.delete(controller); }
  }, []);
  const refresh = useCallback(async () => {
    const result = await request(endpoint);
    setInvitations(result.data ?? []);
  }, [endpoint, request]);
  useEffect(() => {
    if (!open) return;
    setError(''); setMessage('');
    void refresh().catch((reason: Error) => setError(reason.message));
  }, [open, refresh]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await request(endpoint, 'POST', { email: email.trim() });
      setMessage(`Magic Link sent to ${email.trim()}.`); setEmail(''); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send invitation.'); }
    finally { setBusy(false); }
  };
  const revoke = async (id: number) => {
    setBusy(true); setError(''); setMessage('');
    try { await request(`${endpoint}/${id}`, 'DELETE'); await refresh(); setMessage('Guest access revoked.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to revoke access.'); }
    finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size={compact ? 'icon' : 'sm'} className={cn('gap-1.5 rounded-lg', className)} aria-label="Share shoot"><Share2 className="h-3.5 w-3.5" />{!compact && 'Magic Link'}</Button></DialogTrigger>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Send a Magic Link</DialogTitle><DialogDescription>Email a link to view this property's released media and tours. The recipient opens the link and verifies their email with a code. No account is needed.</DialogDescription></DialogHeader>
      <div className="flex gap-3 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /><p>Access lasts 30 days and can be revoked here. Internal notes, billing details and access codes stay private. Media remains subject to payment and delivery access.</p></div>
      <form onSubmit={invite} className="space-y-3"><Label htmlFor="guest-share-email">Recipient email</Label><div className="flex gap-2"><Input id="guest-share-email" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" disabled={busy} /><Button type="submit" disabled={busy || !email.trim()} className="gap-2"><Mail className="h-4 w-4" />{busy ? 'Working…' : 'Send link'}</Button></div></form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
      {invitations.length > 0 && <div className="max-h-64 space-y-2 overflow-y-auto border-t pt-3"><h3 className="text-sm font-semibold">Guest access</h3>{invitations.map(invitation => {
        const inactive = Boolean(invitation.revoked_at) || new Date(invitation.expires_at).getTime() <= Date.now();
        return <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate text-sm">{invitation.email}</p><p className="text-xs text-muted-foreground">{invitation.revoked_at ? 'Revoked' : inactive ? 'Expired' : `${invitation.last_verified_at ? 'Verified · ' : ''}Expires ${new Date(invitation.expires_at).toLocaleDateString()}`}</p></div>{!inactive && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void revoke(invitation.id)}>Revoke</Button>}</div>;
      })}</div>}
    </DialogContent>
  </Dialog>;
}
