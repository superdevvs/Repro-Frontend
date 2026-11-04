import { ImageIcon, Loader2 } from 'lucide-react';
import type { StudioOrder } from '@/types/listingStudioClient';
import { studioDate, studioLabels, studioStatusLabels } from './studioPresentation';
import { useStudioPreview } from './useStudioPreview';

export function StudioOrderCard({ accountId, order, onSelect }: { accountId: string; order: StudioOrder; onSelect: () => void }) {
  const result = order.item.previewAvailable;
  const revision = order.aiRevisions?.active;
  const status = revision ? revision.status === 'needs_attention' ? 'Recovering revision' : `AI revision ${revision.number}` : studioStatusLabels[order.item.status];
  const photo = useStudioPreview(accountId, order.id, result ? 'result' : 'original', result || order.item.source.originalPreviewAvailable, order.aiRevisions?.versions.length ?? 0);
  return <button type="button" onClick={onSelect} className="group min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <div className="relative aspect-[1.5] overflow-hidden bg-muted/40">
      {photo.url ? <img src={photo.url} alt={`${studioLabels[order.service]} preview`} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="h-7 w-7" /><span className="sr-only">{photo.failed ? 'Preview unavailable. Open project to retry.' : 'Photo preview'}</span></div>}
      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-black/80 px-2 py-1 text-[10px] font-medium text-white">{(['processing', 'queued'].includes(order.item.status) || revision && revision.status !== 'needs_attention') && <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />}{status}</span>
    </div>
    <div className="space-y-1 p-3"><h3 className="truncate text-sm font-medium">{studioLabels[order.service]}</h3><p className="truncate text-[11px] text-muted-foreground">{order.kind === 'human_revision' ? 'Team revision' : '1 photo'} · {studioDate(order.createdAt)}</p></div>
  </button>;
}
