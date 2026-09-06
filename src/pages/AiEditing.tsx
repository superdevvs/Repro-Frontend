import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { readShootStudioEntry } from '@/components/studio/shootStudioDeepLink';
import { sourceMedia, studioError, studioWorkspaceService, workspaceSources } from '@/services/studioWorkspaceService';
import { StudioHome, type HomeView } from '@/components/studio/v4/StudioHome';
import { MediaPicker } from '@/components/studio/v4/MediaPicker';
import { findPreset, initialConfig } from '@/components/studio/v4/presets';
import { createWorkspaceRefresh, newestWorkspace } from '@/components/studio/v4/workspaceRefresh';
import type { V4Config, V4Media, V4Preset, V4Workspace, V4WorkspaceProps } from '@/components/studio/v4/types';
import { PhotoWorkspace } from '@/components/ai-editing/v4/PhotoWorkspace';
import { VideoWorkspace } from '@/components/ai-editing/v4/VideoWorkspace';

/** Shares the dashboard shell and persists edits before running provider jobs. */
export default function AiEditing() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const workspaceId = params.get('workspace');
  const entryKey = `${params.get('rec') || ''}:${params.get('media') || ''}:${params.get('preset') || ''}`;
  const [view, setView] = useState<HomeView>(['projects', 'queue'].includes(params.get('d') || '') ? 'history' : params.get('d') === 'templates' ? 'presets' : 'home');
  const [mode, setMode] = useState<'studio' | 'image' | 'video'>('studio');
  const [preset, setPreset] = useState<V4Preset>(findPreset(params.get('preset')));
  const [media, setMedia] = useState<V4Media[]>([]);
  const [label, setLabel] = useState('Select a shoot');
  const [workspace, setWorkspace] = useState<V4Workspace | null>(null);
  const activeWorkspaceId = workspace?.id;
  const workspaceStatus = workspace?.status;
  const [history, setHistory] = useState<V4Workspace[]>([]);
  const [picker, setPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const lock = useRef(false);
  const operationEpoch = useRef(0);
  const requestId = useRef(crypto.randomUUID());
  const currentId = useRef(workspaceId); currentId.current = workspaceId;
  const refreshHistory = useCallback(async () => {
    try { setHistory(await studioWorkspaceService.list()); setHistoryError(null); }
    catch (e) { setHistoryError(studioError(e)); }
  }, []);
  useEffect(() => { void refreshHistory(); }, [refreshHistory]);
  useEffect(() => {
    if (workspaceId) return;
    const entry = readShootStudioEntry(new URLSearchParams(window.location.search));
    if (!entry) return;
    let active = true; setLoading(true); setError(null); setMedia([]);
    const chosen = findPreset(entry.presetId || (entry.media === 'videos' ? 'walkthrough' : 'listing-ready'));
    setMode(entry.media === 'videos' ? 'video' : 'image'); setPreset(chosen);
    void (async () => {
      try {
        const result = await workspaceSources.resolveShoot(entry.shootId);
        if (!result.ok) throw new Error(result.errorMessage || 'This shoot is not available to your account.');
        const files = await workspaceSources.getShootMedia(Number(entry.shootId), chosen.workflow);
        if (active) {
          setMedia(files.map(sourceMedia));
          const record = result.record;
          setLabel(String(record?.address || record?.label || record?.name || 'Selected shoot'));
          if (!files.length) setError('This shoot has no compatible media yet. Add media to continue.');
        }
      } catch (e) { if (active) setError(studioError(e)); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
    // A new URL entry replaces selection; picker edits do not restart authorization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryKey]);
  const refreshWorkspace = useMemo(() => createWorkspaceRefresh({
    fetchWorkspace: id => studioWorkspaceService.get(id),
    currentScope: () => ({ id: currentId.current, epoch: operationEpoch.current }),
    onWorkspace: next => setWorkspace(current => newestWorkspace(current, next)),
    onError: reason => setError(reason ? studioError(reason) : null),
  }), []);
  useEffect(() => {
    if (!workspaceId) { setWorkspace(null); return; }
    let active = true; setLoading(true); setError(null); setWorkspace(null);
    void studioWorkspaceService.get(workspaceId).then(next => { if (active) { setWorkspace(next); setPreset(findPreset(next.presetId)); setMedia(next.media); setLabel(next.name); } }).catch(e => { if (active) setError(studioError(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId]);
  useEffect(() => {
    if (!activeWorkspaceId || !workspaceStatus || !['preparing', 'generating'].includes(workspaceStatus)) return;
    const timer = window.setInterval(() => { if (!lock.current) void refreshWorkspace(activeWorkspaceId); }, 4000);
    return () => window.clearInterval(timer);
  }, [activeWorkspaceId, workspaceStatus, refreshWorkspace]);
  useEffect(() => {
    if (workspaceStatus && ['completed', 'failed', 'cancelled', 'ready'].includes(workspaceStatus)) void refreshHistory();
  }, [workspaceStatus, refreshHistory]);
  const openWorkspace = (id: string) => setParams(prev => { const next = new URLSearchParams(prev); next.set('workspace', id); return next; });
  const back = () => { setParams(prev => { const next = new URLSearchParams(prev); next.delete('workspace'); return next; }); setError(null); void refreshHistory(); };
  const mutate = async (operation: () => Promise<V4Workspace>) => {
    if (lock.current) throw new Error('Your previous change is still saving. Please wait a moment.');
    const targetId = currentId.current;
    operationEpoch.current += 1;
    lock.current = true; setBusy(true); setError(null);
    try { const next = await operation(); if (currentId.current === next.id) { setWorkspace(current => newestWorkspace(current, next)); setMedia(next.media); } void refreshHistory(); }
    catch (e) {
      // A failed response may follow a committed save or queued job. Reconcile
      // its version/status before Retry, while useWorkspaceDraft retains edits.
      if (targetId && currentId.current === targetId) await refreshWorkspace(targetId);
      const message = studioError(e); setError(message); throw new Error(message);
    }
    finally { lock.current = false; setBusy(false); }
  };
  const start = async (prompt: string, chosen = preset) => {
    if (!media.length) { setPicker(true); return; }
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await studioWorkspaceService.create({ name: label, presetId: chosen.id, media, config: initialConfig(chosen, media, prompt) }, requestId.current);
      requestId.current = crypto.randomUUID(); openWorkspace(result.id); void refreshHistory();
    } catch (e) { setError(studioError(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  const saveAndRun = (config: V4Config, action: 'generate' | 'prepare') => mutate(async () => {
    if (!workspace) throw new Error('Select a project first.');
    const saved = await studioWorkspaceService.update(workspace.id, { config, version: workspace.version });
    // Saving and queueing are separate requests. Retain the committed version even
    // if queueing fails, so Retry cannot overwrite a newer draft or fail as stale.
    if (currentId.current === saved.id) setWorkspace(current => newestWorkspace(current, saved));
    return studioWorkspaceService.run(saved.id, action);
  });
  const props: V4WorkspaceProps | null = workspace ? {
    workspace, preset: findPreset(workspace.presetId), busy, error, onBack: back, onChangeMedia: () => {
      if (['preparing', 'generating'].includes(workspace.status)) setError('Wait for this job to finish, or cancel it before changing the source media.');
      else setPicker(true);
    },
    onSave: config => mutate(() => studioWorkspaceService.update(workspace.id, { config, version: workspace.version })),
    onGenerate: config => saveAndRun(config, 'generate'), onPrepare: config => saveAndRun(config, 'prepare'),
    onRefine: feedback => mutate(() => studioWorkspaceService.revise(workspace.id, feedback)),
    onCancel: () => mutate(() => studioWorkspaceService.run(workspace.id, 'cancel')),
    onRefresh: () => void refreshWorkspace(workspace.id), onDetect: mediaId => studioWorkspaceService.detect(workspace.id, mediaId),
  } : null;
  return <DashboardLayout hideFooter>
    <div className={workspaceId ? 'flex h-full min-h-0 flex-col' : 'min-w-0'}>
      {loading ? <div className="flex min-h-64 flex-1 items-center justify-center gap-3 text-muted-foreground" role="status"><Loader2 size={22} className="animate-spin" />Opening your workspace…</div> : props ? props.preset.kind === 'video' ? <VideoWorkspace {...props} /> : <PhotoWorkspace {...props} /> : <>
        {(error || historyError) && <div role="alert" className="mx-auto mb-3 flex max-w-[1132px] items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm"><AlertCircle size={17} className="shrink-0 text-destructive" /><span className="flex-1">{error || historyError}</span><Button variant="ghost" size="sm" onClick={() => workspaceId ? void refreshWorkspace(workspaceId) : void refreshHistory()}><RefreshCw size={14} className="mr-1" />Retry</Button>{workspaceId && <Button variant="outline" size="sm" onClick={back}>Back</Button>}</div>}
        {!workspaceId && <StudioHome name={user?.name?.split(' ')[0] || 'there'} view={view} onView={setView} mode={mode} onMode={m => { setMode(m); if (m !== 'studio' && preset.kind !== m) setPreset(findPreset(m === 'video' ? 'walkthrough' : 'listing-ready')); }} media={media} label={label} preset={preset} onPreset={setPreset} onMedia={() => setPicker(true)} onStart={(prompt, p) => void start(prompt, p)} busy={busy} workspaces={history} onResume={openWorkspace} onRefresh={() => void refreshHistory()} />}
      </>}
    </div>
    <MediaPicker open={picker} onClose={() => setPicker(false)} selected={media} preset={preset} onSelect={(items, name) => {
      if (workspace) { void mutate(() => studioWorkspaceService.update(workspace.id, { media: items, name, version: workspace.version, config: initialConfig(findPreset(workspace.presetId), items, workspace.config.prompt) })).catch(() => undefined); }
      else { setMedia(items); setLabel(name); requestId.current = crypto.randomUUID(); }
    }} />
  </DashboardLayout>;
}
