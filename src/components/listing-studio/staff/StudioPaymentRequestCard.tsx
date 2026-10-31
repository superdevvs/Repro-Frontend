import { useRef, useState } from 'react';
import { Copy, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { studioActionKey } from '@/lib/listingStudioPurchase';
import { studioManagedActionScope, studioPaymentRequestUrl } from '@/lib/listingStudioStaff';
import { normalizeApiError } from '@/services/apiError';
import { listingStudioStaff } from '@/services/listingStudioStaffService';
import type { StudioBillingRequest } from '@/types/listingStudioStaff';
import { studioDate, studioMoney } from '../client/studioPresentation';

const statusLabels: Record<string, string> = { pending: 'Waiting for client', pending_approval: 'Waiting for client', processing: 'Confirming payment', awaiting_payment: 'Waiting for payment', completed: 'Completed', paid: 'Paid', cancelled: 'Cancelled', canceled: 'Cancelled', expired: 'Expired', needs_attention: 'Needs attention' };
export function StudioPaymentRequestCard({ actorId, clientId, request, onChanged, onRefresh, onNewRequest }: { actorId: string; clientId: string; request: StudioBillingRequest; onChanged: (request: StudioBillingRequest) => void; onRefresh?: () => void; onNewRequest?: (request: StudioBillingRequest) => void }) {
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [manualCopy, setManualCopy] = useState(false); const [cancelOpen, setCancelOpen] = useState(false);
  let appUrl = ''; try { appUrl = studioPaymentRequestUrl(request.appUrl, request.id); } catch { /* Never display an untrusted or hosted billing URL. */ }
  const scope = studioManagedActionScope(actorId, clientId);
  const email = async () => {
    if (lock.current || !request.actions.canEmail) return; lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await listingStudioStaff.emailRequest(clientId, request.id, studioActionKey(scope, 'request-email:' + request.id)); onChanged(result.request);
      setNotice(result.delivery.status === 'sent' ? 'Email sent to the client’s registered address.' : result.delivery.status === 'needs_attention' ? 'This email needs attention. You can still copy the review link.' : 'Email queued for the client’s registered address.');
    } catch (failure) { setError(normalizeApiError(failure).message); } finally { lock.current = false; setBusy(false); }
  };
  const cancel = async () => {
    if (lock.current || !request.actions.canCancel) return; lock.current = true; setBusy(true); setError(''); setNotice('');
    try { onChanged(await listingStudioStaff.cancelRequest(clientId, request.id, studioActionKey(scope, 'request-cancel:' + request.id))); setCancelOpen(false); }
    catch (failure) { setError(normalizeApiError(failure).message); } finally { lock.current = false; setBusy(false); }
  };
  const copy = async () => {
    setError(''); setNotice('');
    try { if (!appUrl || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(appUrl); setNotice('Review link copied. The client must sign in and confirm before paying.'); }
    catch { setManualCopy(true); setNotice('Copy the review link below.'); }
  };
  return <article className="space-y-4 rounded-2xl border bg-card p-5" aria-label="Client payment request">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{request.kind === 'order_payment' ? 'Photo payment request' : request.kind === 'subscription_upgrade' ? 'Plan upgrade request' : 'New plan request'}</h3><p className="mt-1 text-xs text-muted-foreground">For {request.client.name} · {request.client.email}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{statusLabels[request.status] ?? request.status.replaceAll('_', ' ')}</span></header>
    <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-lg font-semibold tabular-nums">{request.amountCents === null ? "Calculated at client review" : studioMoney(request.amountCents)}{request.kind === 'subscription_purchase' && <span className="text-xs font-normal text-muted-foreground"> / month</span>}</p>{request.planCode && <p className="text-sm capitalize">{request.planCode}</p>}</div>
    <p className="text-xs leading-5 text-muted-foreground">{request.kind === 'subscription_upgrade' ? 'The client reviews the current prorated charge before approving this upgrade. ' : ''}Review link expires {studioDate(request.expiresAt)}. No payment is collected by sharing this link.</p>
    <p className="text-xs text-muted-foreground">Email: {request.email.status?.replaceAll('_', ' ') || 'Not sent'}{request.email.lastSentAt ? ' · ' + studioDate(request.email.lastSentAt) : ''}</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!appUrl || busy || !request.actions.canShare} onClick={() => void copy()}><Copy aria-hidden="true" className="mr-2 h-4 w-4" />Copy client review link</Button><Button variant="outline" disabled={busy || !request.actions.canEmail} onClick={() => void email()}><Mail aria-hidden="true" className="mr-2 h-4 w-4" />{busy ? 'Updating…' : 'Send to registered email'}</Button>{request.actions.canCancel && <Button variant="ghost" disabled={busy} onClick={() => setCancelOpen(true)}>Cancel request</Button>}{onNewRequest && ['expired', 'cancelled'].includes(request.status) && <Button variant="outline" disabled={busy} onClick={() => onNewRequest(request)}>Create new request</Button>}{onRefresh && <Button variant="ghost" size="icon" aria-label="Refresh payment request" onClick={onRefresh}><RefreshCw className="h-4 w-4" /></Button>}</div>
    {!appUrl && <p role="alert" className="text-sm text-destructive">This review link could not be verified. Refresh the request before sharing it.</p>}
    {manualCopy && appUrl && <div className="space-y-2"><Label htmlFor={'payment-request-link-' + request.id}>Client review link</Label><Input id={'payment-request-link-' + request.id} readOnly value={appUrl} onFocus={event => event.target.select()} /></div>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={cancelOpen} onOpenChange={open => { if (!busy) setCancelOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Cancel this payment request?</DialogTitle><DialogDescription>The client will no longer be able to approve this request. This does not refund an existing payment.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setCancelOpen(false)}>Keep request</Button><Button disabled={busy} onClick={() => void cancel()}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</Button></DialogFooter>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</DialogContent></Dialog>
  </article>;
}
