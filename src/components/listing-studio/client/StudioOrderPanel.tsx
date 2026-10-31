import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, Download, ImageIcon, Loader2, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizeApiError } from '@/services/apiError';
import { listingStudioClient } from '@/services/listingStudioClientService';
import type { StudioOrder } from '@/types/listingStudioClient';
import type { StudioRevisionSource } from './StudioNewEdit';
import { studioDate, studioIsActive, studioLabels, studioMoney, studioStatusLabels } from './studioPresentation';

function StudioOrderComparison({ accountId, order }: { accountId: string; order: StudioOrder }) {
  const [images, setImages] = useState<{ original?: string; result?: string }>({});
  const [error, setError] = useState('');
  const [position, setPosition] = useState(50);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); const urls: string[] = []; let canceled = false;
    setImages({}); setError('');
    const variants = (['original', 'result'] as const).filter(variant => variant === 'original' ? order.item.source.originalPreviewAvailable : order.item.previewAvailable);
    void Promise.allSettled(variants.map(async variant => {
      const blob = await listingStudioClient.preview(order.id, variant, abort.signal);
      if (canceled) return;
      const url = URL.createObjectURL(blob); urls.push(url); setImages(current => ({ ...current, [variant]: url }));
    })).then(results => { if (!canceled && results.some(result => result.status === 'rejected')) setError('A preview could not be loaded. Your saved photo is unchanged.'); });
    return () => { canceled = true; abort.abort(); urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [accountId, order.id, order.item.source.originalPreviewAvailable, order.item.previewAvailable, attempt]);

  if (!order.item.source.originalPreviewAvailable && !order.item.previewAvailable) return <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl bg-muted text-muted-foreground"><ImageIcon className="h-8 w-8" /><p className="text-sm">Your preview will appear here.</p></div>;
  return <div className="space-y-3">
    <div className="relative aspect-[3/2] overflow-hidden rounded-xl border bg-muted">
      {images.original ? <img src={images.original} alt="Photo before this edit" className="absolute inset-0 h-full w-full object-contain" /> : !images.result && <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading preview…</div>}
      {images.result && <img src={images.result} alt="Completed edited photo" className="absolute inset-0 h-full w-full object-contain" style={images.original ? { clipPath: `inset(0 0 0 ${position}%)` } : undefined} />}
      {images.original && images.result && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-white shadow" style={{ left: `${position}%` }} />}
    </div>
    {images.original && images.result && <div className="space-y-1"><div className="flex justify-between text-xs text-muted-foreground"><span>Before</span><span>Edited</span></div><input aria-label="Before and after photo comparison" type="range" min="0" max="100" value={position} onChange={event => setPosition(Number(event.target.value))} className="h-8 w-full accent-primary" /></div>}
    {error && <div role="alert" className="space-y-2 text-sm"><p>{error}</p><Button variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>Reload preview</Button></div>}
  </div>;
}

