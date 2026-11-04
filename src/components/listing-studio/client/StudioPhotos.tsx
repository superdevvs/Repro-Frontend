import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStudioOrderBalanceRefresh } from '@/hooks/useStudioOrderBalanceRefresh';
import { Download, ImageIcon, Loader2, Plus, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listingStudioClient } from '@/services/listingStudioClientService';
import { downloadListingStudioTrial, getListingStudioTrials, type ListingStudioTrial } from '@/services/listingStudioTrials';
import { normalizeApiError } from '@/services/apiError';
import type { StudioCatalog, StudioOrder } from '@/types/listingStudioClient';
import type { StudioRevisionSource } from './StudioNewEdit';
import { StudioOrderPanel } from './StudioOrderPanel';
import { StudioOrderCard } from './StudioOrderCard';
import { studioDate, studioIsActive, studioLabels, studioStatusLabels } from './studioPresentation';

export function StudioPhotos({ accountId, catalog, selectedOrderId, onSelectOrder, onRevision, onNewEdit, onCheckout, checkoutBusy, onBack }: {
  accountId: string; catalog: StudioCatalog; selectedOrderId: string | null; onSelectOrder: (id: string) => void;
  onRevision: (source: StudioRevisionSource) => void; onNewEdit: () => void;
  onCheckout: (order: StudioOrder) => void; checkoutBusy: boolean;
  onBack: () => void;
}) {
  const [page, setPage] = useState(1); const [downloading, setDownloading] = useState<string | null>(null); const [error, setError] = useState('');
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all');
  const orders = useQuery({ queryKey: ['studio-client', accountId, 'orders', page], queryFn: () => listingStudioClient.orders(page), refetchInterval: query => query.state.data?.orders.some(order => studioIsActive(order.item.status) || order.aiRevisions?.active) ? 10000 : false });
  const trials = useQuery({ queryKey: ['studio-client', accountId, 'trials'], queryFn: getListingStudioTrials });
  useStudioOrderBalanceRefresh(accountId, orders.data?.orders);
  const downloadTrial = async (trial: ListingStudioTrial) => {
    if (downloading) return; setDownloading(trial.id); setError('');
    try { await downloadListingStudioTrial(trial); } catch (failure) { setError(normalizeApiError(failure).message); } finally { setDownloading(null); }
  };
  if (selectedOrderId) return <StudioOrderPanel key={selectedOrderId} accountId={accountId} orderId={selectedOrderId} onRevision={onRevision} onCheckout={onCheckout} checkoutBusy={checkoutBusy} presentation="canvas" onBack={onBack} onNewEdit={onNewEdit} catalog={catalog} />;
  const visible = orders.data?.orders.filter(order => (filter === 'all' || (filter === 'active' ? studioIsActive(order.item.status) || order.aiRevisions?.active : order.item.status === filter && !(filter === 'completed' && order.aiRevisions?.active))) && `${studioLabels[order.service]} ${studioStatusLabels[order.item.status]} ${order.aiRevisions?.active ? 'AI revision' : ''} ${studioDate(order.createdAt)}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold sm:text-[28px]">My edits</h1><p className="mt-3 text-sm text-muted-foreground">Your uploads, work in progress and finished photos, all in one place.</p></div><Button size="sm" onClick={onNewEdit}><Plus className="mr-2 h-4 w-4" />New edit</Button></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search your edits" placeholder="Search by service or status" value={search} onChange={event => setSearch(event.target.value)} className="h-11 rounded-xl pl-10" /></div><div className="flex flex-wrap gap-1" aria-label="Filter edits">{[['all', 'All edits'], ['completed', 'Ready'], ['active', 'In progress'], ['awaiting_funding', 'Awaiting payment']].map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-xs ${filter === value ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>{label}</button>)}</div></div>
    <div className={selectedOrderId ? 'grid items-start gap-5 xl:grid-cols-[minmax(260px,0.65fr)_1.35fr]' : ''}>
      <div className="space-y-4">
        {orders.isPending && <p role="status" className="flex items-center gap-2 rounded-2xl border p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading your projects…</p>}
        {orders.isError && <div role="alert" className="space-y-3 rounded-2xl border p-6 text-sm"><p>Your projects could not be loaded.</p><Button variant="outline" size="sm" onClick={() => void orders.refetch()}>Try again</Button></div>}
        {orders.data?.orders.length === 0 && <div className="space-y-3 rounded-2xl border border-dashed p-8 text-center"><ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="font-medium">Your next listing starts here</h3><p className="text-sm leading-6 text-muted-foreground">Create an edit to save its progress and finished photo in your workspace.</p><Button onClick={onNewEdit}>Choose a photo</Button></div>}
        {visible?.length === 0 && Boolean(orders.data?.orders.length) && <p role="status" className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No edits match this search on this page.</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-5">{visible?.map(order => <StudioOrderCard key={order.id} accountId={accountId} order={order} onSelect={() => onSelectOrder(order.id)} />)}</div>
        {orders.data && (page > 1 || orders.data.pagination.hasMore) && <nav aria-label="Project pages" className="flex items-center justify-between gap-3"><Button variant="outline" size="sm" disabled={page === 1 || orders.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="text-xs text-muted-foreground">Page {page}</span><Button variant="outline" size="sm" disabled={!orders.data.pagination.hasMore || orders.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></nav>}
      </div>
      {selectedOrderId && <StudioOrderPanel key={selectedOrderId} accountId={accountId} orderId={selectedOrderId} onRevision={onRevision} onCheckout={onCheckout} checkoutBusy={checkoutBusy} />}
    </div>
    <section className="space-y-4 border-t pt-6"><div><h2 className="text-lg font-semibold">Saved free edits</h2><p className="mt-1 text-sm text-muted-foreground">Instant trials you have saved to this account. They do not spend your subscription credit.</p></div>
      {trials.isPending && <p role="status" className="text-sm text-muted-foreground">Loading your free edits…</p>}
      {trials.isError && <div role="alert" className="space-y-2 text-sm"><p>Your saved trials could not be loaded.</p><Button variant="outline" size="sm" onClick={() => void trials.refetch()}>Try again</Button></div>}
      {trials.data?.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No free edits saved yet. Choose Download on your finished photo in Listing Studio to save it to this account.</p>}
      <div className="grid gap-3 sm:grid-cols-2">{trials.data?.map(trial => <article key={trial.id} className="space-y-4 rounded-2xl border bg-card p-5"><div><h3 className="font-medium">{studioLabels[trial.service]}</h3><p className="mt-1 text-xs text-muted-foreground">{trial.downloadAvailable ? 'Ready to download' : trial.status.replaceAll('_', ' ')} · {studioDate(trial.createdAt)}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" disabled={!trial.downloadAvailable || downloading !== null} onClick={() => void downloadTrial(trial)}><Download className="mr-2 h-4 w-4" />{downloading === trial.id ? 'Downloading…' : 'Download'}</Button>{trial.downloadAvailable && catalog.services.find(service => service.id === trial.service)?.revisionAvailable && <Button size="sm" variant="outline" onClick={() => onRevision({ source: { kind: 'claimed_trial', id: trial.id }, service: trial.service })}><Users className="mr-2 h-4 w-4" />Team revision</Button>}</div></article>)}</div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  </div>;
}
