import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listingStudioClient, studioCheckoutUrl } from '@/services/listingStudioClientService';
import { normalizeApiError } from '@/services/apiError';
import { forgetStudioAction, studioActionKey } from '@/lib/listingStudioPurchase';
import type { StudioAccount, StudioCatalog, StudioPlan } from '@/types/listingStudioClient';
import { studioDate, studioMoney } from './studioPresentation';

export function StudioCreditSummary({ account }: { account: StudioAccount }) {
  return <section aria-label="Editing credit" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {[
      ['Available credit', account.credits.availableCents, account.credits.expiresAt ? `Expires ${studioDate(account.credits.expiresAt)}` : 'Choose a plan or pay per photo'],
      ['Reserved for edits', account.credits.reservedCents, 'Held while your photos are being edited'],
      ['Credit used this period', account.credits.usedCents, 'Charged for saved, completed edits'],
    ].map(([label, value, detail], index) => <div key={String(label)} className={`space-y-2 rounded-2xl border bg-card p-4 sm:p-5 ${index === 0 ? 'col-span-2 sm:col-span-1' : ''}`}><h2 className="text-xs text-muted-foreground sm:text-sm">{label}</h2><p className="text-2xl font-semibold tabular-nums">{studioMoney(Number(value))}</p><p className="text-xs leading-5 text-muted-foreground">{detail}</p></div>)}
  </section>;
}

