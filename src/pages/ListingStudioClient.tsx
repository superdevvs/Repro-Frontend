import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StudioNewEdit, type StudioRevisionSource } from '@/components/listing-studio/client/StudioNewEdit';
import { StudioBilling, StudioCreditSummary } from '@/components/listing-studio/client/StudioBilling';
import { StudioPhotos } from '@/components/listing-studio/client/StudioPhotos';
import { studioLabels } from '@/components/listing-studio/client/studioPresentation';
import { LISTING_STUDIO_WEBSITE_URL } from '@/config/listingStudio';
import { forgetStudioAction, studioActionKey } from '@/lib/listingStudioPurchase';
import { normalizeApiError } from '@/services/apiError';
import { listingStudioClient, studioCheckoutUrl } from '@/services/listingStudioClientService';
import type { StudioOrder } from '@/types/listingStudioClient';

const tabs = ['photos', 'new', 'billing'];
const orderIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ListingStudioClient() {
  const { user, isImpersonating } = useAuth();
  if (user?.role !== 'client' || isImpersonating) return <div className="space-y-3 p-6"><h1 className="text-2xl font-semibold">Listing Studio</h1><p className="text-sm text-muted-foreground">Use your own client account to manage paid photo edits and billing.</p></div>;
  return <ClientWorkspace key={user.id} accountId={String(user.id)} />;
}

function ClientWorkspace({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient(); const [params, setParams] = useSearchParams();
  const activeTab = tabs.includes(params.get('tab') ?? '') ? params.get('tab')! : 'photos';
  const rawOrderId = params.get('order'); const selectedOrderId = rawOrderId && orderIdPattern.test(rawOrderId) ? rawOrderId : null;
  const [revision, setRevision] = useState<StudioRevisionSource | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false); const [error, setError] = useState(''); const [paymentNotice, setPaymentNotice] = useState(''); const checkoutLock = useRef(false);
  const account = useQuery({ queryKey: ['studio-client', accountId, 'account'], queryFn: listingStudioClient.account, refetchInterval: 30000 });
  const catalog = useQuery({ queryKey: ['studio-client', accountId, 'catalog'], queryFn: listingStudioClient.catalog, staleTime: 60000 });
  useEffect(() => {
    if (account.data?.subscription && ['active', 'trialing'].includes(account.data.subscription.status)) {
      try { forgetStudioAction(accountId, `subscription:${account.data.subscription.planCode}`); } catch { /* This cleanup does not affect a paid subscription. */ }
    }
  }, [accountId, account.data?.subscription]);
  const changeTab = (tab: string, orderId?: string) => {
    setParams(current => { const next = new URLSearchParams(current); next.set('tab', tab); if (orderId) next.set('order', orderId); return next; });
  };
  const beginRevision = (source: StudioRevisionSource) => { setRevision(source); changeTab('new'); };
  const checkout = async (order: StudioOrder) => {
    if (checkoutLock.current) return; checkoutLock.current = true; setCheckoutBusy(true); setError(''); setPaymentNotice('');
    try {
      const result = await listingStudioClient.checkout(order.id, studioActionKey(accountId, `checkout:${order.id}`));
      if (result.url) window.location.assign(studioCheckoutUrl(result.url));
      else {
        if (result.status === 'awaiting_webhook' || result.nextAction?.type === 'await_payment') setPaymentNotice('Your existing order is saved. Payment and editing updates will appear here; you do not need to create another order.');
        await queryClient.invalidateQueries({ queryKey: ['studio-client', accountId] });
      }
    } catch (failure) {
      const details = normalizeApiError(failure);
      const data = (failure as { response?: { data?: { data?: { retryWithNewKey?: boolean }; retryWithNewKey?: boolean } } }).response?.data;
      if (['checkout_expired', 'checkout_failed'].includes(details.code) && (data?.retryWithNewKey || data?.data?.retryWithNewKey)) forgetStudioAction(accountId, `checkout:${order.id}`);
      setError(details.message);
    } finally { checkoutLock.current = false; setCheckoutBusy(false); }
  };
  const created = (order: StudioOrder) => {
    setRevision(null); changeTab('photos', order.id);
    void queryClient.invalidateQueries({ queryKey: ['studio-client', accountId] });
    if (order.actions.canCheckout && order.funding.method === 'card') void checkout(order);
  };
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['studio-client', accountId] }); };

  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 pb-24 sm:p-6 lg:p-8">
    <PageHeader title="Listing Studio" description="Prepare your next listing. Your photos, editing credit and finished results in one place." compactTitleOnMobile action={<Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>} />
    {(account.isPending || catalog.isPending) && <p role="status" className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading your studio…</p>}
    {(account.isError || catalog.isError) && <div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 p-5"><p className="text-sm">Your studio could not be loaded. Your photos and credit are saved.</p><Button variant="outline" onClick={refresh}>Try again</Button></div>}
    {account.data && catalog.data && <>
      {account.data.notice && <p role="status" className="rounded-xl border bg-muted/50 p-4 text-sm leading-6">{account.data.notice}</p>}
      <StudioCreditSummary account={account.data} />
      <section className="space-y-3 rounded-2xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />Your free instant edits</h2><a className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline" href={LISTING_STUDIO_WEBSITE_URL} target="_blank" rel="noopener noreferrer">Open free trial<ArrowUpRight className="h-3.5 w-3.5" /></a></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{account.data.trialUsage.services.map(usage => <div key={usage.service} className="rounded-xl bg-muted/50 p-3"><p className="text-sm font-medium">{studioLabels[usage.service]}</p><p className="mt-1 text-xs text-muted-foreground">{usage.completed ? 'Free edit used' : usage.reserved ? 'Edit in progress' : `${usage.remaining} free edit remaining`}</p></div>)}</div><p className="text-xs leading-5 text-muted-foreground">One completed free edit per service. Instant trials and the three-photo team offer are separate from paid editing.</p></section>
      {error && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
      {paymentNotice && <p role="status" className="rounded-xl border bg-muted/50 p-4 text-sm">{paymentNotice}</p>}
      <Tabs value={activeTab} onValueChange={tab => changeTab(tab)}><TabsList className="mb-5 grid h-auto w-full grid-cols-3 sm:w-auto sm:min-w-96"><TabsTrigger value="photos" className="text-xs sm:text-sm">Your photos</TabsTrigger><TabsTrigger value="new" className="text-xs sm:text-sm">New edit</TabsTrigger><TabsTrigger value="billing" className="text-xs sm:text-sm">Credit & plan</TabsTrigger></TabsList>
        <TabsContent value="photos" className="m-0"><StudioPhotos accountId={accountId} catalog={catalog.data} selectedOrderId={selectedOrderId} onSelectOrder={id => changeTab('photos', id)} onRevision={beginRevision} onNewEdit={() => { setRevision(null); changeTab('new'); }} onCheckout={order => void checkout(order)} checkoutBusy={checkoutBusy} /></TabsContent>
        <TabsContent value="new" className="m-0"><StudioNewEdit key={revision ? `${revision.source.kind}:${revision.source.id}` : 'new'} accountId={accountId} account={account.data} catalog={catalog.data} revision={revision} onCancelRevision={() => setRevision(null)} onCreated={created} /></TabsContent>
        <TabsContent value="billing" className="m-0"><StudioBilling accountId={accountId} account={account.data} catalog={catalog.data} initialPlanCode={params.get('plan')} onPlanConsumed={() => setParams(current => { const next = new URLSearchParams(current); next.delete('plan'); return next; }, { replace: true })} /></TabsContent>
      </Tabs>
    </>}
  </div>;
}
