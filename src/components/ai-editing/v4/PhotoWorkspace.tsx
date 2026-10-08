import { EmptyState } from '@/components/ui/empty-state';
import { StudioImage } from '@/components/studio/v4/StudioImage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, BoxSelect, Check, Crop, Download, Droplets, Grid2X2, Layers, MapPin, Maximize2, Palette, Pencil, Share2, Shield, SlidersHorizontal, Sparkles, Sun, Type, UserRound, X } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PhotoComparison } from './PhotoComparison';
import { submitEditingRequest } from '@/services/editingRequestService';
import type { PhotoEditRecipe, V4Config, V4Media, V4Output, V4WorkspaceProps } from '@/components/studio/v4/types';
import { EditorShell, InspectorFact, InspectorSection, MediaFilmstrip } from './EditorShell';
import { FeedbackEditor } from './FeedbackEditor';
import { isWorkspaceRunning, latestOutputs, reviewedOutputs } from './workspaceLogic';
import { useWorkspaceDraft } from './useWorkspaceDraft';
import { shareOutputs } from './shareOutput';
import { downloadWorkspaceOutput } from './downloadOutput';
import { presetAvailability } from '@/services/studioProviderService';
import { PhotoServiceControls, UpscalePhotoAction } from './PhotoServiceControls';
import { VirtualStagingControls } from './VirtualStagingControls';
import { MediaGenerationOverlay } from './MediaGenerationOverlay';
import { CustomPhotoControls } from './CustomPhotoControls';
import { customPhotoTitles, type CustomPhotoTool } from './photoEditTools';
import { studioWorkspaceService } from '@/services/studioWorkspaceService';
export function PhotoWorkspace({ workspace, preset, busy, error, capabilities, onUpscale, onApplyEdits, onBack, onChangeMedia, onSave, onApproveShoot, onGenerate, onRefine, onCancel, onRefresh, onDetect }: V4WorkspaceProps) {
  const sourceMedia = workspace.media.filter(item => item.kind !== 'video');
  const fullShoot = preset.id === 'full-shoot';
  const groups = fullShoot ? workspace.photoGroups : null;
  const outputNames = new Map([...workspace.outputs].sort((a, b) => a.version - b.version).filter(output => output.name).map(output => [output.mediaId, output.name]));
  const media = (groups?.length ? groups.flatMap(group => {
    const source = sourceMedia.find(item => item.id === group.mediaId);
    return source ? [{ ...source, name: group.name }] : [];
  }) : sourceMedia).map(item => ({ ...item, name: outputNames.get(item.id) || item.name }));
  const requiresReview = fullShoot && workspace.requiresReview !== false;
  const { config, setConfig, dirty } = useWorkspaceDraft(workspace);
  const [activeId, setActiveId] = useState(media[0]?.id || '');
  const [view, setView] = useState<'configure' | 'gallery' | 'focus' | 'deliver'>(workspace.outputs.length ? 'gallery' : 'configure');
  const [comparing, setComparing] = useState(true);
  const [editPrompts, setEditPrompts] = useState<Record<string, string>>({});
  const [refining, setRefining] = useState(false);
  const refineLock = useRef(false);
  const [customEditOpen, setCustomEditOpen] = useState(false);
  const customEditTrigger = useRef<HTMLButtonElement>(null);
  const [comparePosition, setComparePosition] = useState(50);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [manualReviewed, setReviewed] = useState<Set<string>>(new Set(workspace.config.reviewedOutputIds || []));
  const autoReviewed = Boolean(workspace.shootId) && !requiresReview;
  const reviewed = useMemo(() => autoReviewed ? new Set(workspace.outputs.filter(output => output.status === 'completed').map(output => output.id)) : manualReviewed, [autoReviewed, workspace.outputs, manualReviewed]);
  const reviewDirty = !autoReviewed && JSON.stringify([...reviewed].sort()) !== JSON.stringify([...(workspace.config.reviewedOutputIds || [])].sort());
  const [feedback, setFeedback] = useState<V4Media | null>(null);
  const [detectOnOpen, setDetectOnOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [tool, setTool] = useState<'provider' | 'geometry' | 'scene' | 'repairs' | 'direction' | 'review' | CustomPhotoTool>(workspace.outputs.length ? 'review' : 'provider');
  const [feedbackPrompt, setFeedbackPrompt] = useState('');
  const [recipe, setRecipe] = useState<PhotoEditRecipe>({});
  const [applyScope, setApplyScope] = useState<'photo' | 'selected'>('photo');
  const [preview, setPreview] = useState<{ outputId: string; url: string } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'review' | 'ready'>('all');
  const [localError, setLocalError] = useState('');
  const [humanOpen, setHumanOpen] = useState(false);
  const [humanNote, setHumanNote] = useState('');
  const [humanBusy, setHumanBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const previousStatus = useRef(workspace.status);
  const running = isWorkspaceRunning(workspace.status);
  const active = media.find(item => item.id === activeId) || media[0];
  const latest = useMemo(() => latestOutputs(workspace.outputs.filter(output => output.kind === 'image')), [workspace.outputs]);
  const outputs = useMemo(() => reviewedOutputs(workspace.outputs.filter(output => output.kind === 'image'), reviewed), [workspace.outputs, reviewed]);
  const selectedIds = useMemo(() => new Set(fullShoot ? workspace.media.map(item => item.id) : config.frames.map(frame => frame.mediaId)), [config.frames, fullShoot, workspace.media]);
  const selected = media.filter(item => selectedIds.has(item.id));
  const activeGenerating = running && (!selectedIds.size || selectedIds.has(active?.id)) && !(groups?.length && outputs.has(active?.id));
  const activeVersions = workspace.outputs.filter(output => output.mediaId === active?.id && output.kind === 'image' && output.url && ['completed', 'ready'].includes(output.status)).sort((a, b) => b.version - a.version);
  const activeOutput = activeVersions.find(output => output.id === versionId) || outputs.get(active?.id);
  const previewOutputId = activeOutput?.id;
  const previewMediaId = activeOutput?.mediaId;
  const readyCount = selected.filter(item => { const output = outputs.get(item.id); return output && reviewed.has(output.id); }).length;
  const customRevision = capabilities?.customRevision ?? capabilities?.revision;
  const staging = /stag/i.test(preset.id + preset.name);
  const arrangements = staging ? Math.min(20, Math.max(1, Number(config.adjustments.variationCount) || 1)) : 1;
  const outputCount = selected.length * arrangements;
  const photoWord = outputCount === 1 ? 'photo' : 'photos';
  const generateLabel = !staging ? `Generate ${outputCount} ${photoWord}` : config.adjustments.addFurniture === false ? `Remove furniture from ${outputCount} ${photoWord}` : `Stage ${outputCount} ${photoWord}`;
  const availability = presetAvailability(preset.id, capabilities);
  const blocked = busy || running || selected.length === 0 || !availability.ready;
  useEffect(() => {
    if (workspace.status === 'completed' && previousStatus.current === 'generating') { setTool('review'); setView('gallery'); setComparing(true); }
    previousStatus.current = workspace.status;
  }, [workspace.status]);
  useEffect(() => { setCustomEditOpen(false); }, [active?.id, workspace.id, view]);
  useEffect(() => { if (dirty || reviewDirty) setNotice(''); }, [dirty, reviewDirty]);
  useEffect(() => { setRecipe({}); setPreview(null); }, [activeOutput?.id, workspace.id]);
  useEffect(() => {
    setPreview(null);
    if (!previewOutputId || !previewMediaId || !Object.keys(recipe).length) { setPreviewError(''); return; }
    const controller = new AbortController();
    let url: string | undefined;
    const timer = window.setTimeout(() => {
      void studioWorkspaceService.previewEdits(workspace.id, recipe, { mediaId: previewMediaId, outputId: previewOutputId }, controller.signal).then(blob => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob); setPreview({ outputId: previewOutputId, url }); setPreviewError('');
      }).catch(() => { if (!controller.signal.aborted) { setPreview(null); setPreviewError('Preview could not load. Retry before saving edits.'); } });
    }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [recipe, previewOutputId, previewMediaId, workspace.id, previewAttempt]);
  const adjust = (key: string, value: string | number | boolean) => setConfig(current => { const adjustments = { ...current.adjustments, [key]: value }; if (value === '') delete adjustments[key]; return { ...current, adjustments }; });
  const patchAdjustments = (changes: Record<string, string | number | boolean>) => setConfig(current => ({ ...current, adjustments: { ...current.adjustments, ...changes } }));
  const withScope = (): V4Config => ({ ...config, frames: (fullShoot ? sourceMedia : selected).map(item => ({ mediaId: item.id, duration: 5, method: 'fit' })) });
  const perform = async (action: () => Promise<void>) => { setLocalError(''); setNotice(''); try { await action(); } catch (reason) { setLocalError(reason instanceof Error ? reason.message : 'The edit could not be completed. Please try again.'); } };
  const openPhoto = (item: V4Media) => { setActiveId(item.id); setVersionId(null); setComparing(true); setView(outputs.has(item.id) ? 'focus' : 'configure'); };
  const toggleScope = (id: string) => {
    const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id);
    setConfig(current => ({ ...current, frames: media.filter(item => next.has(item.id)).map(item => ({ mediaId: item.id, duration: 5, method: 'fit' })) }));
  };
  const markReviewed = (output?: V4Output) => {
    if (!output) return;
    const siblings = new Set(workspace.outputs.filter(item => item.mediaId === output.mediaId).map(item => item.id));
    setReviewed(current => new Set([...current].filter(id => !siblings.has(id)).concat(output.id)));
  };
  const openFeedback = (item: V4Media, detect = false, prompt = '') => { setFeedbackPrompt(prompt); setDetectOnOpen(detect); setFeedback(item); };
  const downloadPhoto = async (output: V4Output, item: V4Media) => {
    if (downloadingId) return;
    setDownloadingId(output.id);
    try { await downloadWorkspaceOutput(workspace.id, output, item.name); setNotice(`Download started for ${item.name}, version ${output.version}.`); }
    finally { setDownloadingId(null); }
  };
  const shareReviewed = async () => {
    const items = selected.flatMap(item => { const result = outputs.get(item.id); return result && reviewed.has(result.id) ? [{ name: `${item.name} · Version ${result.version}`, url: result.url }] : []; });
    const result = await shareOutputs(`${workspace.name} · Edited photos`, items);
    if (result !== 'cancelled') setNotice(result === 'shared' ? 'Photo links shared.' : `${items.length} reviewed photo ${items.length === 1 ? 'link' : 'links'} copied.`);
  };
  const requestHuman = async () => {
    if (!humanNote.trim() || humanBusy) return;
    setHumanBusy(true); setLocalError('');
    try { await submitEditingRequest({ shootId: active?.shootId, summary: `${preset.name}: ${active?.name || workspace.name}`, details: `${humanNote.trim()}\nWorkspace: ${workspace.id}\nMedia: ${active?.id || ''}`, priority: 'normal', targetTeam: 'editor' }); setHumanOpen(false); setHumanNote(''); setNotice('Your request was sent to the editing team.'); }
    catch (reason) { setLocalError(reason instanceof Error ? reason.message : 'Could not send the editing request.'); }
    finally { setHumanBusy(false); }
  };
  const actions = running ? <><Button variant="outline" onClick={() => void perform(onCancel)} disabled={busy}>Cancel job</Button><Button data-variant="primary" disabled><Loader2 aria-hidden="true" className="" />{staging ? 'Staging photos' : 'Editing photos'}</Button></> : tool in customPhotoTitles ? <Button variant="outline" onClick={() => { setTool('review'); setView('focus'); }}>Back to review</Button> : view === 'deliver' ? <><Button variant="outline" onClick={() => setView('gallery')}>Back to review</Button><Button data-variant="primary" disabled={!readyCount || busy} onClick={() => void perform(shareReviewed)}><Share2 />Share photos</Button></> : view === 'gallery' || view === 'focus' ? <><Button variant="outline" onClick={() => { setTool('provider'); setView('configure'); }}><SlidersHorizontal />Edit recipe</Button><Button data-variant="primary" disabled={busy || readyCount !== selected.length || selected.length === 0 || (Boolean(workspace.shootId) && requiresReview && !onApproveShoot)} onClick={() => void perform(async () => { const next = { ...withScope(), reviewedOutputIds: [...reviewed] }; await onSave(next); setConfig(next); if (workspace.shootId && requiresReview) await onApproveShoot?.(); setView('deliver'); })}>{workspace.shootId && requiresReview ? 'Approve shoot edits' : 'Finish review'}</Button></> : <><Button variant="outline" disabled={busy} onClick={() => void perform(async () => { const next = { ...withScope(), reviewedOutputIds: [...reviewed] }; await onSave(next); setConfig(next); setNotice('Recipe saved.'); })}>Save</Button><Button data-variant="primary" disabled={blocked} onClick={() => void perform(() => onGenerate(withScope()))}>{busy ? <Loader2 aria-hidden="true" className="" /> : <Sparkles />}{generateLabel}</Button></>;
  const providerTitle = staging ? 'Virtual staging' : tool === 'geometry' ? 'Lens & perspective' : tool === 'scene' ? 'Scene details' : preset.name;
  const settings = <>
    {!availability.ready && <p className="v4-inline-error">{availability.reason || 'This edit is not configured yet.'}</p>}
    <InspectorSection title={providerTitle}>
      {staging && active ? <VirtualStagingControls workspaceId={workspace.id} mediaId={active.id} config={config} patch={patchAdjustments} disabled={busy || running} /> : <PhotoServiceControls presetId={preset.id} section={tool === 'geometry' ? 'geometry' : tool === 'scene' ? 'scene' : 'style'} config={config} adjust={adjust} disabled={busy || running} />}
      {fullShoot ? <><p>All original photos are sent to Fotello. Each HDR stack becomes one edited image, saved automatically to this shoot’s Edited tab.</p><InspectorFact label="Original exposures" value={String(sourceMedia.length)} /><InspectorFact label="Edited images" value={String(outputCount)} /></> : <Button variant="outline" onClick={() => setScopeOpen(true)}>Apply to selected photos</Button>}
    </InspectorSection>
  </>;
  const reviewInspector = <>
    <InspectorSection title="Image size"><UpscalePhotoAction output={activeOutput} capabilities={capabilities} busy={busy || running} onUpscale={onUpscale ? (mediaId, outputId) => void perform(() => onUpscale(mediaId, outputId)) : undefined} /></InspectorSection>
    <InspectorSection title="Review summary"><div className="v4-review-count">{readyCount}<span> / {selected.length}</span></div><p>Photos reviewed</p><Button variant="outline" onClick={() => setHumanOpen(true)}><UserRound />Ask a human editor</Button></InspectorSection>
    {active && <InspectorSection title={active.name}><StudioImage className="v4-inspector-preview" src={activeOutput?.thumbnailUrl || activeOutput?.url || active.thumbnailUrl || active.url} alt={active.name} /><InspectorFact label="Current version" value={activeOutput ? `V${activeOutput.version}` : 'Original'} />{staging ? <Button variant="outline" disabled={blocked || !activeOutput} onClick={() => void perform(() => onGenerate(withScope()))}>Add arrangements</Button> : <Button variant="outline" disabled={!activeOutput || busy || running} onClick={() => openFeedback(active)}>Refine latest version</Button>}<Button variant="outline" disabled={!activeOutput} onClick={() => { setView('focus'); setComparing(true); }}>Compare with original</Button><Button variant="outline" disabled={!activeOutput || reviewed.has(activeOutput.id)} onClick={() => markReviewed(activeOutput)}><Check />{activeOutput && reviewed.has(activeOutput.id) ? 'Reviewed' : 'Use this photo'}</Button></InspectorSection>}
    <InspectorSection title="Versions">{activeVersions.length ? activeVersions.map(output => <button type="button" className="v4-version-row" key={output.id} aria-pressed={activeOutput?.id === output.id} onClick={() => { setVersionId(output.id); setView('focus'); setComparing(true); }}><StudioImage src={output.thumbnailUrl || output.url} alt="" /><span>Version {output.version}{output.label ? ` · ${output.label}` : ''}</span>{activeOutput?.id === output.id && <Check size={14} />}</button>) : <EmptyState icon="studio" title={<>No generated versions yet.</>} size="compact" />}</InspectorSection>
  </>;
  const custom = tool in customPhotoTitles;
  const broadEnhancement = ['full-shoot', 'listing-ready', 'color-correction'].includes(preset.id);
  const tabs = [
    { id: 'provider', label: staging ? 'Virtual staging' : 'Recipe', icon: SlidersHorizontal },
    ...(['listing-ready', 'color-correction'].includes(preset.id) ? [{ id: 'geometry', label: 'Lens & perspective', icon: Maximize2 }, { id: 'scene', label: 'Scene details', icon: Layers }] : []),
    ...(activeOutput ? [
      ...(fullShoot ? [{ id: 'repairs', label: 'Scene edits', icon: Layers }] : []),
      ...(broadEnhancement ? [{ id: 'light', label: 'Light & color', icon: Sun }, { id: 'tone', label: 'Tone', icon: Droplets }, { id: 'color', label: 'Color editor', icon: Palette }, { id: 'detail', label: 'Detail', icon: Sparkles }] : []),
      { id: 'crop', label: 'Crop & rotate', icon: Crop }, { id: 'privacy', label: 'Privacy', icon: Shield }, { id: 'marks', label: 'Pins & boundaries', icon: MapPin }, { id: 'brand', label: 'Branding & disclosure', icon: Type }, { id: 'review', label: 'Review & versions', icon: Check },
    ] : []),
    ...(!staging && preset.id !== 'upscale' ? [{ id: 'direction', label: 'Additional direction', icon: UserRound }] : []),
  ];
  const focusedTool = activeOutput ? tool : 'provider';
  const inspector = <div className="v4-tool-inspector"><nav className="v4-tool-rail" aria-label="Photo tools">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} title={label} aria-label={label} aria-pressed={focusedTool === id} onClick={() => { setTool(id as typeof tool); if (id !== 'review') { setView('configure'); if (activeOutput) setComparing(true); } }}><Icon size={19} /></button>)}</nav><div className="v4-tool-panel">{custom && activeOutput ? <CustomPhotoControls workspaceId={workspace.id} tool={tool as CustomPhotoTool} recipe={recipe} setRecipe={setRecipe} imageUrl={activeOutput.url} disabled={busy || running} /> : tool === 'repairs' && active ? <InspectorSection title="Scene edits"><p>Select the area to change. A new AI version will be created from the latest edit.</p>{[['TV screen', 'Replace only the selected TV screen with the reference image, if supplied; otherwise show a subtle natural landscape. Preserve the screen frame, reflections and perspective.'], ['Fireplace', 'Add a realistic, subtle fire only within the existing selected fireplace. Keep the hearth and all architecture unchanged.'], ['Grass', 'Make only the selected existing grass healthy green, retaining the original blades, shadows and lawn boundaries.'], ['Sky', 'Replace only the selected sky with a realistic clear sky matched to the existing light and horizon. Preserve all buildings, trees and foreground details.'], ['Remove object', 'Remove only the selected unwanted object and reconstruct the background naturally. Preserve architecture and every unselected object.']].map(([label, prompt]) => <Button key={label} variant="outline" disabled={busy || running || !customRevision?.ready} onClick={() => openFeedback(active, false, prompt)}>{label}</Button>)}{!customRevision?.ready && <p>{customRevision?.reason || 'Scene editing is not configured yet.'}</p>}</InspectorSection> : tool === 'direction' ? <InspectorSection title="Additional direction"><p>Describe a change for a new AI edit. Generated results need review.</p><Textarea value={config.prompt} onChange={event => setConfig(current => ({ ...current, prompt: event.target.value }))} placeholder="Describe anything specific to this property…" maxLength={4000} rows={4} /></InspectorSection> : tool === 'review' || view === 'gallery' || view === 'focus' || view === 'deliver' ? reviewInspector : settings}</div></div>;
  const spatial = Boolean(recipe.crop || recipe.blur?.length || recipe.marks?.length);
  const targets = spatial || applyScope === 'photo' ? activeOutput ? [{ mediaId: activeOutput.mediaId, outputId: activeOutput.id }] : [] : selected.flatMap(item => { const output = latest.get(item.id); return output ? [{ mediaId: item.id, outputId: output.id }] : []; });
  const inspectorFooter = <div className="v4-photo-apply"><div><strong>{custom ? 'Save custom edits' : `${selected.length} selected ${selected.length === 1 ? 'photo' : 'photos'}`}</strong><span>{custom ? `New version · ${targets.length} ${targets.length === 1 ? 'photo' : 'photos'}` : fullShoot ? `${sourceMedia.length} original exposures` : 'Review changes before delivery'}</span></div>{custom ? <><label className="v4-field">Apply edits to<select aria-label="Custom edit scope" disabled={busy || running} value={spatial ? 'photo' : applyScope} onChange={event => setApplyScope(event.target.value as typeof applyScope)}><option value="photo">This photo · chosen version</option><option value="selected" disabled={spatial}>Selected photos · latest versions</option></select></label>{spatial && <small>Area selections apply to this photo only.</small>}{previewError && <><p role="alert">{previewError}</p><Button variant="outline" onClick={() => setPreviewAttempt(value => value + 1)}>Retry preview</Button></>}<div className="v4-photo-apply-actions"><Button variant="outline" disabled={busy || running} onClick={() => setRecipe({})}>Reset</Button><Button data-variant="primary" disabled={busy || running || !onApplyEdits || !Object.keys(recipe).length || !targets.length || Boolean(previewError)} onClick={() => void perform(async () => { await onApplyEdits?.(recipe, spatial && activeOutput ? [{ mediaId: activeOutput.mediaId, outputId: activeOutput.id }] : targets); setRecipe({}); setVersionId(null); setTool('review'); setView('focus'); setComparing(true); setNotice('Custom edits saved as new versions.'); })}>Save new version</Button></div></> : <><Button variant="outline" disabled={fullShoot || busy || running} onClick={() => setScopeOpen(true)}>Choose photos</Button>{activeOutput && <Button variant="outline" onClick={() => { setTool('review'); setView('focus'); setComparing(true); }}>Review original</Button>}</>}</div>;
  const promptKey = `${workspace.id}:${active?.id}`;
  const editPrompt = editPrompts[promptKey] ?? '';
  const submitCustomEdit = async () => {
    if (!activeOutput || !active || !editPrompt.trim() || !customRevision?.ready || busy || running || refineLock.current) return;
    refineLock.current = true; setRefining(true);
    await perform(async () => {
      await onRefine({ mediaId: active.id, outputId: activeOutput.id, prompt: editPrompt.trim(), customEdit: true });
      setEditPrompts(current => ({ ...current, [promptKey]: '' }));
      setCustomEditOpen(false);
      customEditTrigger.current?.focus();
      setNotice('Custom edit submitted. Review the new version when it is ready.');
    });
    refineLock.current = false; setRefining(false);
  };
  if (!active) return <div className="v4-workspace-empty"><EmptyState icon="photos" title={<>No photos selected</>} size="compact" /><p>Choose images from a shoot or upload media to begin.</p><Button onClick={onChangeMedia}>Select media</Button></div>;
  return <><EditorShell compact title={custom ? 'Refine photo' : view === 'configure' ? 'Edit recipe' : view === 'deliver' ? 'Your edited photos' : view === 'gallery' ? 'Gallery review' : 'Photo review'} subtitle={`${preset.name} · ${custom ? 'Refine' : view === 'configure' ? 'Create' : view === 'deliver' ? 'Deliver' : 'Refine'}`} shootLabel={workspace.name} onBack={onBack} onChangeSource={onChangeMedia} status={Object.keys(recipe).length ? 'Unsaved custom edits' : running ? workspace.status === 'preparing' ? 'Preparing' : 'Generating' : dirty || reviewDirty ? 'Unsaved changes' : notice || 'Saved'} error={localError || error || workspace.error} modeControl={<div className="v4-mode-buttons v4-photo-view-switch"><Button size="sm" variant="ghost" aria-label="Gallery" title="Gallery" aria-pressed={view === 'gallery'} onClick={() => setView('gallery')}><Grid2X2 /><span className="sr-only">Gallery</span></Button><Button size="sm" variant="ghost" aria-label="Focus" title="Focus" aria-pressed={view === 'focus' || view === 'configure'} onClick={() => setView(outputs.size ? 'focus' : 'configure')}><Maximize2 /><span className="sr-only">Focus</span></Button></div>} actions={actions} inspector={inspector} inspectorFooter={inspectorFooter} filmstrip={<MediaFilmstrip label={groups?.length ? `Edited images · ${sourceMedia.length} original exposures` : 'Shoot images'} items={media.map(item => ({ id: item.id, name: item.name, url: outputs.get(item.id)?.thumbnailUrl || outputs.get(item.id)?.url || item.thumbnailUrl || item.url }))} selectedId={active.id} onSelect={id => openPhoto(media.find(item => item.id === id)!)} />}>
    {notice && <p className="v4-workspace-notice" role="status">{notice}</p>}
    {view === 'gallery' ? <><div className="v4-gallery-toolbar"><div className="v4-filter-tabs">{[['all', `All ${selected.length}`], ['review', `Needs review ${selected.length - readyCount}`], ['ready', `Ready ${readyCount}`]].map(([id, label]) => <button type="button" key={id} aria-pressed={galleryFilter === id} onClick={() => setGalleryFilter(id as typeof galleryFilter)}>{label}</button>)}</div>{staging ? <Button variant="outline" disabled={blocked || !outputs.get(active.id)} onClick={() => void perform(() => onGenerate(withScope()))}>Add arrangements</Button> : <Button variant="outline" disabled={!outputs.get(active.id) || busy || running} onClick={() => openFeedback(active)}>Refine selected</Button>}</div><div className="v4-photo-grid">{selected.filter(item => { const output = outputs.get(item.id), ready = output && reviewed.has(output.id); return galleryFilter === 'all' || (galleryFilter === 'ready' ? ready : !ready); }).map((item, index) => { const output = outputs.get(item.id), ready = output && reviewed.has(output.id); return <button type="button" className="v4-media-card" key={item.id} onClick={() => openPhoto(item)} aria-label={`Open ${item.name}`}><div className="v4-media-card-image"><StudioImage src={output?.url || item.thumbnailUrl || item.url} alt={item.name} loading="lazy" />{running && !(groups?.length && output) ? <MediaGenerationOverlay progress={workspace.progress} label={staging ? 'Staging job' : 'Photo editing job'} compact /> : <span className="v4-card-badge">{ready ? 'Ready' : output ? 'Review' : 'Original'}</span>}</div><div className="v4-card-caption"><strong>{item.name}</strong><small>{String(index + 1).padStart(2, '0')}</small></div><p>{output ? `Version ${output.version}${output.label ? ` · ${output.label}` : ''} · ${ready ? 'Reviewed' : 'Check original details'}` : 'Original source photo'}</p></button>; })}</div></> : view === 'deliver' ? <div className="v4-delivery-grid"><div className="v4-delivery-heading"><Check /><h2>Your photos are ready</h2><p>Download the versions you reviewed.</p></div>{selected.map(item => { const output = outputs.get(item.id); return output ? <div className="v4-download-row" key={item.id}><StudioImage src={output.thumbnailUrl || output.url} alt="" /><div><strong>{item.name}</strong><span>Version {output.version}</span></div><Button variant="outline" disabled={Boolean(downloadingId) || busy || running} onClick={() => void perform(() => downloadPhoto(output, item))}>{downloadingId === output.id ? <Loader2 aria-hidden="true" className="" /> : <Download />}{downloadingId === output.id ? 'Preparing…' : 'Download'}</Button></div> : null; })}</div> :
    <div className="v4-photo-focus" data-generating={activeGenerating}>
      {activeGenerating && <MediaGenerationOverlay key={active.id} progress={workspace.progress} label={workspace.status === 'preparing' ? 'Preparing photos' : staging ? 'Staging photos' : 'Editing photos'} fitToImage onRefresh={onRefresh} />}
      <PhotoComparison key={`comparison-${active.id}`} name={active.name} originalUrl={active.url} editedUrl={activeOutput ? preview?.outputId === activeOutput.id ? preview.url : activeOutput.url : undefined} version={activeOutput?.version} generating={activeGenerating} comparing={comparing} onComparingChange={setComparing} position={comparePosition} onPositionChange={setComparePosition} overlay={<>
        <button ref={customEditTrigger} type="button" className="v4-custom-edit-trigger" aria-label="Custom edit" title="Custom edit" aria-expanded={customEditOpen} aria-controls={customEditOpen ? 'photo-custom-edit-overlay' : undefined} disabled={busy || running || refining || !activeOutput} onClick={() => setCustomEditOpen(open => !open)}><Pencil size={16} aria-hidden="true" /></button>
        {customEditOpen && <form id="photo-custom-edit-overlay" className="v4-custom-edit-composer" aria-label="Custom edit instructions" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setCustomEditOpen(false); customEditTrigger.current?.focus(); } }} onSubmit={event => { event.preventDefault(); void submitCustomEdit(); }}>
          <div className="v4-custom-edit-heading"><label htmlFor="photo-custom-edit">Custom edit</label><button type="button" aria-label="Close custom edit" onClick={() => { setCustomEditOpen(false); customEditTrigger.current?.focus(); }}><X size={15} aria-hidden="true" /></button></div>
          <Textarea autoFocus id="photo-custom-edit" value={editPrompt} disabled={busy || running || refining} onChange={event => setEditPrompts(current => ({ ...current, [promptKey]: event.target.value }))} placeholder="Describe what to change..." maxLength={4000} rows={2} />
          <div className="v4-custom-edit-composer-actions"><Button type="button" variant="ghost" size="sm" disabled={busy || running || refining || !activeOutput} onClick={() => { setCustomEditOpen(false); openFeedback(active, false, editPrompt); }}><BoxSelect size={15} />Select area</Button><span>{!customRevision?.ready ? customRevision?.reason || 'AI refinement is not configured.' : ''}</span><Button type="submit" data-variant="primary" disabled={!editPrompt.trim() || !activeOutput || !customRevision?.ready || busy || running || refining} aria-label="Apply custom edit">{refining ? <Loader2 /> : <ArrowUp size={16} />}<span>Apply</span></Button></div>
        </form>}
      </>} />
      {(!comparing || !activeOutput) && <span className="v4-focus-badge">{!activeOutput ? 'Original' : `Version ${activeOutput.version}`}</span>}
    </div>}

  </EditorShell>
  {feedback && <FeedbackEditor key={`${feedback.id}-${feedbackPrompt}`} initialPrompt={feedbackPrompt} mediaId={feedback.id} name={feedback.name} imageUrl={latest.get(feedback.id)?.url || feedback.url} busy={busy || running} referenceMedia={media} referenceImagesEnabled={customRevision?.referenceImages} detectionReady={capabilities?.detection?.ready ?? false} detectionUnavailableReason={capabilities?.detection?.reason} revisionReady={customRevision?.ready ?? true} unavailableReason={customRevision?.reason} detectOnOpen={detectOnOpen} onClose={() => setFeedback(null)} onSubmit={async request => { await onRefine({ ...request, outputId: latest.get(request.mediaId)?.id, customEdit: true }); setEditPrompts(current => ({ ...current, [promptKey]: '' })); }} onDetect={onDetect} />}
  <Dialog open={scopeOpen} onOpenChange={setScopeOpen}><DialogContent className="v4-editor-dialog v4-scope-dialog"><DialogTitle>Apply this recipe to photos</DialogTitle><DialogDescription>{selected.length} selected. Choose the exact photos to edit together.</DialogDescription><div className="v4-scope-grid">{media.map(item => <button type="button" key={item.id} aria-pressed={selectedIds.has(item.id)} onClick={() => toggleScope(item.id)}><StudioImage src={item.thumbnailUrl || item.url} alt="" /><span>{selectedIds.has(item.id) && <Check size={16} />}{item.name}</span></button>)}</div><Button data-variant="primary" disabled={!selected.length} onClick={() => setScopeOpen(false)}>Use {selected.length} photos</Button></DialogContent></Dialog>
  <Dialog open={humanOpen} onOpenChange={setHumanOpen}><DialogContent className="v4-editor-dialog"><DialogTitle>Ask a human editor</DialogTitle><DialogDescription>Send the editing team a request for {active.name}.</DialogDescription><Textarea value={humanNote} onChange={event => setHumanNote(event.target.value)} placeholder="Describe the issue and the result you need." maxLength={4000} rows={4} /><Button data-variant="primary" disabled={!humanNote.trim() || humanBusy} onClick={() => void requestHuman()}>{humanBusy && <Loader2 aria-hidden="true" className="" />}Send request</Button></DialogContent></Dialog>
  </>;
}