export function StudioBilling({ accountId, account, catalog, initialPlanCode, onPlanConsumed }: { accountId: string; account: StudioAccount; catalog: StudioCatalog; initialPlanCode?: string | null; onPlanConsumed?: () => void }) {
  const [page, setPage] = useState(1); const [selectedPlan, setSelectedPlan] = useState<StudioPlan | null>(() => account.capabilities.canSubscribe ? catalog.plans.find(plan => plan.code === initialPlanCode) ?? null : null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const [notice, setNotice] = useState(''); const queryClient = useQueryClient();
  const history = useQuery({ queryKey: ['studio-client', accountId, 'transactions', page], queryFn: () => listingStudioClient.transactions(page) });
  useEffect(() => { if (initialPlanCode) onPlanConsumed?.(); }, [initialPlanCode, onPlanConsumed]);
  const navigateBilling = async (plan?: StudioPlan) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = plan
        ? await listingStudioClient.subscriptionCheckout(plan.code, studioActionKey(accountId, `subscription:${plan.code}`))
        : await listingStudioClient.billingPortal();
      if (result.url) window.location.assign(studioCheckoutUrl(result.url));
      else if (plan && ['awaiting_webhook', 'paid'].includes(result.status ?? '')) {
        setSelectedPlan(null); setNotice('Your existing checkout is saved. Subscription confirmation will appear here.');
        await queryClient.invalidateQueries({ queryKey: ['studio-client', accountId, 'account'] });
      } else throw new Error('Billing navigation is unavailable.');
    } catch (failure) {
      const details = normalizeApiError(failure);
      const data = (failure as { response?: { data?: { data?: { retryWithNewKey?: boolean }; retryWithNewKey?: boolean } } }).response?.data;
      if (plan && ['checkout_expired', 'checkout_failed'].includes(details.code) && (data?.retryWithNewKey || data?.data?.retryWithNewKey)) forgetStudioAction(accountId, `subscription:${plan.code}`);
      setError(details.message);
    } finally { lock.current = false; setBusy(false); }
  };
  const currentPlan = catalog.plans.find(plan => plan.code === account.subscription?.planCode);
  return <div className="space-y-6">
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 sm:p-6">
      <div className="space-y-2"><h2 className="text-lg font-semibold">{currentPlan ? `${currentPlan.name} plan` : 'Your editing plan'}</h2><p className="text-sm leading-6 text-muted-foreground">{account.subscription ? `${account.subscription.status.replaceAll('_', ' ')} · ${account.subscription.cancelAtPeriodEnd ? 'Ends' : 'Current period ends'} ${studioDate(account.subscription.periodEnd)}` : 'Pay per photo or choose monthly editing credit.'}</p><p className="text-xs text-muted-foreground">Credit expires at the end of each billing period. No rollover.</p></div>
      {account.capabilities.canManageBilling && <Button variant="outline" disabled={busy} onClick={() => void navigateBilling()}><ArrowUpRight className="mr-2 h-4 w-4" />{busy ? 'Opening…' : 'Manage subscription & invoices'}</Button>}
    </section>
    <section aria-label="Monthly plans" className="grid gap-4 md:grid-cols-3">
      {catalog.plans.map(plan => <article key={plan.code} className={`flex flex-col gap-4 rounded-2xl border bg-card p-5 ${currentPlan?.code === plan.code ? 'border-primary' : ''}`}><div><h3 className="font-semibold">{plan.name}{currentPlan?.code === plan.code ? ' · Current plan' : ''}</h3><p className="mt-3 text-3xl font-semibold">{studioMoney(plan.monthlyPriceCents)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p></div><p className="text-sm">{studioMoney(plan.monthlyCreditCents)} monthly editing credit</p><p className="flex-1 text-sm text-muted-foreground">{plan.revisionDiscountPercent ? `${plan.revisionDiscountPercent}% off team revisions` : 'Optional team revisions'}</p><Button variant={plan.code === 'pro' ? 'default' : 'outline'} disabled={!account.capabilities.canSubscribe || !catalog.checkoutAvailable || busy} onClick={() => { setError(''); setSelectedPlan(plan); }}>Choose {plan.name}</Button></article>)}
    </section>
    {error && !selectedPlan && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-xl border bg-muted/50 p-4 text-sm">{notice}</p>}
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Transactions</h2><p className="mt-1 text-sm text-muted-foreground">Editing credit and individual Studio payments. Subscription invoices are available in billing management.</p>
      {history.isPending && <p role="status" className="flex items-center gap-2 py-8 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading transactions…</p>}
      {history.isError && <div role="alert" className="space-y-2 py-6 text-sm"><p>Your transactions could not be loaded.</p><Button size="sm" variant="outline" onClick={() => void history.refetch()}>Try again</Button></div>}
      {history.data?.transactions.length === 0 && <p className="py-8 text-sm text-muted-foreground">No Studio transactions yet.</p>}
      {history.data && history.data.transactions.length > 0 && <div className="mt-5 divide-y">{history.data.transactions.map(transaction => <article key={transaction.id} className="flex items-start justify-between gap-4 py-4"><div className="min-w-0 space-y-1"><h3 className="text-sm font-medium">{transaction.description}</h3><p className="text-xs text-muted-foreground">{studioDate(transaction.createdAt)} · {transaction.balanceType === 'editing_credit' ? 'Editing credit' : 'Card'} · {transaction.status}</p>{transaction.expiresAt && <p className="text-xs text-muted-foreground">Credit period ends {studioDate(transaction.expiresAt)}</p>}</div><p className="whitespace-nowrap text-sm font-semibold tabular-nums">{transaction.amountCents > 0 ? '+' : ''}{studioMoney(transaction.amountCents)}</p></article>)}</div>}
      {history.data && (page > 1 || history.data.pagination.hasMore) && <nav aria-label="Transaction pages" className="mt-4 flex items-center justify-between gap-3"><Button variant="outline" size="sm" disabled={page === 1 || history.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="text-xs text-muted-foreground">Page {page}</span><Button variant="outline" size="sm" disabled={!history.data.pagination.hasMore || history.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></nav>}
    </section>
    <Dialog open={Boolean(selectedPlan)} onOpenChange={open => { if (!open && !busy) setSelectedPlan(null); }}><DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>Choose {selectedPlan?.name}</DialogTitle><DialogDescription>Review your monthly subscription before continuing to secure checkout.</DialogDescription></DialogHeader>{selectedPlan && <div className="space-y-4"><p className="text-2xl font-semibold">{studioMoney(selectedPlan.monthlyPriceCents)} <span className="text-sm font-normal text-muted-foreground">per month</span></p><p className="text-sm leading-6">Includes {studioMoney(selectedPlan.monthlyCreditCents)} editing credit each billing period. Unused credit expires at period end and does not roll over.</p><p className="text-sm leading-6 text-muted-foreground">This is a recurring subscription. Manage future changes and cancellation through your billing portal.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setSelectedPlan(null)}>Back</Button><Button disabled={busy} onClick={() => void navigateBilling(selectedPlan)}>{busy ? 'Opening checkout…' : 'Continue to secure checkout'}</Button></div></div>}</DialogContent></Dialog>
  </div>;
}
