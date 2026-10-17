import { useEffect, useId, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Download, Upload, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/components/auth/AuthProvider';
import { apiClient, getApiHeaders } from '@/services/api';
import { API_BASE_URL } from '@/config/env';
import type { ShootData } from '@/types/shoots';
import { resolveUploadServiceTargets } from './mediaUploadUtils';
import { uploadMediaRequest } from './uploadMediaRequest';

type AdditionalFile = { id: number; filename: string; file_size: number; note?: string; is_archive: boolean };
type Outcome = { filename: string; destination: string; note?: string };
type PendingFile = { file: File; key: string; state: 'ready' | 'uploading' | 'done' | 'failed'; message?: string; outcomes?: Outcome[] };

export function AdditionalFilesPanel({ shoot, onUploadComplete, incomingFiles, onIncomingConsumed }: {
  shoot: ShootData; onUploadComplete: () => void; incomingFiles?: File[]; onIncomingConsumed?: () => void;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [routeMedia, setRouteMedia] = useState(true);
  const [serviceId, setServiceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadError, setDownloadError] = useState('');
  const targets = useMemo(() => {
    const photo = resolveUploadServiceTargets(shoot, user, 'raw', ['photo']);
    const video = resolveUploadServiceTargets(shoot, user, 'raw', ['video']);
    return [...new Map([...photo, ...video].map(target => [target.id, target])).values()];
  }, [shoot, user]);
  const allowedRole = ['admin', 'superadmin', 'editing_manager', 'photographer'].includes(String(user?.role || '').toLowerCase());
  const list = useQuery({
    queryKey: ['shoot-additional-files', shoot.id, user?.id],
    queryFn: async () => (await apiClient.get<{ files: AdditionalFile[] }>(`/shoots/${shoot.id}/additional-files`)).data.files,
    enabled: allowedRole && open,
    staleTime: 0,
  });
  const stage = (picked: File[]) => {
    if (busy) return;
    setOpen(true);
    setFiles(picked.map(file => ({ file, key: `additional-${crypto.randomUUID()}`, state: 'ready' })));
  };
  useEffect(() => {
    if (!incomingFiles?.length || busy) return;
    setOpen(true);
    setFiles(incomingFiles.map(file => ({ file, key: `additional-${crypto.randomUUID()}`, state: 'ready' })));
    onIncomingConsumed?.();
  }, [incomingFiles, busy, onIncomingConsumed]);
  useEffect(() => { setFiles([]); setOpen(false); setServiceId(''); }, [shoot.id]);
  if (!allowedRole) return null;

  const upload = async () => {
    if (busy) return;
    setBusy(true); setProgress(0);
    const pending = files.filter(item => item.state !== 'done');
    try {
      for (const [index, item] of pending.entries()) {
        setFiles(current => current.map(row => row.key === item.key ? { ...row, state: 'uploading', message: undefined } : row));
        const body = new FormData();
        body.append('files[]', item.file);
        body.append('upload_type', 'additional');
        body.append('idempotency_key', item.key);
        body.append('route_media', routeMedia ? '1' : '0');
        if (serviceId) body.append('shoot_service_id', serviceId);
        const headers = getApiHeaders(); delete headers['Content-Type'];
        let accepted = false;
        try {
          const result = await uploadMediaRequest({
            url: `${API_BASE_URL.replace(/\/$/, '')}/api/shoots/${shoot.id}/upload`, body, headers,
            onProgress: event => setProgress(((index + (event.total ? event.loaded / event.total : 0)) / pending.length) * 100),
          });
          if (result.ok === false) throw new Error(result.message);
          const response = JSON.parse(result.responseText) as { message?: string; success_count?: number; error_count?: number; file_outcomes?: Outcome[]; errors?: { message?: string }[] };
          accepted = result.status >= 200 && result.status < 300 && (response.success_count ?? 0) > 0;
          if (result.status < 200 || result.status >= 300 || response.error_count || !response.success_count) {
            throw new Error(response.errors?.[0]?.message || response.message || 'The file could not be saved. Retry the upload.');
          }
          setFiles(current => current.map(row => row.key === item.key ? { ...row, state: 'done', message: 'Saved', outcomes: response.file_outcomes } : row));
        } catch (error) {
          setFiles(current => current.map(row => row.key === item.key ? { ...row, state: 'failed', message: error instanceof Error ? error.message : 'Upload interrupted. Retry to finish.' } : row));
        }
        await client.invalidateQueries({ queryKey: ['shoot-additional-files', shoot.id] });
        if (accepted) onUploadComplete();
      }
    } finally { setBusy(false); }
  };
  const download = async (file: AdditionalFile) => {
    setDownloadError('');
    try {
      const response = await apiClient.get(`/shoots/${shoot.id}/additional-files/${file.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.filename; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setDownloadError('This file is no longer available to your current assignment. Refresh the shoot or ask an admin.'); }
  };
  const attempted = files.some(item => item.state !== 'ready');
  return <section className="rounded-lg border bg-card p-3" aria-label="Additional files">
    <Button variant="ghost" size="sm" className="w-full justify-start gap-2 px-0" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <Paperclip className="h-4 w-4" />Additional files · Images, videos & ZIPs
    </Button>
    {open && <div className="mt-2 space-y-3">
      <p className="text-xs text-muted-foreground">Upload files for any shoot, including complimentary work. Matching media can join the booked service’s RAW uploads. Other files stay here for staff and the assigned photographer.</p>
      <div className="flex flex-wrap gap-2">
        <label className="min-w-0 flex-1 text-xs">Use files as
          <select aria-label="Use additional files as" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" disabled={busy || attempted} value={routeMedia ? 'route' : 'keep'} onChange={event => setRouteMedia(event.target.value === 'route')}>
            <option value="route">Route matching media to booked services</option><option value="keep">Keep as additional files only</option>
          </select>
        </label>
        {routeMedia && targets.length > 0 && <label className="min-w-0 flex-1 text-xs">Service
          <select aria-label="Additional file service" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" disabled={busy || attempted} value={serviceId} onChange={event => setServiceId(event.target.value)}>
            <option value="">Automatically match one compatible service</option>{targets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}
          </select>
        </label>}
      </div>
      <label htmlFor={inputId} className="block text-sm font-medium">Choose images, videos or ZIP files</label>
      <input id={inputId} data-testid="additional-files-input" type="file" multiple disabled={busy}
        accept="image/*,video/*,.zip,.cr2,.cr3,.nef,.arw,.dng,.raf,.rw2,.orf,.pef,.srw,.raw"
        className="w-full min-w-0 text-sm file:mr-2 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:text-foreground"
        onChange={event => { stage(Array.from(event.target.files || [])); event.target.value = ''; }} />
      <p className="text-xs text-muted-foreground">Up to 1 GB per file. ZIPs: up to 1 GB unpacked and 1,000 entries. Files are checked before acceptance. Additional files do not change charges or required photo counts.</p>
      {busy && <Progress value={progress} aria-label="Additional file upload progress" />}
      {files.length > 0 && <ul className="space-y-2 text-sm" aria-label="Additional file upload results">{files.map(item => <li key={item.key} className="break-words rounded-md border p-2">
        <span className="font-medium">{item.file.name}</span><span className="ml-2 text-xs text-muted-foreground">{item.state === 'ready' ? 'Ready' : item.state === 'uploading' ? 'Uploading…' : item.message}</span>
        {item.outcomes?.map((outcome, index) => <p key={index} className="text-xs text-muted-foreground">{outcome.filename} — {outcome.note || outcome.destination}</p>)}
      </li>)}</ul>}
      {files.some(item => item.state !== 'done') && <Button size="sm" onClick={() => void upload()} disabled={busy}>
        {files.some(item => item.state === 'failed') ? <RefreshCw className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}{busy ? 'Uploading…' : files.some(item => item.state === 'failed') ? 'Retry remaining files' : 'Upload additional files'}
      </Button>}
      {list.isError && <p role="alert" className="text-sm text-destructive">Additional files are unavailable for your current assignment.</p>}
      {!list.isError && !!list.data?.length && <ul className="space-y-2" aria-label="Saved additional files">{list.data.map(file => <li key={file.id} className="flex min-w-0 items-start gap-2 rounded-md border p-2">
        <div className="min-w-0 flex-1"><p className="break-words text-sm">{file.filename}</p><p className="text-xs text-muted-foreground">{file.note}</p></div>
        <Button size="icon" variant="ghost" aria-label={`Download ${file.filename}`} onClick={() => void download(file)}><Download className="h-4 w-4" /></Button>
      </li>)}</ul>}
      {downloadError && <p role="alert" className="text-sm text-destructive">{downloadError}</p>}
    </div>}
  </section>;
}
