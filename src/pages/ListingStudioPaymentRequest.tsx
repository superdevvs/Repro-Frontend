import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { studioDate, studioMoney } from '@/components/listing-studio/client/studioPresentation';
import { isStudioPaymentRequestId, studioClientPaymentUrl } from '@/lib/listingStudioStaff';
import { forgetStudioRequestConfirmation, readStudioRequestConfirmation, rememberStudioRequestConfirmation } from '@/lib/listingStudioRequestConfirmation';
import { studioActionKey } from '@/lib/listingStudioPurchase';
import { normalizeApiError } from '@/services/apiError';
import { listingStudioPaymentRequests } from '@/services/listingStudioPaymentRequestService';

const terminal = new Set(['completed', 'cancelled', 'expired']);
const staleReview = new Set(['review_stale', 'billing_request_expired', 'subscription_review_expired', 'subscription_review_changed']);

export default function ListingStudioPaymentRequest() {
  const { user, isAuthenticated, isLoading, isImpersonating } = useAuth(); const { requestId } = useParams();
  if (isLoading) return <p role="status" className="p-6">Loading your account…</p>;
  if (!isAuthenticated || !user || user.role !== 'client' || isImpersonating || user.isActive === false) return <div className="space-y-3 p-6"><h1 className="text-2xl font-semibold">Review payment request</h1><p>Sign in to the client account this request was created for. Staff accounts cannot approve payment for a client.</p></div>;
  if (!isStudioPaymentRequestId(requestId)) return <p role="alert" className="p-6">This payment request could not be found.</p>;
  return <PaymentRequestReview key={user.id + ':' + requestId} accountId={String(user.id)} requestId={requestId} />;
}

