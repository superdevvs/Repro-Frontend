import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadShootRawFiles, startSameWindowDownload } from '@/utils/shootMediaDownload';
import { chooseDownloadFile, ParallelDownload, supportsParallelDownload } from '@/utils/parallelDownload';
import type { MediaFile } from '@/hooks/useShootFiles';

export function ParallelRawDownload({ shootId, files, disabled }: { shootId: string | number; files: MediaFile[]; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'preparing' | 'ready' | 'running' | 'paused' | 'done'>('idle');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ bytes: 0, total: 0 });
  const session = useRef<ParallelDownload | null>(null);
  const preparing = useRef<AbortController | null>(null);
  const selected = useRef<Array<string | number>>([]);
  const busy = useRef(false);
  useEffect(() => () => { preparing.current?.abort(); session.current?.pause(); }, []);
  if (!supportsParallelDownload() || files.length === 0) return null;

  const getUrl = async () => {
    const controller = new AbortController(); preparing.current = controller;
    try {
      const result = await downloadShootRawFiles({ shootId, fileIds: selected.current, signal: controller.signal, startDownload: false });
      if (result.mode !== 'redirect') throw new Error('Use the standard download for this archive.');
      setUrl(result.url); return result.url;
    } finally { if (preparing.current === controller) preparing.current = null; }
  };
  const prepare = async () => {
    if (busy.current) return;
    busy.current = true; setOpen(true); setState('preparing'); setError('');
    selected.current = files.map(file => file.id);
    try { await getUrl(); setState('ready'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to prepare files.'); setState('idle'); }
    finally { busy.current = false; }
  };
  const run = async () => {
    if (busy.current) return;
    busy.current = true; setError('');
    try {
      // File picker must run directly from this click, before any network request.
      if (!session.current) {
        const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'raw-files.zip');
        const file = await chooseDownloadFile(name);
        session.current = new ParallelDownload(file, (bytes, total) => setProgress({ bytes, total }));
      }
      setState('preparing');
      const refreshed = await getUrl();
      setState('running');
      setState(await session.current.start(refreshed) ? 'done' : 'paused');
    } catch (failure) {
      if (!(failure instanceof DOMException && failure.name === 'AbortError')) setError(failure instanceof Error ? failure.message : 'Transfer interrupted. Resume to retry.');
      setState(session.current ? 'paused' : 'ready');
    } finally { busy.current = false; }
  };
  const close = () => {
    if (busy.current) return;
    session.current = null; setProgress({ bytes: 0, total: 0 }); setState('idle'); setUrl(''); setOpen(false);
  };
  return <>
    <Button variant="outline" size="sm" className="h-9 px-2 text-xs sm:h-8" disabled={disabled} onClick={() => void prepare()}>Parallel download</Button>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent className="sm:max-w-md" onEscapeKeyDown={event => { if (busy.current) event.preventDefault(); }} onPointerDownOutside={event => { if (busy.current) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Download original files</DialogTitle><DialogDescription>Use up to four connections. Keep this tab open to pause and resume. The standard browser download is also available.</DialogDescription></DialogHeader>
        {progress.total > 0 && <div className="space-y-2"><progress className="w-full" aria-label="Download progress" max={progress.total} value={progress.bytes} /><p className="text-sm text-muted-foreground">{(progress.bytes / 1024 ** 3).toFixed(2)} / {(progress.total / 1024 ** 3).toFixed(2)} GB</p></div>}
        <p role="status" className="text-sm">{state === 'preparing' ? 'Preparing your files…' : state === 'running' ? 'Downloading…' : state === 'paused' ? 'Paused. Resume to continue from saved parts.' : state === 'done' ? 'Download complete. Your file is saved.' : 'Choose where to save your ZIP.'}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {(state === 'ready' || state === 'paused') && <Button onClick={() => void run()}>{state === 'paused' ? 'Resume' : 'Save and download'}</Button>}
          {state === 'running' && <Button variant="outline" onClick={() => session.current?.pause()}>Pause</Button>}
          {state === 'preparing' && <Button variant="outline" onClick={() => preparing.current?.abort()}>Cancel</Button>}
          {url && !busy.current && state !== 'done' && <Button variant="outline" onClick={() => { startSameWindowDownload(url); close(); }}>Use browser download</Button>}
          {!busy.current && <Button variant="ghost" onClick={close}>Close</Button>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
