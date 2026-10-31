import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ImagePlus, Receipt, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isStudioManagedAccount } from '@/lib/studioBillingAccess';
import { useStudioAccount } from '@/hooks/useStudioAccount';
import { useStudioOrderBalanceRefresh } from '@/hooks/useStudioOrderBalanceRefresh';
import { forgetStudioAction, studioActionKey } from '@/lib/listingStudioPurchase';
import { studioManagedActionScope, studioManagedScope } from '@/lib/listingStudioStaff';
import { normalizeApiError } from '@/services/apiError';
import { listingStudioStaff } from '@/services/listingStudioStaffService';
import type { StudioOrder, StudioPlan } from '@/types/listingStudioClient';
import type { StudioBillingRequest, StudioBillingRequestInput } from '@/types/listingStudioStaff';
import { StudioNewEdit } from '../client/StudioNewEdit';
import { StudioPlanCards, StudioServicePricing } from './StudioPlanCatalog';
import { studioDate, studioLabels, studioMoney, studioStatusLabels } from '../client/studioPresentation';
import { StudioPaymentRequestCard } from './StudioPaymentRequestCard';
import { StudioSubscriptionManagement } from './StudioSubscriptionManagement';

export function StudioManagedWorkspace({ actorId, clientId }: { actorId: string; clientId: string }) {
  const queryClient = useQueryClient(); const [params, setParams] = useSearchParams(); const tab = ['billing', 'new', 'orders'].includes(params.get('tab') ?? '') ? params.get('tab')! : 'billing';
  const scope = studioManagedScope(actorId, clientId); const actionScope = studioManagedActionScope(actorId, clientId);
  const accountQuery = useStudioAccount(clientId); const account = isStudioManagedAccount(accountQuery.data) ? accountQuery.data : undefined;
  const catalog = useQuery({ queryKey: [...scope, 'catalog'], queryFn: ({ signal }) => listingStudioStaff.catalog(clientId, signal), staleTime: 60000 });
  const [orderPage, setOrderPage] = useState(1); const [requestPage, setRequestPage] = useState(1);
  const orders = useQuery({ queryKey: [...scope, 'orders', orderPage], queryFn: ({ signal }) => listingStudioStaff.orders(clientId, orderPage, signal), enabled: tab === 'orders', refetchInterval: tab === 'orders' ? 15000 : false });
  const requests = useQuery({ queryKey: [...scope, 'requests', requestPage], queryFn: ({ signal }) => listingStudioStaff.requests(clientId, requestPage, signal), enabled: tab === 'billing', refetchInterval: tab === 'billing' ? 15000 : false });
  useStudioOrderBalanceRefresh(actorId, orders.data?.orders, clientId);
  const [latest, setLatest] = useState<StudioBillingRequest | null>(null); const [selectedPlan, setSelectedPlan] = useState<StudioPlan | null>(null);
  const [completedPlanRequest, setCompletedPlanRequest] = useState<StudioBillingRequest | null>(null);
  const latestQuery = useQuery({ queryKey: [...scope, 'request', latest?.id], queryFn: ({ signal }) => listingStudioStaff.request(clientId, latest!.id, signal), enabled: Boolean(latest), refetchInterval: latest ? 15000 : false });
  const currentRequest = latestQuery.data ?? latest;
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [error, setError] = useState('');
  const [pendingRequest, setPendingRequest] = useState<StudioBillingRequestInput | null>(null);
  const editApi = useMemo(() => ({ upload: (file: File, key: string) => listingStudioStaff.upload(clientId, file, key), quote: (input: Parameters<typeof listingStudioStaff.quote>[1]) => listingStudioStaff.quote(clientId, input), createOrder: (quoteId: string, method: Parameters<typeof listingStudioStaff.createOrder>[2], key: string) => listingStudioStaff.createOrder(clientId, quoteId, method, key) }), [clientId]);
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: scope }); };
  const changeTab = (value: string) => setParams(current => { const next = new URLSearchParams(current); next.set('tab', value); return next; });
  const requestPayment = async (input: StudioBillingRequestInput, replaceCompletedPlan = false) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setPendingRequest(input);
    try {
      const action = input.kind + ':' + ('orderId' in input ? input.orderId : input.planCode);
      let result = await listingStudioStaff.createRequest(clientId, input, studioActionKey(actionScope, 'billing-request:' + action));
      if (replaceCompletedPlan && input.kind === 'subscription_purchase' && result.request.status === 'completed' && account?.capabilities.canSubscribe) {
        // Resolve the current key first: an older history card must never retire a newer active or uncertain request.
        forgetStudioAction(actionScope, 'billing-request:' + action);
        result = await listingStudioStaff.createRequest(clientId, input, studioActionKey(actionScope, 'billing-request:' + action));
      }
      setLatest(result.request); setPendingRequest(null); setSelectedPlan(null); changeTab('billing'); refresh();
    } catch (failure) { setError(normalizeApiError(failure).message); } finally { lock.current = false; setBusy(false); }
  };
  const created = (order: StudioOrder) => { refresh(); if (order.funding.method === 'card' && order.funding.status === 'pending') void requestPayment({ kind: 'order_payment', orderId: order.id }); else changeTab('orders'); };
  const changedRequest = (request: StudioBillingRequest) => { if (latest?.id === request.id) { setLatest(request); queryClient.setQueryData([...scope, 'request', request.id], request); } refresh(); };
  const renewRequest = (request: StudioBillingRequest) => {
    if (!account?.management.canPurchase || lock.current) return;
    if (request.status === 'completed') {
      if (request.kind !== 'subscription_purchase' || !account.capabilities.canSubscribe || !catalog.data?.checkoutAvailable) return;
      const plan = catalog.data.plans.find(plan => plan.code === request.planCode);
      if (!plan) return;
      setCompletedPlanRequest(request); setSelectedPlan(plan);
      return;
    }
    if (!['expired', 'cancelled'].includes(request.status)) return;
    const input: StudioBillingRequestInput | null = request.kind === 'order_payment' ? request.orderId ? { kind: request.kind, orderId: request.orderId } : null : request.planCode ? { kind: request.kind, planCode: request.planCode } : null;
    if (!input) return;
    forgetStudioAction(actionScope, 'billing-request:' + input.kind + ':' + ('orderId' in input ? input.orderId : input.planCode));
    void requestPayment(input);
  };
  const confirmPlanRequest = () => {
    if (!selectedPlan || lock.current || !account?.management.canPurchase || !catalog.data?.checkoutAvailable) return;
    if (completedPlanRequest) {
      if (!account.capabilities.canSubscribe || completedPlanRequest.planCode !== selectedPlan.code) return;
    }
    const replaceCompletedPlan = Boolean(completedPlanRequest);
    setCompletedPlanRequest(null);
    const current = account.capabilities.canSubscribe ? undefined : catalog.data.plans.find(plan => plan.code === account.subscription?.planCode);
    void requestPayment({ kind: current && selectedPlan.monthlyPriceCents > current.monthlyPriceCents ? 'subscription_upgrade' : 'subscription_purchase', planCode: selectedPlan.code }, replaceCompletedPlan);
  };
  if (accountQuery.isPending || catalog.isPending) return <p role="status" className="p-6">Loading this client’s Studio…</p>;
  if (!account || !catalog.data || account.client.id !== clientId) return <div role="alert" className="space-y-3 p-6"><h1 className="text-xl font-semibold">Client workspace unavailable</h1><p className="text-sm text-muted-foreground">The client may be inactive, or you may no longer have access.</p><Button variant="outline" onClick={refresh}>Try again</Button><Button asChild variant="ghost"><Link to="/listing-studio/manage?tab=clients">Choose a client</Link></Button></div>;
  const currentPlan = account.capabilities.canSubscribe ? undefined : catalog.data.plans.find(plan => plan.code === account.subscription?.planCode);
  const chosenUpgrade = Boolean(selectedPlan && currentPlan && selectedPlan.monthlyPriceCents > currentPlan.monthlyPriceCents);
  const planFooterNote = (plan: StudioPlan) => {
    if (currentPlan?.code === plan.code) return 'Current plan';
    if (currentPlan && plan.monthlyPriceCents < currentPlan.monthlyPriceCents) return account.management.canManageSubscription ? 'Manage lower plans in subscription controls' : 'A superadmin can schedule a lower plan';
    if (!account.management.canPurchase || !catalog.data?.checkoutAvailable) return 'Purchases currently unavailable';
    if (currentPlan && !account.management.canManageSubscription) return 'A superadmin can request an upgrade';
    return undefined;
  };
  return <div className="w-full min-w-0 space-y-5 p-1 sm:p-3 lg:p-5">
    <header className="space-y-4">
      <Link to="/listing-studio/manage" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />Listing Studio<span className="text-muted-foreground/40">/</span>Client account</Link>
      <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">{account.client.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{account.client.name}</h1><p className="mt-1 break-all text-xs text-muted-foreground">{account.client.email}</p></div></div><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to="/listing-studio/manage?tab=clients">Change client</Link></Button><Button size="sm" variant="ghost" aria-label="Refresh client account" onClick={refresh}><RefreshCw aria-hidden="true" className="h-4 w-4" /></Button><Button size="sm" disabled={!account.management.canPurchase || !account.capabilities.canCreateOrder} onClick={() => changeTab('new')}><ImagePlus aria-hidden="true" className="mr-2 h-4 w-4" />New photo edit</Button></div></div>
    </header>
    {account.notice && <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6">{account.notice}</p>}
    <section aria-label="Client editing credit" className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card lg:grid-cols-4">
      <div className="col-span-2 border-b bg-primary/[0.035] p-4 sm:p-5 lg:col-span-1 lg:border-b-0 lg:border-r"><p className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Wallet aria-hidden="true" className="h-3.5 w-3.5" />Available credit</p><p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{studioMoney(account.credits.availableCents)}</p><p className="mt-1 text-[11px] text-muted-foreground">{account.credits.expiresAt ? 'Expires ' + studioDate(account.credits.expiresAt) : 'Ready for a plan or individual edits'}</p></div>
      <div className="border-b border-r p-4 sm:p-5 lg:border-b-0"><p className="text-xs text-muted-foreground">Reserved for edits</p><p className="mt-2 text-2xl font-semibold tabular-nums">{studioMoney(account.credits.reservedCents)}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Held until editing completes</p></div>
      <div className="border-b p-4 sm:p-5 lg:border-b-0 lg:border-r"><p className="text-xs text-muted-foreground">Used this period</p><p className="mt-2 text-2xl font-semibold tabular-nums">{studioMoney(account.credits.usedCents)}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Completed edits only</p></div>
      <div className="col-span-2 p-4 sm:p-5 lg:col-span-1"><p className="text-xs text-muted-foreground">Current plan</p><p className="mt-2 text-xl font-semibold">{currentPlan?.name ?? 'No active plan'}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{currentPlan ? studioMoney(currentPlan.monthlyPriceCents) + ' / month' : 'Pay per photo or add monthly credit'}</p></div>
    </section>
    {error && <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4"><p className="text-sm text-destructive">{error}</p>{pendingRequest && <Button variant="outline" disabled={busy} onClick={() => void requestPayment(pendingRequest)}>Retry same payment request</Button>}</div>}
    <Tabs value={tab} onValueChange={changeTab}>
      <div className="border-b pb-4"><TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-muted/60 p-1 sm:inline-flex sm:w-auto"><TabsTrigger className="rounded-lg px-3 text-xs sm:px-5 sm:text-sm" value="billing">Credit & plan</TabsTrigger><TabsTrigger className="rounded-lg px-3 text-xs sm:px-5 sm:text-sm" value="new">New photo edit</TabsTrigger><TabsTrigger className="rounded-lg px-3 text-xs sm:px-5 sm:text-sm" value="orders">Your purchases</TabsTrigger></TabsList></div>
      <TabsContent value="billing" className="space-y-7 pt-5">
        <section aria-labelledby="client-monthly-plans" className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 id="client-monthly-plans" className="text-lg font-semibold tracking-tight">Monthly plans</h2><p className="mt-1 text-sm text-muted-foreground">Prepare a review link. {account.client.name} approves any card payment.</p></div><span className="text-xs text-muted-foreground">USD · billed monthly</span></div><StudioPlanCards plans={catalog.data.plans} currentPlanCode={currentPlan?.code} busy={busy} footerNote={planFooterNote} canSelect={plan => account.management.canPurchase && catalog.data!.checkoutAvailable && (account.capabilities.canSubscribe || Boolean(currentPlan && plan.monthlyPriceCents > currentPlan.monthlyPriceCents && account.management.canManageSubscription))} actionLabel={plan => currentPlan && plan.monthlyPriceCents > currentPlan.monthlyPriceCents ? 'Request upgrade payment' : 'Create payment request'} onSelect={plan => { setCompletedPlanRequest(null); setSelectedPlan(plan); }} /><p className="text-xs leading-5 text-muted-foreground">Unused editing credit expires at period end. No rollover. Sharing a review link does not send an email or collect a payment.</p></section>
        {(account.management.canManageSubscription || account.management.subscription?.pendingChange) && <StudioSubscriptionManagement actorId={actorId} clientId={clientId} account={account} plans={catalog.data.plans} onChanged={refresh} />}
        <StudioServicePricing catalog={catalog.data} />
        <section className="space-y-4 border-t pt-6"><div><h2 className="text-lg font-semibold tracking-tight">Payment requests you created</h2><p className="mt-1 text-sm text-muted-foreground">Track client approval and share an existing review link.</p></div><div className="grid gap-4 xl:grid-cols-2">{currentRequest && <StudioPaymentRequestCard key={currentRequest.id} actorId={actorId} clientId={clientId} request={currentRequest} onChanged={changedRequest} onRefresh={refresh} onNewRequest={account.management.canPurchase ? renewRequest : undefined} canReplaceCompletedPlan={account.capabilities.canSubscribe && catalog.data.checkoutAvailable} />}{requests.data?.requests.filter(request => request.id !== latest?.id).map(request => <StudioPaymentRequestCard key={request.id} actorId={actorId} clientId={clientId} request={request} onChanged={changedRequest} onRefresh={refresh} onNewRequest={account.management.canPurchase ? renewRequest : undefined} canReplaceCompletedPlan={account.capabilities.canSubscribe && catalog.data.checkoutAvailable} />)}</div>{requests.isPending && <p role="status" className="py-6 text-sm text-muted-foreground">Loading payment requests…</p>}{requests.isError && <div role="alert" className="space-y-2"><p className="text-sm">Payment requests could not be loaded.</p><Button variant="outline" onClick={() => void requests.refetch()}>Try again</Button></div>}{requests.data?.requests.length === 0 && !latest && <div className="flex items-center gap-3 rounded-2xl border border-dashed p-6"><Receipt aria-hidden="true" className="h-6 w-6 shrink-0 text-muted-foreground/60" /><div><p className="text-sm font-medium">No payment requests yet.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Choose a plan or create a photo order to prepare the first request.</p></div></div>}{requests.data && (requestPage > 1 || requests.data.pagination.hasMore) && <nav aria-label="Payment request pages" className="flex justify-between"><Button variant="outline" disabled={requestPage === 1 || requests.isFetching} onClick={() => setRequestPage(page => page - 1)}>Previous requests</Button><Button variant="outline" disabled={!requests.data.pagination.hasMore || requests.isFetching} onClick={() => setRequestPage(page => page + 1)}>Next requests</Button></nav>}</section>
      </TabsContent>
      <TabsContent value="new" className="pt-5"><StudioNewEdit accountId={actionScope} account={{ ...account, capabilities: { ...account.capabilities, canCreateOrder: account.capabilities.canCreateOrder && account.management.canPurchase } }} catalog={catalog.data} api={editApi} forClient={{ name: account.client.name }} onCreated={created} onCancelRevision={() => {}} /></TabsContent>
      <TabsContent value="orders" className="space-y-4 pt-5"><div><h2 className="text-lg font-semibold tracking-tight">Purchases you initiated for this client</h2><p className="mt-1 text-sm text-muted-foreground">This list includes your purchases. The client’s other private photos are not shown.</p></div>{orders.isPending && <p role="status" className="py-6 text-sm text-muted-foreground">Loading purchases…</p>}{orders.isError && <div role="alert" className="space-y-2"><p>Purchases could not be loaded.</p><Button variant="outline" onClick={() => void orders.refetch()}>Try again</Button></div>}<div className="divide-y overflow-hidden rounded-2xl border bg-card">{orders.data?.orders.map(order => <article key={order.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><ImagePlus className="h-4 w-4 text-muted-foreground" /></span><div><h3 className="text-sm font-semibold">{studioLabels[order.service]}</h3><p className="mt-1 text-xs text-muted-foreground">{studioDate(order.createdAt)} · {order.funding.status.replaceAll('_', ' ')}</p></div></div><div className="flex items-center gap-4"><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">{studioStatusLabels[order.item.status]}</span><p className="text-base font-semibold tabular-nums">{studioMoney(order.pricing.totalPriceCents)}</p></div></div>{order.item.error && <p className="mt-3 text-sm text-muted-foreground">{order.item.error.message}</p>}{order.actions.canRequestPayment && <Button className="mt-3" size="sm" variant="outline" disabled={busy || !account.management.canPurchase} onClick={() => void requestPayment({ kind: 'order_payment', orderId: order.id })}>Create or recover payment request<ArrowRight aria-hidden="true" className="ml-2 h-3.5 w-3.5" /></Button>}</article>)}{orders.data?.orders.length === 0 && <div className="flex items-center gap-3 p-6"><Receipt aria-hidden="true" className="h-6 w-6 shrink-0 text-muted-foreground/60" /><p className="text-sm text-muted-foreground">You have not created any purchases for this client.</p></div>}</div>{orders.data && (orderPage > 1 || orders.data.pagination.hasMore) && <nav aria-label="Purchase pages" className="flex justify-between"><Button variant="outline" disabled={orderPage === 1 || orders.isFetching} onClick={() => setOrderPage(page => page - 1)}>Previous purchases</Button><Button variant="outline" disabled={!orders.data.pagination.hasMore || orders.isFetching} onClick={() => setOrderPage(page => page + 1)}>Next purchases</Button></nav>}</TabsContent>
    </Tabs>
    <Dialog open={Boolean(selectedPlan)} onOpenChange={open => { if (!busy) { if (!open) { setSelectedPlan(null); setCompletedPlanRequest(null); } } }}><DialogContent><DialogHeader><DialogTitle>{completedPlanRequest ? 'Create a new plan request' : chosenUpgrade ? 'Request a plan upgrade' : 'Prepare a client payment request'}</DialogTitle><DialogDescription>For {account.client.name} · {account.client.email}</DialogDescription></DialogHeader>{selectedPlan && <>{completedPlanRequest && <p className="text-sm leading-6">The earlier request is complete. Review the current plan below to prepare a new request for the client to approve.</p>}<p className="font-semibold">{selectedPlan.name} · {studioMoney(selectedPlan.monthlyPriceCents)} / month</p><p className="text-sm leading-6 text-muted-foreground">{chosenUpgrade ? 'The client will review the current prorated charge before approving the upgrade.' : 'The client must sign in, approve this recurring subscription, and complete secure payment.'} This creates a 24-hour review link. Email is sent only when you choose Send to registered email.</p><DialogFooter><Button variant="outline" disabled={busy} onClick={() => { setSelectedPlan(null); setCompletedPlanRequest(null); }}>Back</Button><Button disabled={busy} onClick={confirmPlanRequest}>{busy ? 'Creating request…' : 'Create review link'}</Button></DialogFooter>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</>}</DialogContent></Dialog>
  </div>;
}
