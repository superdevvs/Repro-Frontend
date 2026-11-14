import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileArchive, RefreshCw } from 'lucide-react';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { GuestRequestError, type GuestFile, type GuestRequest } from './guestOverviewTypes';

type Archive = { id: string | number; status: 'preparing' | 'ready' | 'failed'; poll_after_ms?: number; download_url?: string; filename?: string; message?: string; requestKey?: string };
type Props = { open: boolean; onOpenChange: (open: boolean) => void; files: GuestFile[]; selectedIds: number[]; request: GuestRequest; onRefreshAccess: () => Promise<void> };

export function GuestDownloadDialog({ open, onOpenChange, files, selectedIds, request, onRefreshAccess }: Props) {
  const [size, setSize] = useState<'original' | 'small'>('original');
  const [scope, setScope] = useState<'selected' | 'all'>(selectedIds.length ? 'selected' : 'all');
  const [archive, setArchive] = useState<Archive | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const targets = scope === 'selected' ? files.filter(file => selectedIds.includes(file.id)) : files;
  const selectionKey = targets.map(file => `${file.id}:${file.download_url}:${file.mls_download_url ?? ''}`).join('|');
  const requestKey = `${size}:${scope}:${selectionKey}`;
  const selectionRef = useRef(requestKey); selectionRef.current = requestKey;
  const hasSelectionRef = useRef(selectedIds.length > 0); hasSelectionRef.current = selectedIds.length > 0;
  const visibleArchive = archive?.requestKey === requestKey ? archive : null;

  useEffect(() => {
    generation.current += 1; setArchive(null); setStarting(false); setError('');
    return () => { generation.current += 1; };
  }, [open, requestKey]);
  useEffect(() => { if (open) setScope(hasSelectionRef.current ? 'selected' : 'all'); }, [open]);

  const reportError = useCallback((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : 'Unable to prepare these files. Please try again.');
    if (reason instanceof GuestRequestError && [401, 403, 410].includes(reason.status)) void onRefreshAccess();
  }, [onRefreshAccess]);
  useEffect(() => {
    if (!open || archive?.status !== 'preparing') return;
    const version = generation.current;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const next = await request(`/downloads/${encodeURIComponent(String(archive.id))}`) as Archive;
        if (!cancelled && generation.current === version && selectionRef.current === archive.requestKey) { setArchive({ ...next, requestKey: archive.requestKey }); setError(next.status === 'failed' ? next.message || 'The download could not be prepared. Please try again.' : ''); }
      } catch (reason) {
        if (!cancelled && generation.current === version && selectionRef.current === archive.requestKey) { setArchive(null); reportError(reason); }
      }
    }, Math.max(1000, Math.min(10000, archive.poll_after_ms ?? 3000)));
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [archive, open, request, reportError]);

  const prepare = async () => {
    if (!targets.length || starting) return;
    const version = ++generation.current;
    const key = requestKey;
    setStarting(true); setError(''); setArchive(null);
    try {
      const next = await request('/downloads', { size, ...(scope === 'selected' ? { file_ids: targets.map(file => file.id) } : {}) }) as Archive;
      if (generation.current !== version || selectionRef.current !== key) return;
      setArchive({ ...next, requestKey: key }); if (next.status === 'failed') setError(next.message || 'The download could not be prepared. Please try again.');
    } catch (reason) { if (generation.current === version && selectionRef.current === key) reportError(reason); }
    finally { if (generation.current === version) setStarting(false); }
  };
  const preparing = starting || visibleArchive?.status === 'preparing';
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg">
    <DialogTitle>Download media</DialogTitle>
    <DialogDescription>Choose the files and size for your download.</DialogDescription>
    <div className="space-y-5">
      <fieldset className="space-y-2"><legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Files</legend>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm"><input type="radio" name="guest-download-scope" checked={scope === 'all'} onChange={() => setScope('all')} />All available media<span className="ml-auto text-xs text-muted-foreground">{files.length} files</span></label>
        <label className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${selectedIds.length ? 'cursor-pointer' : 'opacity-50'}`}><input type="radio" name="guest-download-scope" checked={scope === 'selected'} disabled={!selectedIds.length} onChange={() => setScope('selected')} />Selected media<span className="ml-auto text-xs text-muted-foreground">{selectedIds.length} files</span></label>
      </fieldset>
      <fieldset><legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Image size</legend>
        <div className="grid grid-cols-2 gap-2">{(['original', 'small'] as const).map(value => <label key={value} className={`cursor-pointer rounded-lg border p-3 text-sm ${size === value ? 'border-primary bg-primary/5' : ''}`}>
          <span className="flex items-center gap-2"><input type="radio" name="guest-download-size" aria-label={value === 'original' ? 'Full size' : 'MLS size'} checked={size === value} onChange={() => setSize(value)} /><span className="font-medium">{value === 'original' ? 'Full size' : 'MLS size'}</span></span>
          <span className="mt-1.5 block text-xs text-muted-foreground">{value === 'original' ? 'Original resolution' : 'Optimized for listings'}</span>
        </label>)}</div><p className="mt-2 text-xs text-muted-foreground">Videos and documents keep their original size.</p>
      </fieldset>
      {preparing && <div role="status" className="rounded-lg border bg-muted/30 p-4"><p className="flex items-center gap-2 text-sm"><InlineSpinner className="h-4 w-4" />Preparing {targets.length} files…</p><p className="mt-2 text-xs text-muted-foreground">Larger downloads may take a little longer. Keep this window open.</p><div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded bg-muted"><div className="h-full w-1/3 rounded bg-primary motion-safe:animate-pulse" /></div></div>}
      {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {visibleArchive?.status === 'ready' && visibleArchive.download_url ? <Button asChild className="w-full gap-2"><a href={visibleArchive.download_url}><Download className="h-4 w-4" />Download ZIP</a></Button>
        : <Button className="w-full gap-2" disabled={!targets.length || preparing} onClick={() => void prepare()}>{error ? <RefreshCw className="h-4 w-4" /> : <FileArchive className="h-4 w-4" />}{preparing ? 'Preparing download…' : error ? 'Try again' : `Prepare download (${targets.length})`}</Button>}
    </div>
  </DialogContent></Dialog>;
}
