import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { History, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StudioNewEdit, type StudioRevisionSource } from '@/components/listing-studio/client/StudioNewEdit';
import { StudioBilling } from '@/components/listing-studio/client/StudioBilling';
import { StudioPhotos } from '@/components/listing-studio/client/StudioPhotos';
import { StudioClientHome } from '@/components/listing-studio/client/StudioClientHome';
import { forgetStudioAction, readStudioPurchase, studioActionKey } from '@/lib/listingStudioPurchase';
import { normalizeApiError } from '@/services/apiError';
import { listingStudioClient, studioCheckoutUrl } from '@/services/listingStudioClientService';
import type { StudioOrder, StudioService } from '@/types/listingStudioClient';
import { useStudioAccount } from '@/hooks/useStudioAccount';
import '@/components/listing-studio/client/studioClient.css';

const tabs = ['photos', 'new', 'billing'];
const orderIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ListingStudioClient() {
  const { user, isImpersonating } = useAuth();
  if (user?.role !== 'client' || isImpersonating) return <div className="space-y-3 p-6"><h1 className="text-2xl font-semibold">Listing Studio</h1><p className="text-sm text-muted-foreground">Use your own client account to manage paid photo edits and billing.</p></div>;
  return <ClientWorkspace key={user.id} accountId={String(user.id)} />;
}

function ClientWorkspace({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient(); const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const activeTab = tabs.includes(params.get('tab') ?? '') ? params.get('tab')! : 'new';
  const rawOrderId = params.get('order'); const selectedOrderId = rawOrderId && orderIdPattern.test(rawOrderId) ? rawOrderId : null;
  const [revision, setRevision] = useState<StudioRevisionSource | null>(null);
  const [file, setFile] = useState<File | null>(null); const [service, setService] = useState<StudioService>('staging');
  const [recovering, setRecovering] = useState(() => Boolean(readStudioPurchase(accountId)));
  const [checkoutBusy, setCheckoutBusy] = useState(false); const [error, setError] = useState(''); const [paymentNotice, setPaymentNotice] = useState(''); const checkoutLock = useRef(false);
  const account = useStudioAccount();
  const catalog = useQuery({ queryKey: ['studio-client', accountId, 'catalog'], queryFn: listingStudioClient.catalog, staleTime: 60000 });
  useEffect(() => {
    if (account.data?.subscription && ['active', 'trialing'].includes(account.data.subscription.status)) {
      try { forgetStudioAction(accountId, `subscription:${account.data.subscription.planCode}`); } catch { /* This cleanup does not affect a paid subscription. */ }
    }
  }, [accountId, account.data?.subscription]);
  const changeTab = (tab: string, orderId?: string) => {
    setParams(current => { const next = new URLSearchParams(current); next.set('tab', tab); next.delete('edit'); if (orderId) next.set('order', orderId); else next.delete('order'); return next; });
  };
  useEffect(() => { const editing = activeTab === 'new' && Boolean(file) && !revision; if ((params.get('edit') === '1') !== editing) setParams(current => { const next = new URLSearchParams(current); if (editing) next.set('edit', '1'); else next.delete('edit'); return next; }, { replace: true }); }, [activeTab, file, revision, params, setParams]);
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
    setRevision(null); setFile(null); setRecovering(false); changeTab('photos', order.id);
    void queryClient.invalidateQueries({ queryKey: ['studio-client', accountId] });
    if (order.actions.canCheckout && order.funding.method === 'card') void checkout(order);
  };
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['studio-client', accountId] }); };

  const canvas = (activeTab === 'photos' && Boolean(selectedOrderId)) || (activeTab === 'new' && Boolean(file) && !revision);
  const newEdit = () => { setRevision(null); setFile(null); changeTab('new'); };
  return <div className={canvas ? 'studio-client-page flex min-h-0 flex-1 flex-col' : 'studio-client-page w-full min-w-0 space-y-6 px-1 pb-10 pt-5 sm:px-5 sm:pt-8 xl:px-9'}>
    {(account.isPending || catalog.isPending) && <p role="status" className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading your studio…</p>}
    {(account.isError || catalog.isError) && <div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 p-5"><p className="text-sm">Your studio could not be loaded. Your photos and credit are saved.</p><Button variant="outline" onClick={refresh}>Try again</Button></div>}
    {account.data && catalog.data && <>
      {account.data.notice && <p role="status" className="rounded-xl border bg-muted/50 p-4 text-sm leading-6">{account.data.notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
      {paymentNotice && <p role="status" className="rounded-xl border bg-muted/50 p-4 text-sm">{paymentNotice}</p>}
      <Tabs value={activeTab} onValueChange={tab => changeTab(tab)} className={canvas ? 'flex min-h-0 flex-1 flex-col' : ''}><div className={canvas ? 'hidden' : 'relative mb-9 flex justify-center'}><TabsList aria-label="Listing Studio" className="h-auto max-w-full rounded-full bg-muted/40 p-1"><TabsTrigger value="new" className="rounded-full px-4 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-6 sm:text-sm">Studio</TabsTrigger><TabsTrigger value="photos" className="rounded-full px-4 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-6 sm:text-sm">My edits</TabsTrigger><TabsTrigger value="billing" className="rounded-full px-4 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-6 sm:text-sm">Credits and plans</TabsTrigger></TabsList><Button variant="ghost" size="icon" className="absolute right-0 hidden rounded-full sm:inline-flex" aria-label="Editing history" onClick={() => changeTab('photos')}><History className="h-5 w-5" /></Button></div>
        <TabsContent value="photos" className={canvas ? 'm-0 flex min-h-0 flex-1 flex-col' : 'm-0'}><StudioPhotos accountId={accountId} catalog={catalog.data} selectedOrderId={selectedOrderId} onSelectOrder={id => changeTab('photos', id)} onBack={() => changeTab('photos')} onRevision={beginRevision} onNewEdit={newEdit} onCheckout={order => void checkout(order)} checkoutBusy={checkoutBusy} /></TabsContent>
        <TabsContent value="new" className={canvas ? 'm-0 flex min-h-0 flex-1 flex-col' : 'm-0'}>{file || revision || recovering ? <StudioNewEdit key={revision ? `${revision.source.kind}:${revision.source.id}` : file ? `${file.name}:${file.lastModified}` : 'recover'} accountId={accountId} account={account.data} catalog={catalog.data} revision={revision} presentation={canvas ? 'canvas' : 'default'} initialFile={file ?? undefined} initialService={service} onBack={() => { setFile(null); changeTab('photos'); }} onCancelRevision={newEdit} onCreated={created} /> : <StudioClientHome accountId={accountId} catalog={catalog.data} name={user?.name?.split(' ')[0] || 'there'} onFile={(photo, preset) => { setService(preset); setFile(photo); setParams(current => { const next = new URLSearchParams(current); next.set('tab', 'new'); next.set('edit', '1'); next.delete('order'); return next; }); }} onHistory={() => changeTab('photos')} onOrder={id => changeTab('photos', id)} />}</TabsContent>
        <TabsContent value="billing" className="m-0"><StudioBilling onNewEdit={newEdit} accountId={accountId} account={account.data} catalog={catalog.data} initialPlanCode={params.get('plan')} onPlanConsumed={() => setParams(current => { const next = new URLSearchParams(current); next.delete('plan'); return next; }, { replace: true })} /></TabsContent>
      </Tabs>
    </>}
  </div>;
}
