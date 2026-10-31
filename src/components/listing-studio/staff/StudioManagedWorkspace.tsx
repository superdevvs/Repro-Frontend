import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
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
import { StudioCreditSummary } from '../client/StudioBilling';
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
  if (!account || !catalog.data || account.client.id !== clientId) return <div role="alert" className="space-y-3 p-6"><h1 className="text-xl font-semibold">Client workspace unavailable</h1><p className="text-sm text-muted-foreground">The client may be inactive, or you may no longer have access.</p><Button variant="outline" onClick={refresh}>Try again</Button><Button asChild variant="ghost"><Link to="/listing-studio/manage">Choose a client</Link></Button></div>;
  const currentPlan = account.capabilities.canSubscribe ? undefined : catalog.data.plans.find(plan => plan.code === account.subscription?.planCode);
  const chosenUpgrade = Boolean(selectedPlan && currentPlan && selectedPlan.monthlyPriceCents > currentPlan.monthlyPriceCents);
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header className="space-y-4"><Link to="/listing-studio/manage" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Choose another client</Link><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Managing for client</p><h1 className="mt-1 text-2xl font-semibold">{account.client.name}</h1><p className="mt-1 break-all text-sm text-muted-foreground">{account.client.email}</p></div><Button variant="outline" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div><p className="text-sm leading-6 text-muted-foreground">Use this client’s available editing credit with confirmation, or prepare a payment request they approve from their own account.</p></header>
    {account.notice && <p role="status" className="rounded-xl border bg-muted/50 p-4 text-sm">{account.notice}</p>}
    <StudioCreditSummary account={account} />
    {error && <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4"><p className="text-sm text-destructive">{error}</p>{pendingRequest && <Button variant="outline" disabled={busy} onClick={() => void requestPayment(pendingRequest)}>Retry same payment request</Button>}</div>}
    <Tabs value={tab} onValueChange={changeTab}><TabsList className="grid h-auto w-full grid-cols-3 sm:w-auto"><TabsTrigger value="billing">Credit & plan</TabsTrigger><TabsTrigger value="new">New photo edit</TabsTrigger><TabsTrigger value="orders">Your purchases</TabsTrigger></TabsList>
      <TabsContent value="billing" className="space-y-6 pt-4">
        <div className="grid gap-4 md:grid-cols-3">{catalog.data.plans.map(plan => { const upgrade = Boolean(currentPlan && plan.monthlyPriceCents > currentPlan.monthlyPriceCents); const allowed = account.management.canPurchase && catalog.data!.checkoutAvailable && (account.capabilities.canSubscribe || (upgrade && account.management.canManageSubscription)); return <article key={plan.code} className="flex flex-col gap-4 rounded-2xl border bg-card p-5"><h2 className="font-semibold">{plan.name}{currentPlan?.code === plan.code ? ' · Current' : ''}</h2><p className="text-2xl font-semibold">{studioMoney(plan.monthlyPriceCents)}<span className="text-xs font-normal text-muted-foreground"> / month</span></p><p className="text-sm">{studioMoney(plan.monthlyCreditCents)} monthly editing credit</p><p className="flex-1 text-xs text-muted-foreground">Unused credit expires each period. No rollover.</p><Button variant="outline" disabled={!allowed || busy} onClick={() => { setCompletedPlanRequest(null); setSelectedPlan(plan); }}>{upgrade ? 'Request upgrade payment' : 'Create payment request'}</Button></article>; })}</div>
        {(account.management.canManageSubscription || account.management.subscription?.pendingChange) && <StudioSubscriptionManagement actorId={actorId} clientId={clientId} account={account} plans={catalog.data.plans} onChanged={refresh} />}
        <section className="space-y-4"><h2 className="text-lg font-semibold">Payment requests you created</h2>{currentRequest && <StudioPaymentRequestCard key={currentRequest.id} actorId={actorId} clientId={clientId} request={currentRequest} onChanged={changedRequest} onRefresh={refresh} onNewRequest={account.management.canPurchase ? renewRequest : undefined} canReplaceCompletedPlan={account.capabilities.canSubscribe && catalog.data.checkoutAvailable} />}{requests.isPending && <p role="status" className="text-sm">Loading payment requests…</p>}{requests.isError && <div role="alert"><p className="text-sm">Payment requests could not be loaded.</p><Button variant="outline" onClick={() => void requests.refetch()}>Try again</Button></div>}{requests.data?.requests.filter(request => request.id !== latest?.id).map(request => <StudioPaymentRequestCard key={request.id} actorId={actorId} clientId={clientId} request={request} onChanged={changedRequest} onRefresh={refresh} onNewRequest={account.management.canPurchase ? renewRequest : undefined} canReplaceCompletedPlan={account.capabilities.canSubscribe && catalog.data.checkoutAvailable} />)}{requests.data?.requests.length === 0 && !latest && <p className="text-sm text-muted-foreground">No payment requests yet.</p>}{requests.data && (requestPage > 1 || requests.data.pagination.hasMore) && <div className="flex justify-between"><Button variant="outline" disabled={requestPage === 1 || requests.isFetching} onClick={() => setRequestPage(page => page - 1)}>Previous requests</Button><Button variant="outline" disabled={!requests.data.pagination.hasMore || requests.isFetching} onClick={() => setRequestPage(page => page + 1)}>Next requests</Button></div>}</section>
      </TabsContent>
      <TabsContent value="new" className="pt-4"><StudioNewEdit accountId={actionScope} account={{ ...account, capabilities: { ...account.capabilities, canCreateOrder: account.capabilities.canCreateOrder && account.management.canPurchase } }} catalog={catalog.data} api={editApi} forClient={{ name: account.client.name }} onCreated={created} onCancelRevision={() => {}} /></TabsContent>
      <TabsContent value="orders" className="space-y-4 pt-4"><h2 className="text-lg font-semibold">Purchases you initiated for this client</h2><p className="text-sm text-muted-foreground">This list includes your purchases. The client’s other private photos are not shown.</p>{orders.isPending && <p role="status" className="text-sm">Loading purchases…</p>}{orders.isError && <div role="alert"><p>Purchases could not be loaded.</p><Button variant="outline" onClick={() => void orders.refetch()}>Try again</Button></div>}{orders.data?.orders.map(order => <article key={order.id} className="space-y-3 rounded-xl border bg-card p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-semibold">{studioLabels[order.service]}</h3><p className="text-sm">{studioMoney(order.pricing.totalPriceCents)}</p></div><p className="text-xs text-muted-foreground">{studioDate(order.createdAt)} · {studioStatusLabels[order.item.status]} · {order.funding.status.replaceAll('_', ' ')}</p>{order.item.error && <p className="text-sm text-muted-foreground">{order.item.error.message}</p>}{order.actions.canRequestPayment && <Button variant="outline" disabled={busy || !account.management.canPurchase} onClick={() => void requestPayment({ kind: 'order_payment', orderId: order.id })}>Create or recover payment request</Button>}</article>)}{orders.data?.orders.length === 0 && <p className="text-sm text-muted-foreground">You have not created any purchases for this client.</p>}{orders.data && (orderPage > 1 || orders.data.pagination.hasMore) && <div className="flex justify-between"><Button variant="outline" disabled={orderPage === 1 || orders.isFetching} onClick={() => setOrderPage(page => page - 1)}>Previous purchases</Button><Button variant="outline" disabled={!orders.data.pagination.hasMore || orders.isFetching} onClick={() => setOrderPage(page => page + 1)}>Next purchases</Button></div>}</TabsContent>
    </Tabs>
    <Dialog open={Boolean(selectedPlan)} onOpenChange={open => { if (!busy) { if (!open) { setSelectedPlan(null); setCompletedPlanRequest(null); } } }}><DialogContent><DialogHeader><DialogTitle>{completedPlanRequest ? 'Create a new plan request' : chosenUpgrade ? 'Request a plan upgrade' : 'Prepare a client payment request'}</DialogTitle><DialogDescription>For {account.client.name} · {account.client.email}</DialogDescription></DialogHeader>{selectedPlan && <>{completedPlanRequest && <p className="text-sm leading-6">The earlier request is complete. Review the current plan below to prepare a new request for the client to approve.</p>}<p className="font-semibold">{selectedPlan.name} · {studioMoney(selectedPlan.monthlyPriceCents)} / month</p><p className="text-sm leading-6 text-muted-foreground">{chosenUpgrade ? 'The client will review the current prorated charge before approving the upgrade.' : 'The client must sign in, approve this recurring subscription, and complete secure payment.'} This creates a 24-hour review link. Email is sent only when you choose Send to registered email.</p><DialogFooter><Button variant="outline" disabled={busy} onClick={() => { setSelectedPlan(null); setCompletedPlanRequest(null); }}>Back</Button><Button disabled={busy} onClick={confirmPlanRequest}>{busy ? 'Creating request…' : 'Create review link'}</Button></DialogFooter>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</>}</DialogContent></Dialog>
  </div>;
}
