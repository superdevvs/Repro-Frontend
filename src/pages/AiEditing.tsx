import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePageLoading } from '@/hooks/use-page-loading';
import { usePermission } from '@/hooks/usePermission';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LISTING_STUDIO_EDITOR_SECTION } from '@/config/listingStudio';
import { canOpenListingStudioInAiEditing, canUseListingStudioRevisions } from '@/utils/listingStudio';
import { studioRevisionsDashboardHref } from '@/utils/studioRevisionNavigation';
import { readShootStudioEntry } from '@/components/studio/shootStudioDeepLink';
import { studioError, studioWorkspaceService, workspaceSources } from '@/services/studioWorkspaceService';
import type { StudioShootRef } from '@/services/studioService';
import { StudioHome, type HomeView } from '@/components/studio/v4/StudioHome';
import { MediaPicker } from '@/components/studio/v4/MediaPicker';
import { findPreset, initialConfig } from '@/components/studio/v4/presets';
import { createWorkspaceRefresh, newestWorkspace } from '@/components/studio/v4/workspaceRefresh';
import type { V4Config, V4Media, V4Preset, V4Workspace, V4WorkspaceProps } from '@/components/studio/v4/types';
import { PhotoWorkspace } from '@/components/ai-editing/v4/PhotoWorkspace';
import { VideoWorkspace } from '@/components/ai-editing/v4/VideoWorkspace';
import { presetAvailability, studioProviderService, type StudioCapabilities } from '@/services/studioProviderService';
import { approveEditingReview } from '@/services/shootMediaService';
import { getApiHeaders } from '@/services/api';

const ListingStudioStaffWorkspace = lazy(() =>
  import('./ListingStudioManage').then(module => ({ default: module.ListingStudioStaffWorkspace })),
);

type EditingMode = V4Preset['kind'];
const sectionClass = 'rounded-full px-3 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-6 sm:text-sm';