function PaymentRequestReview({ accountId, requestId }: { accountId: string; requestId: string }) {
  const client = useQueryClient(); const queryKey = ['studio-client', accountId, 'payment-request', requestId];
  const query = useQuery({ queryKey, queryFn: ({ signal }) => listingStudioPaymentRequests.review(requestId, signal), refetchOnWindowFocus: true, refetchInterval: query => query.state.data?.request.status === 'processing' ? 10000 : false });
  const [accepted, setAccepted] = useState(false); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(() => readStudioRequestConfirmation(accountId, requestId));
  const request = query.data?.request; const review = query.data?.review;
  let recoveryUrl: string | null = null;
  if (query.data?.url && request?.actions.canConfirm && ['processing', 'needs_attention'].includes(request.status)) {
    try { recoveryUrl = studioClientPaymentUrl(query.data.url); } catch { /* Never navigate to an unverified recovery URL. */ }
  }
  useEffect(() => { setAccepted(false); }, [review?.reviewId, review?.confirmationToken, review?.amountCents, review?.monthlyPriceCents]);
  useEffect(() => { if (request && terminal.has(request.status)) { forgetStudioRequestConfirmation(accountId, requestId); setPending(null); } }, [accountId, requestId, request]);
  const refresh = () => { setError(''); void query.refetch(); };
  const confirm = async () => {
    if (lock.current || !request || !request.actions.canConfirm || (!pending && (!accepted || !review || !request.actions.canConfirm))) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const attempt = pending ?? rememberStudioRequestConfirmation(accountId, requestId, review!); setPending(attempt);
      const result = await listingStudioPaymentRequests.confirm(requestId, attempt);
      await client.invalidateQueries({ queryKey: ['studio-client', accountId] });
      if (result.url) { window.location.assign(studioClientPaymentUrl(result.url)); return; }
      if (terminal.has(result.request.status)) { forgetStudioRequestConfirmation(accountId, requestId); setPending(null); }
      setNotice(result.status === 'needs_attention' ? 'This existing request needs review. Do not start another purchase.' : result.request.status === 'completed' ? 'This request is complete. Your credit and subscription are available in Listing Studio.' : 'Your confirmation is saved. Payment updates will appear here; you do not need to create another purchase.');
    } catch (failure) {
      const details = normalizeApiError(failure);
      if (staleReview.has(details.code)) { forgetStudioRequestConfirmation(accountId, requestId); setPending(null); setAccepted(false); void query.refetch(); }
      setError(details.message);
    } finally { lock.current = false; setBusy(false); }
  };
  const cancel = async () => {
    if (lock.current || !request?.actions.canCancel || pending) return; lock.current = true; setBusy(true); setError('');
    try { const saved = await listingStudioPaymentRequests.cancel(requestId, studioActionKey(accountId, 'request-cancel:' + requestId)); client.setQueryData(queryKey, { request: saved, review: null }); setCancelOpen(false); await client.invalidateQueries({ queryKey: ['studio-client', accountId] }); }
    catch (failure) { setError(normalizeApiError(failure).message); } finally { lock.current = false; setBusy(false); }
  };
  if (query.isPending) return <p role="status" className="p-6">Loading your payment request…</p>;
  if (!request || request.client.id !== accountId) return <div role="alert" className="space-y-3 p-6"><h1 className="text-xl font-semibold">Payment request unavailable</h1><p className="text-sm text-muted-foreground">This request could not be loaded for your account. Sign in with the client account it was sent to.</p><Button variant="outline" onClick={refresh}>Try again</Button></div>;
  return <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
    <header className="space-y-2"><h1 className="text-2xl font-semibold">Review payment request</h1><p className="text-sm text-muted-foreground">Created by {request.actor.name} for {request.client.name} · {request.client.email}</p></header>
    <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
      <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{request.kind === 'order_payment' ? 'One photo edit' : request.kind === 'subscription_upgrade' ? 'Plan upgrade' : 'Monthly subscription'}</p><h2 className="mt-2 text-lg font-semibold capitalize">{review?.planCode ?? request.planCode ?? 'Listing Studio photo edit'}</h2></div>
      <p className="text-3xl font-semibold tabular-nums">{review?.amountCents !== undefined || request.amountCents !== null ? studioMoney(review?.amountCents ?? request.amountCents!) : "Amount awaiting review"}{request.kind === 'subscription_purchase' && <span className="text-sm font-normal text-muted-foreground"> / month</span>}</p>
      {request.kind === 'subscription_purchase' && <p className="text-sm leading-6 text-muted-foreground">This is a recurring monthly subscription. Unused editing credit expires at the end of each billing period and does not roll over.</p>}
      {request.kind === 'subscription_upgrade' && <div className="space-y-2 text-sm text-muted-foreground"><p>The amount above is the current prorated charge for this upgrade.</p>{review?.currentPlanCode && review.planCode && <p className="capitalize">{review.currentPlanCode} → {review.planCode}</p>}{review?.monthlyPriceCents !== undefined && <p>New recurring price: {studioMoney(review.monthlyPriceCents)} / month.</p>}{review?.monthlyCreditCents !== undefined && <p>Includes {studioMoney(review.monthlyCreditCents)} editing credit each billing period. Unused credit does not roll over.</p>}{review?.additionalCreditCents !== undefined && <p>Additional editing credit: {studioMoney(review.additionalCreditCents)}.</p>}{review?.periodEnd && <p>Current period ends {studioDate(review.periodEnd)}.</p>}</div>}
      <p className="text-xs text-muted-foreground">Request expires {studioDate(request.expiresAt)}.</p>
      {request.status === 'expired' && <p role="status" className="rounded-xl bg-muted p-3 text-sm">This request has expired. Ask the team for a new request; no new payment can start from this link.</p>}
      {request.status === 'cancelled' && <p role="status" className="rounded-xl bg-muted p-3 text-sm">This payment request was cancelled.</p>}
      {request.status === 'completed' && <p role="status" className="rounded-xl bg-muted p-3 text-sm">This request is complete.</p>}
      {request.status === 'needs_attention' && <p role="status" className="rounded-xl bg-muted p-3 text-sm">The team is reviewing this existing request. Starting another purchase is not needed.</p>}
      {pending && !terminal.has(request.status) ? <div className="space-y-3"><p className="text-sm leading-6">Your earlier confirmation is saved. Check that same confirmation before starting anything else.</p><Button disabled={busy || !request.actions.canConfirm} onClick={() => void confirm()}>{busy ? 'Checking confirmation…' : 'Check existing confirmation'}</Button></div> : request.actions.canConfirm && review ? <div className="space-y-4"><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} /><span>I approve {studioMoney(review.amountCents)}{request.kind === 'subscription_purchase' ? ' each month' : ''} for this {request.kind === 'order_payment' ? 'photo edit' : request.kind === 'subscription_upgrade' ? 'plan upgrade' : 'subscription'}.</span></label><Button disabled={busy || !accepted} onClick={() => void confirm()}>{busy ? 'Confirming…' : 'Approve and continue to payment'}</Button></div> : null}
      {!pending && !review && recoveryUrl && <div className="space-y-3"><p className="text-sm">Your earlier approval is saved. Continue the existing payment to finish any required authentication.</p><Button asChild><a href={recoveryUrl}>Continue existing payment</a></Button></div>}
      {request.actions.canCancel && !pending && <Button variant="ghost" disabled={busy} onClick={() => setCancelOpen(true)}>Decline request</Button>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3 border-t pt-4"><Button variant="outline" disabled={busy || query.isFetching} onClick={refresh}>Refresh request</Button><Button asChild variant="ghost"><Link to="/listing-studio?tab=billing">Open credit & plan</Link></Button></div>
    </section>
    <Dialog open={cancelOpen} onOpenChange={open => { if (!busy) setCancelOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Decline this payment request?</DialogTitle><DialogDescription>This closes the request without starting a new payment.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setCancelOpen(false)}>Keep request</Button><Button disabled={busy} onClick={() => void cancel()}>{busy ? 'Declining…' : 'Confirm decline'}</Button></DialogFooter>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</DialogContent></Dialog>
  </div>;
}
