import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/api';
import { studioError } from '@/services/studioWorkspaceService';
import { registerMediaVersions, type MediaVersion, type MediaVersionRequest } from '@/services/mediaVersions';
import { triggerShootDetailRefresh } from '@/realtime/realtimeRefreshBus';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StudioImage } from '@/components/studio/v4/StudioImage';

export function MediaVersionsDialogHost() {
  const [request, setRequest] = useState<MediaVersionRequest | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => registerMediaVersions(setRequest), []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shootId = params.get('editingShootId'); const fileId = params.get('editingFileId');
    if (!shootId || !fileId || !/^\d+$/.test(shootId) || !/^\d+$/.test(fileId)) return;
    setRequest({ shootId, fileId, name: 'Image #' + fileId });
    params.delete('editingShootId'); params.delete('editingFileId');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate]);
  return request ? <MediaVersionsDialog key={`${request.shootId}:${request.fileId}`} request={request} onClose={() => setRequest(null)} /> : null;
}

function MediaVersionsDialog({ request, onClose }: { request: MediaVersionRequest; onClose: () => void }) {
  const [versions, setVersions] = useState<MediaVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const expectedUploadVersion = useRef<number | null>(null);
  const restoreRequests = useRef(new Map<string, { request_id: string; expected_version: number }>());
  const lastVersion = useRef<number | null>(null);
  const base = `/shoots/${request.shootId}`;
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const next = new AbortController(); controller.current = next;
    try {
      const { data } = await apiClient.get<{ data: MediaVersion[]; current_version: number }>(`${base}/files/${request.fileId}/versions`, { signal: next.signal });
      setVersions(data.data); setCurrentVersion(data.current_version);
      if (lastVersion.current !== null && lastVersion.current !== data.current_version) triggerShootDetailRefresh(String(request.shootId));
      lastVersion.current = data.current_version;
    } catch (e) { if (!next.signal.aborted) setError(studioError(e)); }
  }, [base, request.fileId, request.shootId]);
  useEffect(() => { void refresh(); return () => controller.current?.abort(); }, [refresh]);
  useEffect(() => {
    if (!versions.some(version => ['queued', 'processing', 'ready'].includes(version.status))) return;
    const timer = window.setTimeout(() => void refresh(), 3000);
    return () => window.clearTimeout(timer);
  }, [versions, refresh]);
  const upload = async () => {
    if (!file || !currentVersion || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null); setProgress(0);
    expectedUploadVersion.current ??= currentVersion;
    const body = new FormData(); body.append('file', file); body.append('request_id', requestId.current);
    body.append('expected_version', String(expectedUploadVersion.current));
    try {
      await apiClient.post(`${base}/files/${request.fileId}/versions`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: event => setProgress(event.total ? Math.round(event.loaded * 100 / event.total) : null),
      });
      setMessage('Upload saved. The current image stays available until scanning and processing finish.');
      setFile(null); expectedUploadVersion.current = null; requestId.current = crypto.randomUUID();
      await refresh();
    } catch (e) { setError(studioError(e)); } finally { inFlight.current = false; setBusy(false); setProgress(null); }
  };
  const act = async (version: MediaVersion, action: 'restore' | 'retry' | 'replace_latest' | 'save_copy' | 'dismiss') => {
    if (!currentVersion || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const conflict = action === 'replace_latest' || action === 'save_copy';
      if (action === 'restore' && !restoreRequests.current.has(version.id)) restoreRequests.current.set(version.id, { request_id: crypto.randomUUID(), expected_version: currentVersion });
      await apiClient.post(`${base}/media-versions/${version.id}/${conflict ? 'resolve' : action}`, conflict
        ? { choice: action, expected_latest_version: currentVersion }
        : action === 'restore' ? restoreRequests.current.get(version.id) : {});
      if (action === 'restore') restoreRequests.current.delete(version.id);
      setMessage(action === 'restore' ? 'Restore saved. Processing will create a new current version.' : 'Saved.');
      await refresh();
    } catch (e) { setError(studioError(e)); } finally { inFlight.current = false; setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col">
    <DialogHeader><DialogTitle>Versions and returned edits</DialogTitle><DialogDescription>{request.name} · Current version {currentVersion ?? '…'}. Previous images remain available to staff.</DialogDescription></DialogHeader>
    <div className="min-h-0 space-y-4 overflow-auto">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <div className="space-y-3 rounded-lg border p-3">
        <label className="block text-sm">Upload a saved edit<input aria-label="Upload a saved edit" type="file" accept=".jpg,.jpeg,.png,.tif,.tiff" disabled={busy} className="mt-2 block w-full text-sm" onChange={event => {
          setFile(event.target.files?.[0] ?? null); requestId.current = crypto.randomUUID(); expectedUploadVersion.current = currentVersion;
        }} /></label>
        <p className="text-xs text-muted-foreground">Export JPEG, PNG or TIFF from Photoshop. Keep layered PSD masters on your computer. This upload replaces this image after validation, retaining the previous version.</p>
        <Button disabled={!file || busy || !currentVersion} onClick={() => void upload()}>{busy && progress !== null ? (progress === 100 ? 'Saving upload…' : `Uploading ${progress}%`) : 'Upload saved edit'}</Button>
      </div>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh versions</Button>
      {!versions.length && <p className="text-sm text-muted-foreground">No replacements yet. The current image will be kept when its first replacement is published.</p>}
      {versions.map(version => <article key={version.id} className="flex gap-3 rounded-lg border p-3">
        {version.preview_url && <StudioImage src={version.preview_url} alt={version.filename ?? 'Saved edit'} className="h-20 w-28 rounded object-cover" />}
        <div className="min-w-0 flex-1 space-y-2"><p className="text-sm font-medium">{version.version ? `Version ${version.version}` : 'Returned edit'} · {version.status}</p>
          <p className="text-xs text-muted-foreground">{new Date(version.created_at).toLocaleString()}</p>
          {version.error && <p className="text-sm">{version.error}</p>}
          <div className="flex flex-wrap gap-2">
            {version.status === 'archived' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(version, 'restore')}>Restore as new version</Button>}
            {['conflict', 'alternative'].includes(version.status) && <>
              <Button size="sm" disabled={busy} onClick={() => void act(version, 'replace_latest')}>Replace latest (v{currentVersion})</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(version, 'save_copy')}>Save as copy</Button>
            </>}
            {version.status === 'failed' && version.error_code === 'processing_failed' && <Button size="sm" disabled={busy} onClick={() => void act(version, 'retry')}>Retry saved upload</Button>}
            {version.can_dismiss && <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(version, 'dismiss')}>Keep current / withdraw this upload</Button>}
          </div>
        </div>
      </article>)}
    </div>
    <Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>
  </DialogContent></Dialog>;
}
