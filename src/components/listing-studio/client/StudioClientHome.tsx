import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, ImagePlus, Loader2, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listingStudioClient } from '@/services/listingStudioClientService';
import { useStudioOrderBalanceRefresh } from '@/hooks/useStudioOrderBalanceRefresh';
import type { StudioCatalog, StudioService } from '@/types/listingStudioClient';
import { StudioOrderCard } from './StudioOrderCard';
import { studioIsActive, studioLabels, studioMoney } from './studioPresentation';

const studioPresetImages: Record<StudioService, string> = {
  staging: '/studio-assets/listing-studio/staging.png', decluttering: '/studio-assets/listing-studio/declutter.png',
  grass: '/studio-assets/listing-studio/grass.png', twilight: '/studio-assets/listing-studio/twilight.png',
};

export function StudioClientHome({ accountId, name, catalog, onFile, onHistory, onOrder }: {
  accountId: string; name: string; catalog: StudioCatalog; onFile: (file: File, service: StudioService) => void;
  onHistory: () => void; onOrder: (id: string) => void;
}) {
  const [service, setService] = useState<StudioService>('staging'); const input = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('All edits'); const [error, setError] = useState('');
  const orders = useQuery({ queryKey: ['studio-client', accountId, 'orders', 1], queryFn: () => listingStudioClient.orders(1), refetchInterval: query => query.state.data?.orders.some(order => studioIsActive(order.item.status) || order.aiRevisions?.active) ? 10000 : false });
  useStudioOrderBalanceRefresh(accountId, orders.data?.orders);
  const services = catalog.services.filter(item => Object.hasOwn(studioPresetImages, item.id));
  const choose = (chosen = service) => { setService(chosen); input.current?.click(); };
  const recentIndex = (id: StudioService) => { const index = orders.data?.orders.findIndex(order => order.service === id) ?? -1; return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
  const presets = [...services].sort((a, b) => filter === 'Most used'
    ? (orders.data?.orders.filter(o => o.service === b.id).length ?? 0) - (orders.data?.orders.filter(o => o.service === a.id).length ?? 0)
    : filter === 'Recent' ? recentIndex(a.id) - recentIndex(b.id) : 0);
  return <div className="space-y-8">
    <h1 className="pb-1 text-center text-xl font-normal tracking-tight sm:text-[28px]">Hey {name}! what are we editing today?</h1>
    <input ref={input} type="file" className="sr-only" aria-label="Upload your listing photo" accept={catalog.uploadConstraints.mimeTypes.join(',')} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      if (!file.size || !catalog.uploadConstraints.mimeTypes.includes(file.type) || file.size > catalog.uploadConstraints.maxFileBytes) { setError('Choose one JPEG, PNG or WebP photo up to 10 MiB.'); return; }
      setError(''); onFile(file, service);
    }} />
    <section className="rounded-[26px] border bg-card/80 p-4 sm:p-6" aria-label="Start a photo edit" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (!file || event.dataTransfer.files.length !== 1 || !file.size || !catalog.uploadConstraints.mimeTypes.includes(file.type) || file.size > catalog.uploadConstraints.maxFileBytes) { setError('Choose one JPEG, PNG or WebP photo up to 10 MiB.'); return; } setError(''); onFile(file, service); }}>
      <button type="button" className="mb-6 block w-full rounded-xl pb-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => choose()}><span className="block text-base leading-relaxed text-muted-foreground sm:text-xl">Upload a photo, then choose the edit for your listing…</span><span className="mt-3 block text-[11px] text-muted-foreground">JPEG, PNG or WebP · Up to 10 MiB · One photo per edit</span></button>
      <div className="flex items-center gap-2 sm:gap-3"><Button variant="outline" className="h-14 justify-between gap-5 rounded-xl bg-muted/35 px-3" onClick={() => choose()}><span className="text-left"><span className="block text-sm">Upload photo</span><span className="mt-1 block text-[10px] font-normal text-muted-foreground">From your device</span></span><ChevronDown size={14} /></Button>
        <Select value={service} onValueChange={value => setService(value as StudioService)}><SelectTrigger className="h-14 w-auto min-w-0 gap-2 rounded-xl bg-muted/35 sm:min-w-52" aria-label="Editing preset"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Sparkles size={17} /></span><span className="truncate text-left text-xs sm:text-sm"><SelectValue /></span></SelectTrigger><SelectContent>{services.map(item => <SelectItem key={item.id} value={item.id}>{studioLabels[item.id]}</SelectItem>)}</SelectContent></Select>
        <Button variant="ghost" className="hidden gap-2 sm:inline-flex" onClick={() => choose()}><ImagePlus size={18} />Media</Button><Button className="ml-auto h-12 w-12 shrink-0 rounded-full" size="icon" aria-label="Choose a photo to continue" onClick={() => choose()}><ArrowRight size={21} /></Button></div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
    <section aria-label="Available photo edits"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-medium">Create for your listing</h2><div className="flex gap-1" aria-label="Preset order">{['All edits', 'Most used', 'Recent'].map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-[11px] ${filter === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{value}</button>)}</div></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-5">{presets.map(item => <button key={item.id} type="button" disabled={!item.aiAvailable} onClick={() => choose(item.id)} className="group relative aspect-[1.54] overflow-hidden rounded-2xl border border-border/50 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"><img src={studioPresetImages[item.id]} alt="" className="h-full w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" /><span className="absolute left-3 top-3 rounded-md bg-black/80 px-2 py-1 text-[10px] text-white">{studioMoney(item.aiPriceCents)} / photo</span><h3 className="absolute bottom-3 left-3 text-sm font-medium text-white">{studioLabels[item.id]}</h3>{!item.aiAvailable && <span className="absolute right-2 top-2 rounded bg-black/80 p-1 text-xs text-white">Unavailable</span>}</button>)}</div></section>
    <section aria-label="Recent edits"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-medium">Recent</h2><Button variant="link" size="sm" onClick={onHistory}>View all<ArrowRight className="ml-2 h-3.5 w-3.5" /></Button></div>
      {orders.isPending && <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading your recent edits…</p>}
      {orders.isError && <div role="alert" className="rounded-2xl border p-5 text-sm">Your recent edits could not be loaded.<Button variant="link" onClick={() => void orders.refetch()}>Try again</Button></div>}
      {orders.data?.orders.length === 0 && <div className="rounded-2xl border border-dashed px-6 py-8 text-center"><Upload className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><h3 className="text-sm font-medium">Your next listing starts here</h3><p className="mt-2 text-sm text-muted-foreground">Choose a photo and an edit. Your work will be saved here.</p><Button variant="outline" className="mt-4" onClick={() => choose()}>Choose a photo</Button></div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-5">{orders.data?.orders.slice(0, 4).map(order => <StudioOrderCard key={order.id} accountId={accountId} order={order} onSelect={() => onOrder(order.id)} />)}</div>
    </section>
  </div>;
}