export function StudioOrderPanel({ accountId, orderId, onRevision, onCheckout, checkoutBusy }: {
  accountId: string; orderId: string; onRevision: (source: StudioRevisionSource) => void;
  onCheckout: (order: StudioOrder) => void; checkoutBusy: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['studio-client', accountId, 'order', orderId], queryFn: () => listingStudioClient.order(orderId),
    refetchInterval: query => query.state.data && studioIsActive(query.state.data.item.status) ? 8000 : false,
  });
  const [downloading, setDownloading] = useState(false); const [cancelling, setCancelling] = useState(false); const [error, setError] = useState(''); const downloadLock = useRef(false); const cancelLock = useRef(false);
  const order = query.data;
  if (query.isPending) return <p role="status" className="flex items-center gap-2 rounded-2xl border p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading your photo…</p>;
  if (!order) return <div role="alert" className="space-y-3 rounded-2xl border p-6"><p className="text-sm">This order could not be loaded.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>;
  const download = async () => {
    if (downloadLock.current) return; downloadLock.current = true; setDownloading(true); setError('');
    try { await listingStudioClient.download(order); } catch (failure) { setError(normalizeApiError(failure).message); }
    finally { downloadLock.current = false; setDownloading(false); }
  };
  const cancel = async () => {
    if (cancelLock.current) return; cancelLock.current = true; setCancelling(true); setError('');
    try {
      const saved = await listingStudioClient.cancelOrder(order.id);
      queryClient.setQueryData(['studio-client', accountId, 'order', order.id], saved);
      await queryClient.invalidateQueries({ queryKey: ['studio-client', accountId] });
    } catch (failure) { setError(normalizeApiError(failure).message); void query.refetch(); }
    finally { cancelLock.current = false; setCancelling(false); }
  };
  const isWorking = order.item.status === 'queued' || order.item.status === 'processing';
  const fundingCopy = order.funding.method === 'credits'
    ? order.funding.status === 'reserved' ? `${studioMoney(order.funding.reservedCreditCents)} credit reserved` : order.funding.status === 'settled' ? `${studioMoney(order.funding.capturedCreditCents)} credit used` : order.funding.status === 'released' ? 'Reserved credit released' : order.funding.status.replaceAll('_', ' ')
    : order.funding.status === 'settled' ? `${studioMoney(order.funding.paidAmountCents)} paid by card` : order.funding.status === 'refunded' ? `${studioMoney(order.funding.refundedAmountCents)} refunded` : order.funding.status === 'partially_refunded' ? `${studioMoney(order.funding.refundedAmountCents)} partially refunded` : order.funding.status.replaceAll('_', ' ');

  return <article className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{studioLabels[order.service]}{order.kind === 'human_revision' ? ' · Team revision' : ''}</h2><p className="mt-1 text-xs text-muted-foreground">{studioDate(order.createdAt)}</p></div><Button variant="ghost" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></header>
    <div role="status" className="flex items-center gap-2 text-sm">{isWorking ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : order.item.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}{studioStatusLabels[order.item.status]}</div>
    <StudioOrderComparison accountId={accountId} order={order} />
    {order.item.status === 'needs_attention' && <p className="rounded-xl bg-muted p-3 text-sm leading-6">We’re checking this existing edit. Its processing request is saved; starting another request is not needed.</p>}
    {order.item.error && <p role="alert" className="text-sm text-destructive">{order.item.error.message}</p>}
    {order.item.revisionFulfillment && order.item.status !== 'completed' && <p className="text-sm text-muted-foreground">Our team is handling this revision. {order.item.revisionFulfillment.status === 'assigned' ? 'An editor has been assigned.' : order.item.revisionFulfillment.status === 'in_progress' ? 'Your editor is working on it.' : 'Your request is in the team queue.'}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-muted-foreground capitalize">{fundingCopy}</p><p className="text-sm font-medium">Order total {studioMoney(order.pricing.totalPriceCents)}</p></div>
    <div className="flex flex-wrap gap-2">
      {order.actions.canCheckout && <Button disabled={checkoutBusy || cancelling} onClick={() => onCheckout(order)}><CreditCard className="mr-2 h-4 w-4" />{checkoutBusy ? 'Opening checkout…' : `Pay ${studioMoney(order.pricing.totalPriceCents)} securely`}</Button>}
      {order.actions.canCancel && <Button variant="outline" disabled={checkoutBusy || cancelling} onClick={() => void cancel()}>{cancelling ? 'Cancelling…' : 'Cancel unpaid order'}</Button>}
      {order.actions.canDownload && <Button disabled={downloading} onClick={() => void download()}><Download className="mr-2 h-4 w-4" />{downloading ? 'Downloading…' : 'Download full-size photo'}</Button>}
      {order.actions.canRequestRevision && <Button variant="outline" onClick={() => onRevision({ source: { kind: 'paid_item', id: order.item.id }, service: order.service })}><Users className="mr-2 h-4 w-4" />Request team revision</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </article>;
}
