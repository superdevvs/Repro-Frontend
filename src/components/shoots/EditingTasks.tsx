import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { apiClient } from '@/services/api';
import { studioError } from '@/services/studioWorkspaceService';
import { openMediaVersions, type MediaVersion } from '@/services/mediaVersions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronRight } from 'lucide-react';

interface TaskItem {
  id: string; sources: { id: number; name: string; version: number }[]; lane: string; destination: string;
  workflow: string; status: string; return_url?: string; error?: string; returnedVersion?: MediaVersion;
}
interface Task { id: string; shoot_id: number; address: string; scope: string; instructions: string; status: string; error?: string; items: TaskItem[] }
export function EditingTasks() {
  const { role, user } = useAuth();
  const allowed = ['editor', 'editing_manager', 'admin', 'superadmin'].includes(role ?? '');
  const staff = role !== 'editor';
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [returns, setReturns] = useState<Record<string, { file: File; requestId: string }>>({});
  const operation = useRef(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!allowed) return;
    try {
      const { data } = await apiClient.get<{ data: Task[]; last_page: number }>(`/editing-tasks?page=${page}`, { signal });
      setTasks(data.data); setLastPage(data.last_page);
    } catch (e) { if (!signal?.aborted) setError(studioError(e)); }
  }, [allowed, page]);
  useEffect(() => { setTasks([]); setOpen(false); }, [role, user?.id]);
  useEffect(() => {
    if (!allowed || !open) return;
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => void load(controller.signal), 10000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [allowed, load, open]);
  const perform = async (id: string, fn: () => Promise<unknown>) => {
    if (operation.current) return;
    operation.current = true; setBusy(id); setError(null); setMessage('');
    try { await fn(); await load(); } catch (e) { setError(studioError(e)); } finally { operation.current = false; setBusy(null); setProgress(null); }
  };
  const upload = (item: TaskItem) => perform(item.id, async () => {
    const saved = returns[item.id]; if (!saved) return;
    const body = new FormData(); body.append('file', saved.file); body.append('request_id', saved.requestId);
    await apiClient.post(`/editing-tasks/${item.id}/upload`, body, { headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: event => setProgress(event.total ? Math.round(event.loaded * 100 / event.total) : null) });
    setReturns(previous => { const next = { ...previous }; delete next[item.id]; return next; });
    setMessage('Upload saved. Submit the task once processing finishes.');
  });
  const download = (item: TaskItem, source: TaskItem['sources'][number]) => perform(source.id.toString(), async () => {
    const response = await apiClient.get(`/editing-tasks/${item.id}/sources/${source.id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = source.name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  if (!allowed) return null;
  return <>
    <Button variant="outline" size="sm" className="mb-3 w-full shrink-0 justify-between" onClick={() => setOpen(true)}>Editing tasks<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="flex max-h-[90dvh] max-w-4xl flex-col">
      <DialogHeader><DialogTitle>Editing tasks</DialogTitle><DialogDescription>Exact media assignments, saved returns and progress for each request.</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-4 overflow-auto">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="text-sm">{message}</p>}
        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void load()}>Refresh tasks</Button>
        {!tasks.length && <p className="text-sm text-muted-foreground">No selected-media editing requests yet.</p>}
        {tasks.map(task => <section key={task.id} className="space-y-3 rounded-lg border p-4">
          <p className="font-medium">#{task.shoot_id} · {task.address} · {task.status}</p>
          <p className="text-sm">{task.scope === 'selected' ? 'Selected media only' : task.scope} · {task.instructions || 'No additional instructions.'}</p>
          {task.error && <p className="text-sm text-destructive">{task.error}</p>}
          {staff && task.status === 'needs_attention' && <Button size="sm" disabled={!!busy} onClick={() => void perform(task.id, () => apiClient.post(`/editing-dispatches/${task.id}/retry`))}>Retry saved AI request</Button>}
          {task.items.map(item => <article key={item.id} className="space-y-2 rounded border bg-muted/20 p-3">
            <p className="text-sm font-medium">{item.workflow} · {item.lane} → {item.destination === 'ai' ? 'AI' : 'Human editor'} · {item.status}</p>
            <ul className="space-y-1">{item.sources.map(source => <li key={source.id} className="flex items-center gap-2 text-sm"><span>{source.name} · v{source.version}</span>
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void download(item, source)}>Download source</Button></li>)}</ul>
            {(item.error || item.returnedVersion?.error) && <p className="text-sm text-destructive">{item.error || item.returnedVersion?.error}</p>}
            {staff && item.returnedVersion && <Button variant="outline" size="sm" onClick={() => {
              setOpen(false); openMediaVersions({ shootId: task.shoot_id, fileId: item.returnedVersion?.published_file_id ?? item.sources[0].id, name: item.sources[0].name });
            }}>Review returned edit / versions</Button>}
            {item.destination === 'human' && item.status !== 'completed' && <>
              {item.lane === 'photo' && ['assigned', 'failed'].includes(item.status) && <div className="flex flex-wrap items-center gap-2">
                <input type="file" aria-label={`Return edit for ${item.sources[0].name}`} accept=".jpg,.jpeg,.png,.tif,.tiff" disabled={!!busy} className="max-w-full text-xs" onChange={event => {
                  const file = event.target.files?.[0]; if (file) setReturns(previous => ({ ...previous, [item.id]: { file, requestId: crypto.randomUUID() } }));
                }} />
                <Button size="sm" disabled={!!busy || !returns[item.id]} onClick={() => void upload(item)}>{busy === item.id && progress !== null ? (progress === 100 ? 'Saving upload…' : `Uploading ${progress}%`) : 'Upload saved edit'}</Button>
              </div>}
              {item.lane === 'video' && <div className="flex flex-wrap gap-2"><input type="url" aria-label={`Finished video link for ${item.sources[0].name}`} className="min-w-0 flex-1 rounded border bg-background p-2 text-sm" placeholder="https://…" value={links[item.id] ?? item.return_url ?? ''} onChange={event => setLinks(previous => ({ ...previous, [item.id]: event.target.value }))} />
                <Button size="sm" disabled={!!busy || !(links[item.id] ?? item.return_url)} onClick={() => void perform(item.id, () => apiClient.post(`/editing-tasks/${item.id}/video`, { url: links[item.id] ?? item.return_url }))}>Save video link</Button></div>}
              <Button size="sm" disabled={!!busy || item.status !== 'returned'} onClick={() => void perform(item.id, async () => {
                await apiClient.post(`/editing-tasks/${item.id}/submit`); setMessage('Editing task submitted.');
              })}>Submit this task</Button>
            </>}
          </article>)}
        </section>)}
      </div>
      <div className="flex items-center justify-between"><Button variant="outline" disabled={page === 1 || !!busy} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="text-sm">Page {page} of {lastPage}</span><Button variant="outline" disabled={page === lastPage || !!busy} onClick={() => setPage(value => value + 1)}>Next</Button></div>
    </DialogContent></Dialog>
  </>;
}
