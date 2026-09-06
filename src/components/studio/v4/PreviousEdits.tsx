import { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Download, History, ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { autoenhanceService } from '@/services/autoenhanceService';
import { reelService } from '@/services/reelService';
import { listingVideoService } from '@/services/listingVideoService';
import { apiClient } from '@/services/api';
import { studioError } from '@/services/studioWorkspaceService';
import { buildShootStudioHref } from '@/components/studio/shootStudioDeepLink';
import { StudioImage } from './StudioImage';

type Kind = 'photos' | 'reels' | 'listing-videos';
interface PreviousEdit {
  id: number; title: string; status: string; date: string; shootId: number | null;
  thumbnail?: string | null; outputs: { label: string; url: string }[]; error?: string | null;
}
const kinds: { id: Kind; label: string }[] = [
  { id: 'photos', label: 'Photos' }, { id: 'reels', label: 'Reels' }, { id: 'listing-videos', label: 'Listing videos' },
];
const allowedRoles = ['admin', 'superadmin', 'editing_manager', 'editor'];

/** Read-only access to pre-V4 jobs. No legacy request runs until staff opens the section. */
export function PreviousEdits() {
  const { user, role } = useAuth();
  const contentId = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('photos');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [items, setItems] = useState<PreviousEdit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const allowed = allowedRoles.includes(role);

  useEffect(() => {
    if (!open || !allowed) return;
    let active = true;
    setBusy(true); setError(''); setItems([]);
    void (async () => {
      try {
        const params = { page, per_page: 20 };
        let rows: PreviousEdit[];
        let last: number;
        if (kind === 'photos') {
          const result = await autoenhanceService.listJobs(params);
          rows = result.data.map(job => {
            const output = job.output_file?.url || job.edited_image_url;
            return {
              id: job.id, title: job.shoot?.address || job.source_file?.filename || `Photo edit ${job.id}`,
              status: job.status, date: job.created_at, shootId: job.shoot_id,
              thumbnail: job.output_file?.thumb_url || job.source_file?.thumb_url || job.edited_image_url || job.original_image_url,
              outputs: output ? [{ label: job.output_file?.filename || 'Edited photo', url: output }] : [], error: job.error_message,
            };
          });
          last = result.meta?.last_page || 1;
        } else {
          const result = kind === 'reels' ? await reelService.listJobs(params) : await listingVideoService.listJobs(params);
          rows = result.data.map(job => ({
            id: job.id, title: job.shoot?.address || `${kind === 'reels' ? 'Reel' : 'Listing video'} ${job.id}`,
            status: job.status, date: job.created_at, shootId: job.shoot_id,
            thumbnail: job.selected_files?.[0]?.thumb_url, outputs: Object.values(job.outputs || {}).filter(output => Boolean(output.url)), error: job.error_message,
          }));
          last = result.meta?.last_page || 1;
        }
        if (active) { setItems(rows); setLastPage(last); }
      } catch (reason) { if (active) setError(studioError(reason)); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [open, allowed, user?.id, role, kind, page, refresh]);

  const download = async (url: string, label: string) => {
    setError('');
    try {
      const target = new URL(url, window.location.origin);
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('This output URL is unavailable.');
      const apiOrigin = new URL(apiClient.defaults.baseURL || '/api', window.location.origin);
      const localHosts = ['localhost', '127.0.0.1', '[::1]'];
      const protectedUrl = target.pathname.startsWith('/api/') && (target.origin === apiOrigin.origin
        || (localHosts.includes(target.hostname) && localHosts.includes(apiOrigin.hostname)));
      const href = protectedUrl
        ? URL.createObjectURL((await apiClient.get<Blob>(target.pathname.replace(/^\/api/, '') + target.search, { responseType: 'blob' })).data)
        : target.href;
      const anchor = document.createElement('a');
      anchor.href = href; anchor.download = label; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      if (protectedUrl) window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
    } catch (reason) { setError(studioError(reason)); }
  };

  if (!allowed) return null;
  return <section className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-card">
    <button type="button" className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen(value => !value)}>
      <History className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Previous edits</span><span className="block text-xs text-muted-foreground">Earlier photo edits, reels, and listing videos</span></span><ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div id={contentId} className="border-t p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2"><div className="flex flex-wrap gap-1" aria-label="Previous edit type">{kinds.map(item => <Button key={item.id} variant={kind === item.id ? 'secondary' : 'ghost'} className="min-h-11" aria-pressed={kind === item.id} onClick={() => { setKind(item.id); setPage(1); }}>{item.label}</Button>)}</div><Button variant="ghost" size="icon" className="ml-auto h-11 w-11" aria-label="Refresh previous edits" disabled={busy} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} /></Button></div>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      {busy ? <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading previous edits…</p> : !items.length && !error ? <p className="py-6 text-sm text-muted-foreground">No previous {kinds.find(item => item.id === kind)?.label.toLowerCase()} found.</p> : <div className="divide-y">{items.map(item => {
        const href = item.shootId ? buildShootStudioHref({ shootId: item.shootId, media: kind === 'photos' ? 'images' : 'videos', presetId: kind === 'photos' ? 'listing-ready' : 'walkthrough' }) : null;
        const date = new Date(item.date);
        return <article key={`${kind}-${item.id}`} className="flex flex-wrap items-center gap-3 py-4 first:pt-0">
          <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-muted/40">{item.thumbnail ? <StudioImage src={item.thumbnail} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto mt-5 h-6 w-6 text-muted-foreground" />}</div>
          <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-medium">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground"><span className="capitalize">{item.status.replace(/_/g, ' ')}</span>{!Number.isNaN(date.valueOf()) && ` · ${date.toLocaleDateString()}`}</p>{item.error && <p className="mt-1 text-xs text-destructive">{item.error}</p>}</div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">{item.outputs.map(output => <Button key={output.url} variant="outline" className="min-h-11" onClick={() => void download(output.url, output.label)}><Download size={14} />{output.label}</Button>)}{href && <Button asChild variant="ghost" className="min-h-11"><Link to={href}>Edit this shoot</Link></Button>}</div>
        </article>;
      })}</div>}
      {lastPage > 1 && <div className="mt-4 flex items-center justify-between gap-3"><Button variant="outline" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={15} />Previous</Button><span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span><Button variant="outline" disabled={busy || page >= lastPage} onClick={() => setPage(value => value + 1)}>Next<ChevronRight size={15} /></Button></div>}
    </div>}
  </section>;
}
