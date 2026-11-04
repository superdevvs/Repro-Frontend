import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, CheckCircle2, CreditCard, Loader2, RefreshCw, Sparkles, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { forgetStudioAction, studioActionKey } from '@/lib/listingStudioPurchase';
import { forgetStudioClaimCheckoutReturn, readStudioClaimCheckoutReturn } from '@/lib/listingStudioClaimCheckout';
import { normalizeApiError } from '@/services/apiError';
import { listingStudioClaimBilling } from '@/services/listingStudioClaimBilling';
import { studioCheckoutUrl } from '@/services/listingStudioClientService';
import type { StudioPlan } from '@/types/listingStudioClient';
import { studioDate, studioMoney } from './client/studioPresentation';

const planCopy: Record<string, string> = { starter: 'For occasional listings', pro: 'For a steady flow of listings', studio: 'For growing teams and higher volume' };

export function ListingStudioClaimPlans({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient(); const lock = useRef(false);
  const [returnStatus] = useState(readStudioClaimCheckoutReturn); const pollStarted = useRef(Date.now());
  const [confirming, setConfirming] = useState(returnStatus === 'returned');
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const query = useQuery({ queryKey: ['studio-client', accountId, 'claim-billing'],
    queryFn: ({ signal }) => listingStudioClaimBilling.summary(signal), staleTime: 0, retry: false,
    refetchInterval: visible ? confirming && Date.now() - pollStarted.current < 120000 ? 3000 : 30000 : false,
    refetchIntervalInBackground: false, refetchOnWindowFocus: 'always', refetchOnReconnect: 'always',
  });
  useEffect(() => { forgetStudioClaimCheckoutReturn(); }, []);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (!query.data) return;
    queryClient.setQueryData(['studio-client', accountId, 'account'], query.data.account);
    if (query.data.account.subscription && ['active', 'trialing'].includes(query.data.account.subscription.status)) {
      setConfirming(false); forgetStudioAction(accountId, `subscription:${query.data.account.subscription.planCode}`);
    }
  }, [accountId, query.data, queryClient]);

  const navigateBilling = async (plan?: StudioPlan) => {
    if (lock.current) return;
    lock.current = true; setBusy(plan?.code ?? 'portal'); setError(''); setNotice('');
    try {
      const pending = query.data?.pendingCheckout;
      const key = plan ? pending?.planCode === plan.code ? pending.requestKey : studioActionKey(accountId, `subscription:${plan.code}`) : '';
      const result = plan ? await listingStudioClaimBilling.checkout(plan.code, key) : await listingStudioClaimBilling.portal();
      if (result.url) window.location.assign(studioCheckoutUrl(result.url));
      else if (['awaiting_webhook', 'paid', 'awaiting_payment', 'awaiting_reconciliation'].includes(result.status ?? '')) {
        pollStarted.current = Date.now(); setConfirming(true); setNotice('Your existing checkout is saved. We’re checking your subscription.');
        await query.refetch();
      } else throw new Error('Checkout is not available. Please refresh and try again.');
    } catch (failure) {
      const details = normalizeApiError(failure);
      const data = (failure as { response?: { data?: { data?: { retryWithNewKey?: boolean } } } }).response?.data?.data;
      if (plan && ['checkout_expired', 'checkout_failed'].includes(details.code) && data?.retryWithNewKey) forgetStudioAction(accountId, `subscription:${plan.code}`);
      setError(details.message); void query.refetch();
    } finally { lock.current = false; setBusy(null); }
  };

  if (query.isPending) return <section aria-label="Monthly editing plans" className="space-y-5 border-t pt-8"><h2 className="text-2xl font-semibold">Keep creating with Listing Studio</h2><p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading your plans and credit…</p><div className="grid gap-4 sm:grid-cols-3" aria-hidden="true">{[1, 2, 3].map(value => <div key={value} className="h-64 animate-pulse rounded-2xl border bg-muted/30 motion-reduce:animate-none" />)}</div></section>;
  if (!query.data) return <section aria-label="Monthly editing plans" className="space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-xl font-semibold">Monthly plans and editing credit</h2><p role="alert" className="text-sm text-muted-foreground">Plans could not be loaded. Your photo downloads are still available above.</p><Button variant="outline" onClick={() => void query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry plans</Button></section>;
  const { account, catalog, pendingCheckout, confirmationEmail } = query.data;
  const subscription = account.subscription; const existing = Boolean(subscription && !['canceled', 'incomplete_expired'].includes(subscription.status));
  const currentPlan = catalog.plans.find(plan => plan.code === subscription?.planCode);
  const ready = existing && ['active', 'trialing'].includes(subscription!.status) && account.status !== 'billing_attention';

  return <section aria-label="Monthly editing plans" className="space-y-6 border-t pt-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div className="space-y-2"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><Sparkles className="h-4 w-4" />Your next listing</p><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Keep creating with Listing Studio</h2><p className="max-w-2xl text-sm leading-6 text-muted-foreground">Choose a monthly plan for editing credit. Your free photo downloads stay yours.</p></div><span className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground">Billed monthly · USD</span></header>
    {existing && <div className="grid gap-5 rounded-2xl border border-primary/40 bg-card p-5 sm:grid-cols-[1fr_auto] sm:p-6"><div className="space-y-2"><p className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{currentPlan ? `Your ${currentPlan.name} plan` : 'Your Listing Studio subscription'}{ready ? ' is ready' : ''}</p><p className="text-sm text-muted-foreground">{subscription!.status.replaceAll('_', ' ')} · Current period ends {studioDate(subscription!.periodEnd)}</p><p className="text-xs text-muted-foreground">{confirmationEmail?.status === 'sent' ? 'Your subscription confirmation email has been sent.' : confirmationEmail && ['queued', 'submitting', 'awaiting_delivery'].includes(confirmationEmail.status) ? 'Your confirmation email is on its way.' : confirmationEmail?.status === 'needs_attention' ? 'Your plan is saved. We’re checking confirmation email delivery.' : 'Your plan and balance are saved in your dashboard account.'}</p></div><div className="space-y-2 sm:text-right"><p className="flex items-center gap-2 text-xs text-muted-foreground sm:justify-end"><Wallet className="h-4 w-4" />Available editing credit</p><p className="text-3xl font-semibold tabular-nums">{query.isError ? 'Balance unavailable' : studioMoney(account.credits.availableCents)}</p>{account.credits.reservedCents > 0 && <p className="text-xs text-muted-foreground">{studioMoney(account.credits.reservedCents)} reserved</p>}<Button size="sm" variant="outline" disabled={!!busy || !account.capabilities.canManageBilling} onClick={() => void navigateBilling()}><CreditCard className="mr-2 h-4 w-4" />{busy === 'portal' ? 'Opening billing…' : 'Manage subscription & invoices'}</Button></div></div>}
    {query.isError && <div role="alert" className="rounded-xl border p-4 text-sm">Your plan and balance could not be refreshed.<Button variant="link" onClick={() => void query.refetch()}>Retry plans</Button></div>}
    {account.notice && <p role="status" className="rounded-xl border p-4 text-sm leading-6 text-muted-foreground">{account.notice}</p>}
    {returnStatus === 'cancelled' && !ready && <p role="status" className="rounded-xl border p-4 text-sm">Checkout was closed. Your free photos are still available, and you can continue checkout when you’re ready.</p>}
    {confirming && !ready && <p role="status" className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"><Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />Checking your subscription. Your plan and credit will appear here after payment is confirmed.</p>}
    {pendingCheckout && !ready && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4"><p className="text-sm">You have an existing {catalog.plans.find(plan => plan.code === pendingCheckout.planCode)?.name ?? ''} checkout. Continue the same request to avoid starting another.</p><Button variant="outline" size="sm" disabled={!!busy} onClick={() => { const plan = catalog.plans.find(plan => plan.code === pendingCheckout.planCode); if (plan) void navigateBilling(plan); }}>Check existing checkout</Button></div>}
    <div className="grid gap-4 md:grid-cols-3">{catalog.plans.map(plan => <article key={plan.code} className={`relative flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6 ${plan.code === (currentPlan?.code ?? 'pro') ? 'border-primary/70' : ''}`} aria-label={`${plan.name} monthly plan`}>
      <div className="flex items-center justify-between gap-2"><h3 className="text-xl font-semibold">{plan.name}</h3>{currentPlan?.code === plan.code ? <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">Current plan</span> : plan.code === 'pro' && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">Recommended</span>}</div><p className="min-h-5 text-xs text-muted-foreground">{planCopy[plan.code]}</p>
      <p className="text-4xl font-semibold tracking-tight">{studioMoney(plan.monthlyPriceCents)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
      <p className="rounded-xl bg-muted/40 p-3 text-sm"><strong className="text-lg">{studioMoney(plan.monthlyCreditCents)}</strong> editing credit each month</p>
      <ul className="flex-1 space-y-2.5 text-xs leading-5 text-muted-foreground"><li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />Four editing services for your listing</li><li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />Up to 3 AI revisions per paid AI edit</li><li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{plan.revisionDiscountPercent ? `${plan.revisionDiscountPercent}% off optional team revisions` : 'Optional team revisions available'}</li></ul>
      {!existing && <Button className="mt-2 w-full" aria-label={`Subscribe to ${plan.name}`} disabled={!!busy || query.isError || !catalog.checkoutAvailable || (!account.capabilities.canSubscribe && !pendingCheckout) || (!!pendingCheckout && pendingCheckout.planCode !== plan.code)} onClick={() => void navigateBilling(plan)}>{busy === plan.code ? <><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />Opening Stripe…</> : <>{pendingCheckout?.planCode === plan.code ? 'Continue checkout' : `Subscribe to ${plan.name}`}<ArrowRight className="ml-2 h-4 w-4" /></>}</Button>}
    </article>)}</div>
    {!catalog.checkoutAvailable && !existing && <p role="status" className="text-sm text-muted-foreground">New subscriptions are temporarily unavailable. Your free downloads remain available above.</p>}
    {error && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"><p className="max-w-2xl text-xs leading-5 text-muted-foreground">Subscriptions renew monthly. Editing credit expires at the end of each billing period, with no rollover. Your free instant edits and the three-photo team offer are separate.</p><Button variant="outline" asChild><a href="/listing-studio">Open dashboard Studio<ArrowRight className="ml-2 h-4 w-4" /></a></Button></div>
  </section>;
}
