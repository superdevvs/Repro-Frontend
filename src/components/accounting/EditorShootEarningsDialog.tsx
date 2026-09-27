import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { fetchShootMedia, type ShootMediaFile } from '@/services/shootMediaService';
import type { EditorEarningsLineItem } from '@/services/invoiceService';
import { resolveEditorEarning, type EditorRate } from './editorBillingWorkspaceUtils';
import { formatEditorCurrency as money, formatEditorTimestamp as timestamp } from './editorEarningsUtils';

interface Props { items: EditorEarningsLineItem[]; rates: EditorRate[]; open: boolean; onOpenChange: (open: boolean) => void }

export function EditorShootEarningsDialog({ items, rates, open, onOpenChange }: Props) {
  const [media, setMedia] = useState<ShootMediaFile[]>([]);
  const [mediaState, setMediaState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const shootId = items[0]?.shoot_id;
  useEffect(() => {
    if (!open || !shootId) return;
    let active = true;
    setMediaState('loading');
    setMedia([]);
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) { setMediaState('error'); return; }
    fetchShootMedia(String(shootId), 'edited', token).then((response) => {
      if (active) { setMedia(response.data || []); setMediaState('loaded'); }
    }).catch(() => { if (active) setMediaState('error'); });
    return () => { active = false; };
  }, [open, shootId]);
  const first = items[0];
  const activity = items.flatMap((item) => [
    ...(item.completed_at ? [{ id: `completed-${item.id}`, date: item.completed_at, label: `${item.service_name} completed` }] : []),
    ...(item.is_paid && item.paid_at ? [{ id: `paid-${item.id}`, date: item.paid_at, label: `${item.service_name} marked paid${item.paid_by?.name ? ` by ${item.paid_by.name}` : ''}` }] : []),
  ]).sort((a, b) => b.date.localeCompare(a.date));
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden p-0">
      <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12"><DialogTitle>{first?.shoot?.address || `Shoot #${shootId || ''}`}</DialogTitle><DialogDescription>{first?.client?.name || 'Client unavailable'} · Shoot #{shootId}</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-5 overflow-y-auto p-5">
        <section><h3 className="mb-3 text-sm font-semibold">Services &amp; earnings</h3><div className="space-y-3">{items.map((item) => { const effective = resolveEditorEarning(item, rates); return <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 border-b pb-3 text-xs"><div><p className="font-medium">{item.service_name}</p><p className="mt-1 text-muted-foreground">{item.quantity_snapshot} × {money(effective.rate)} · {timestamp(item.completed_at)}</p>{effective.isFallback && <p className="mt-1 text-amber-600 dark:text-amber-300">Current-rate estimate; no saved payout</p>}</div><div className="space-y-2 text-right"><strong>{money(effective.payout)}</strong><Badge className="ml-2 text-[10px]" variant="outline">{item.is_paid ? 'Paid' : 'Unpaid'}</Badge></div></div>; })}</div></section>
        <section><h3 className="mb-3 text-sm font-semibold">Edited media {media.length ? `(${media.length})` : ''}</h3>{mediaState === 'loading' ? <p className="text-xs text-muted-foreground">Loading edited media…</p> : mediaState === 'error' ? <p className="text-xs text-muted-foreground">Edited media could not be loaded.</p> : media.length ? <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">{media.map((file, index) => file.thumbnail_link ? <img key={String(file.id || index)} src={file.thumbnail_link} alt={`Edited photo ${index + 1}`} loading="lazy" className="aspect-video w-full rounded-md object-cover" /> : <div key={String(file.id || index)} className="flex aspect-video items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">Media {index + 1}</div>)}</div> : <p className="text-xs text-muted-foreground">No edited media is available yet.</p>}</section>
        <div className="grid gap-5 sm:grid-cols-2"><section><h3 className="mb-2 text-sm font-semibold">Notes</h3><p className="text-xs text-muted-foreground">No notes available.</p></section><section><h3 className="mb-2 text-sm font-semibold">Activity</h3>{activity.length ? <ol className="space-y-3 border-l pl-3">{activity.map((event) => <li key={event.id} className="text-xs"><p>{event.label}</p><p className="mt-1 text-muted-foreground">{timestamp(event.date)}</p></li>)}</ol> : <p className="text-xs text-muted-foreground">No activity recorded.</p>}</section></div>
      </div>
    </DialogContent>
  </Dialog>;
}