export default function AiEditing() {
  const { user, role, isAuthenticated, isImpersonating } = useAuth();
  const permission = usePermission();
  const [params, setParams] = useSearchParams();
  const ownActiveAccount = Boolean(user && isAuthenticated && !isImpersonating && user.isActive !== false);
  const canOpenPricing = isAuthenticated && canOpenListingStudioInAiEditing(user?.role, true, isImpersonating, user?.isActive);
  const canOpenRevisions = ownActiveAccount && permission.can('dashboard', 'view') && canUseListingStudioRevisions(role, user?.secondary_roles);
  const showListingStudio = canOpenPricing || canOpenRevisions;
  const selected = params.get('section');
  const shootEntry = readShootStudioEntry(params);
  const mode: EditingMode = shootEntry ? shootEntry.media === 'videos' ? 'video' : 'image' : selected === 'video' ? 'video' : 'image';
  const inListingStudio = showListingStudio && selected === LISTING_STUDIO_EDITOR_SECTION && !params.get('workspace');
  const section = inListingStudio ? LISTING_STUDIO_EDITOR_SECTION : mode;
  const inWorkspace = Boolean(params.get('workspace'));
  const [mediaVisited, setMediaVisited] = useState(!inListingStudio);
  useEffect(() => {
    if (!inListingStudio) setMediaVisited(true);
  }, [inListingStudio]);
  const changeSection = (next: string) => {
    if (next === section) return;
    setParams(current => {
      const search = new URLSearchParams(current);
      search.set('section', next);
      // A section switch is separate from the shoot or client deep link that opened the page.
      ['rec', 'media', 'preset', 'wf', 'clientId', 'tab'].forEach(key => search.delete(key));
      if (next === LISTING_STUDIO_EDITOR_SECTION) search.delete('d');
      return search;
    });
  };

  return (
    <DashboardLayout hideFooter>
      <Tabs value={section} onValueChange={changeSection} className={inWorkspace ? 'flex h-full min-h-0 flex-col' : 'min-w-0'}>
        {!inWorkspace && (
          <div className="flex justify-center pt-4 sm:pt-7">
            <TabsList aria-label="AI Editing sections" className="h-auto max-w-full rounded-full bg-muted/40 p-1">
              <TabsTrigger value="image" className={sectionClass}>Image</TabsTrigger>
              <TabsTrigger value="video" className={sectionClass}>Video</TabsTrigger>
              {showListingStudio && <TabsTrigger value={LISTING_STUDIO_EDITOR_SECTION} className={sectionClass}>Listing Studio</TabsTrigger>}
            </TabsList>
          </div>
        )}
        <TabsContent
          value={section}
          className={inWorkspace ? 'm-0 flex min-h-0 flex-1 flex-col' : 'm-0'}
          {...(inWorkspace ? { role: 'region', 'aria-label': 'Editing workspace', 'aria-labelledby': undefined, tabIndex: -1 } : {})}
        >
          {(!inListingStudio || mediaVisited) && (
            <div hidden={inListingStudio} className={inWorkspace ? 'flex min-h-0 flex-1 flex-col' : undefined}>
              <MediaEditingWorkflow key={user?.id} mode={mode} active={!inListingStudio} />
            </div>
          )}
          {inListingStudio && (
            <div className="mx-auto w-full max-w-[1260px] space-y-4 px-2 pb-8 pt-4 sm:px-5 sm:pt-6">
              {canOpenRevisions && (
                <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3" aria-label="Studio revisions">
                  <div>
                    <h2 className="text-sm font-semibold">Studio revisions</h2>
                    <p className="text-sm text-muted-foreground">Review and deliver Listing Studio edits in Dashboard Requests.</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={studioRevisionsDashboardHref('')}>Open Studio revisions</Link>
                  </Button>
                </section>
              )}
              {canOpenPricing && (
                <Suspense fallback={<p role="status" className="p-4 text-sm">Loading Listing Studio…</p>}>
                  <ListingStudioStaffWorkspace clientId={params.get('clientId') ?? undefined} embedded />
                </Suspense>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

/** Persists the media workspace and draft before running provider jobs. */
function MediaEditingWorkflow({ mode, active: isActive }: { mode: EditingMode; active: boolean }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const workspaceId = params.get('workspace');
  const entryKey = JSON.stringify(['d', 'rec', 'media', 'preset'].map(key => params.get(key)));
  const resolvedEntry = useRef<string | null>(null);
  const [view, setView] = useState<HomeView>(['projects', 'queue'].includes(params.get('d') || '') ? 'history' : params.get('d') === 'templates' ? 'presets' : 'home');
  const [selectedPreset, setPreset] = useState<V4Preset>(() => findPreset(params.get('preset')));
  const preset = workspaceId || selectedPreset.kind === mode ? selectedPreset : findPreset(mode === 'video' ? 'walkthrough' : 'listing-ready');
  const [media, setMedia] = useState<V4Media[]>([]);
  const [label, setLabel] = useState('Select a shoot');
  const [workspace, setWorkspace] = useState<V4Workspace | null>(null);
  const activeWorkspaceId = workspace?.id;
  const workspaceStatus = workspace?.status;
  const [history, setHistory] = useState<V4Workspace[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historySearching, setHistorySearching] = useState(false);
  const historyQuery = useRef('');
  const historySequence = useRef(0);
  const [picker, setPicker] = useState(false);
  const [pickerShoot, setPickerShoot] = useState<StudioShootRef | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const loading = workspaceId ? workspaceLoading : entryLoading;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<StudioCapabilities | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState(false);
  const activeTab = useRef(isActive);
  activeTab.current = isActive;
  usePageLoading(isActive && (loading || (!capabilities && !capabilitiesError) || (!workspaceId && !historyLoaded)));
  const refreshCapabilities = useCallback(async () => { try { setCapabilities(await studioProviderService.capabilities()); setCapabilitiesError(false); } catch { setCapabilitiesError(true); } }, []);
  useEffect(() => {
    if (!isActive) return;
    let active = true;
    void studioProviderService.capabilities().then(next => {
      if (active) { setCapabilities(next); setCapabilitiesError(false); }
    }).catch(() => { if (active) setCapabilitiesError(true); });
    return () => { active = false; };
  }, [isActive]);
  const lock = useRef(false);
  const operationEpoch = useRef(0);
  const requestId = useRef(crypto.randomUUID());
  const currentId = useRef(workspaceId); currentId.current = workspaceId;
  const refreshHistory = useCallback(async (query = historyQuery.current) => {
    if (!activeTab.current) return;
    historyQuery.current = query;
    const sequence = ++historySequence.current;
    setHistorySearching(true);
    try { const next = await studioWorkspaceService.list(query); if (sequence === historySequence.current) { setHistory(next); setHistoryError(null); } }
    catch (e) { if (sequence === historySequence.current) setHistoryError(studioError(e)); }
    finally { if (sequence === historySequence.current) { setHistoryLoaded(true); setHistorySearching(false); } }
  }, []);
  useEffect(() => {
    if (!isActive) return;
    void refreshHistory();
    return () => { historySequence.current += 1; };
  }, [refreshHistory, isActive]);
  useEffect(() => {
    if (!isActive || currentId.current) return;
    const entry = readShootStudioEntry(params);
    if (!entry || resolvedEntry.current === entryKey) {
      if (!entry) resolvedEntry.current = null;
      setEntryLoading(false);
      return;
    }
    resolvedEntry.current = null;
    let active = true; setEntryLoading(true); setError(null); setMedia([]);
    const chosen = findPreset(entry.presetId || (entry.media === 'videos' ? 'walkthrough' : 'listing-ready'));
    setPreset(chosen);
    void (async () => {
      try {
        const result = await workspaceSources.resolveShoot(entry.shootId);
        if (!result.ok) throw new Error(result.errorMessage || 'This shoot is not available to your account.');
        if (active) {
          resolvedEntry.current = entryKey;
          const record = result.record;
          const address = String(record?.address || record?.label || record?.name || 'Selected shoot');
          setLabel(address);
          setPickerShoot({ id: Number(entry.shootId), address, label: address, propertyIdentifier: entry.shootId, location: null, thumbnailUrl: null, updatedAt: null });
          setPicker(true);
        }
      } catch (e) { if (active) setError(studioError(e)); }
      finally { if (active) setEntryLoading(false); }
    })();
    return () => { active = false; };
    // A new URL entry replaces selection; picker edits do not restart authorization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryKey, isActive]);
  const refreshWorkspace = useMemo(() => createWorkspaceRefresh({
    fetchWorkspace: id => studioWorkspaceService.get(id),
    currentScope: () => ({ id: currentId.current, epoch: operationEpoch.current }),
    onWorkspace: next => setWorkspace(current => newestWorkspace(current, next)),
    onError: reason => setError(reason ? studioError(reason) : null),
  }), []);
  useEffect(() => {
    if (!isActive) return;
    if (!workspaceId) { setWorkspace(null); setWorkspaceLoading(false); return; }
    let active = true; setWorkspaceLoading(true); setError(null); setWorkspace(null);
    void studioWorkspaceService.get(workspaceId).then(next => { if (active) { setWorkspace(next); setPreset(findPreset(next.presetId)); setMedia(next.media); setLabel(next.name); } }).catch(e => { if (active) setError(studioError(e)); }).finally(() => { if (active) setWorkspaceLoading(false); });
    return () => { active = false; };
  }, [workspaceId, isActive]);
  useEffect(() => {
    if (!isActive || !activeWorkspaceId || !workspaceStatus || !['preparing', 'generating'].includes(workspaceStatus)) return;
    const timer = window.setInterval(() => { if (!lock.current) void refreshWorkspace(activeWorkspaceId); }, 4000);
    return () => window.clearInterval(timer);
  }, [activeWorkspaceId, workspaceStatus, refreshWorkspace, isActive]);
  useEffect(() => {
    if (isActive && workspaceStatus && ['completed', 'failed', 'cancelled', 'ready'].includes(workspaceStatus)) void refreshHistory();
  }, [workspaceStatus, refreshHistory, isActive]);
  const openWorkspace = (id: string) => {
    if (activeTab.current) setParams(prev => { const next = new URLSearchParams(prev); next.set('workspace', id); return next; });
  };
  const back = () => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('workspace');
      if (workspace && !next.has('section') && !readShootStudioEntry(next)) {
        next.set('section', findPreset(workspace.presetId).kind);
      }
      return next;
    });
    setError(null);
    void refreshHistory();
  };
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
    const availability = presetAvailability(chosen.id, capabilities);
    if (!availability.ready) { setError(availability.reason || 'This edit is not available yet.'); return; }
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
    workspace, preset: findPreset(workspace.presetId), busy, error, capabilities, onBack: back, onChangeMedia: () => {
      if (['preparing', 'generating'].includes(workspace.status)) setError('Wait for this job to finish, or cancel it before changing the source media.');
      else setPicker(true);
    },
    onSave: config => mutate(() => studioWorkspaceService.update(workspace.id, { config, version: workspace.version })),
    onApproveShoot: workspace.shootId && workspace.presetId === 'full-shoot' ? () => mutate(async () => {
      await approveEditingReview(workspace.shootId!, getApiHeaders());
      return studioWorkspaceService.get(workspace.id);
    }) : undefined,
    onGenerate: config => saveAndRun(config, 'generate'), onPrepare: config => saveAndRun(config, 'prepare'),
    onRefine: feedback => mutate(() => studioWorkspaceService.revise(workspace.id, feedback)),
    onUpscale: (mediaId, outputId) => mutate(() => studioWorkspaceService.upscale(workspace.id, mediaId, outputId)),
    onApplyEdits: (edits, targets) => mutate(() => studioWorkspaceService.applyEdits(workspace.id, edits, targets)),
    onCancel: () => mutate(() => studioWorkspaceService.run(workspace.id, 'cancel')),
    onRefresh: () => void refreshWorkspace(workspace.id), onDetect: mediaId => studioWorkspaceService.detect(workspace.id, mediaId),
  } : null;
  return <>
    <div className={workspaceId ? 'flex h-full min-h-0 flex-col' : 'min-w-0'}>
      {capabilitiesError && <div role="status" className="mx-auto mb-3 flex w-full max-w-[1132px] items-center gap-3 rounded-lg border p-3 text-sm"><span className="flex-1">Additional editing options could not be checked.</span><Button variant="ghost" size="sm" onClick={() => void refreshCapabilities()}>Retry</Button></div>}
      {workspace?.shootId && findPreset(workspace.presetId).kind === 'video' && <nav aria-label="Shoot editing projects" className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 text-xs">
        <span className="font-medium">Shoot #{workspace.shootId}</span>
        {history.filter(project => project.shootId === workspace.shootId).sort((a, b) => Number(Boolean(a.parentWorkspaceId)) - Number(Boolean(b.parentWorkspaceId))).map(project => <Button key={project.id} size="sm" variant={project.id === workspace.id ? 'secondary' : 'ghost'} onClick={() => openWorkspace(project.id)}>{project.parentWorkspaceId ? 'Subproject: ' : ''}{findPreset(project.presetId).name} - {project.status}</Button>)}
        <span className="text-muted-foreground">{workspace.presetId === 'full-shoot' && workspace.requiresReview !== false ? 'Full-shoot photos require review and approval.' : "Finished AI photos are saved in the shoot's Edited tab."}</span>
      </nav>}
      {loading ? <div className="flex min-h-64 flex-1 items-center justify-center gap-3 text-muted-foreground" role="status"><Loader2 size={22} className="" />Opening your workspace…</div> : props ? props.preset.kind === 'video' ? <VideoWorkspace {...props} /> : <PhotoWorkspace {...props} /> : <>
        {(error || historyError) && <div role="alert" className="mx-auto mb-3 flex max-w-[1132px] items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm"><AlertCircle size={17} className="shrink-0 text-destructive" /><span className="flex-1">{error || historyError}</span><Button variant="ghost" size="sm" onClick={() => workspaceId ? void refreshWorkspace(workspaceId) : void refreshHistory()}><RefreshCw size={14} className="mr-1" />Retry</Button>{workspaceId && <Button variant="outline" size="sm" onClick={back}>Back</Button>}</div>}
        {!workspaceId && <StudioHome active={isActive} onSearch={isActive ? refreshHistory : undefined} historyLoading={historySearching} historyError={!!historyError} capabilities={capabilities} name={user?.name?.split(' ')[0] || 'there'} view={view} onView={setView} mode={mode} media={media} label={label} preset={preset} onPreset={setPreset} onMedia={() => setPicker(true)} onStart={(prompt, p) => void start(prompt, p)} busy={busy} workspaces={history} onResume={openWorkspace} onRefresh={() => void refreshHistory()} />}
      </>}
    </div>
    <MediaPicker open={isActive && picker} onClose={() => setPicker(false)} selected={media} preset={preset} initialShoot={pickerShoot} onSelect={(items, name) => {
      if (workspace) { void mutate(() => studioWorkspaceService.update(workspace.id, { media: items, name, version: workspace.version, config: initialConfig(findPreset(workspace.presetId), items, workspace.config.prompt) })).catch(() => undefined); }
      else { setMedia(items); setLabel(name); requestId.current = crypto.randomUUID(); }
    }} />
  </>;
}
