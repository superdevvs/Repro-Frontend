import { StudioImage } from '@/components/studio/v4/StudioImage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Download, Grid2X2, Loader2, Maximize2, RefreshCw, ScanSearch, Share2, SlidersHorizontal, Sparkles, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { BeforeAfterControl } from '@/components/studio/BeforeAfterControl';
import { submitEditingRequest } from '@/services/editingRequestService';
import type { V4Config, V4Media, V4Output, V4WorkspaceProps } from '@/components/studio/v4/types';
import { EditorShell, InspectorFact, InspectorSection, MediaFilmstrip } from './EditorShell';
import { FeedbackEditor } from './FeedbackEditor';
import { isWorkspaceRunning, latestOutputs, reviewedOutputs } from './workspaceLogic';
import { useWorkspaceDraft } from './useWorkspaceDraft';
import { shareOutputs } from './shareOutput';
import { downloadWorkspaceOutput } from './downloadOutput';

const LOOKS = ['Natural', 'Bright', 'Editorial'];

export function PhotoWorkspace({ workspace, preset, busy, error, onBack, onChangeMedia, onSave, onGenerate, onRefine, onCancel, onRefresh, onDetect }: V4WorkspaceProps) {
  const media = workspace.media.filter(item => item.kind !== 'video');
  const { config, setConfig, dirty } = useWorkspaceDraft(workspace);
  const [activeId, setActiveId] = useState(media[0]?.id || '');
  const [view, setView] = useState<'configure' | 'gallery' | 'focus' | 'deliver'>(workspace.outputs.length ? 'gallery' : 'configure');
  const [comparison, setComparison] = useState<'before' | 'after' | 'compare'>('before');
  const [comparePosition, setComparePosition] = useState(50);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set(workspace.config.reviewedOutputIds || []));
  const reviewDirty = JSON.stringify([...reviewed].sort()) !== JSON.stringify([...(workspace.config.reviewedOutputIds || [])].sort());
  const [feedback, setFeedback] = useState<V4Media | null>(null);
  const [detectOnOpen, setDetectOnOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
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
  const selectedIds = useMemo(() => new Set(config.frames.map(frame => frame.mediaId)), [config.frames]);
  const selected = media.filter(item => selectedIds.has(item.id));
  const activeVersions = workspace.outputs.filter(output => output.mediaId === active?.id && output.kind === 'image' && output.url && ['completed', 'ready'].includes(output.status)).sort((a, b) => b.version - a.version);
  const activeOutput = activeVersions.find(output => output.id === versionId) || outputs.get(active?.id);
  const readyCount = selected.filter(item => { const output = outputs.get(item.id); return output && reviewed.has(output.id); }).length;
  const fullShoot = /full.?shoot|raw/i.test(preset.id + preset.name);
  const staging = /stag/i.test(preset.id + preset.name);
  const bracketSize = 1;
  const outputCount = Math.ceil(selected.length / bracketSize);
  const invalidBrackets = bracketSize > 1 && selected.length % bracketSize !== 0;
  const blocked = busy || running || selected.length === 0 || invalidBrackets;

  useEffect(() => {
    if (workspace.status === 'completed' && previousStatus.current === 'generating') { setView('gallery'); setComparison('after'); }
    previousStatus.current = workspace.status;
  }, [workspace.status]);
  useEffect(() => { if (dirty || reviewDirty) setNotice(''); }, [dirty, reviewDirty]);

  const adjust = (key: string, value: string | number | boolean) => setConfig(current => ({ ...current, adjustments: { ...current.adjustments, [key]: value } }));
  const withScope = (): V4Config => ({ ...config, frames: selected.map(item => ({ mediaId: item.id, duration: 5, method: 'fit' })) });
  const perform = async (action: () => Promise<void>) => { setLocalError(''); setNotice(''); try { await action(); } catch (reason) { setLocalError(reason instanceof Error ? reason.message : 'The edit could not be completed. Please try again.'); } };
  const openPhoto = (item: V4Media) => { setActiveId(item.id); setVersionId(null); setComparison(outputs.has(item.id) ? 'after' : 'before'); setView(outputs.has(item.id) ? 'focus' : 'configure'); };
  const toggleScope = (id: string) => {
    const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id);
    setConfig(current => ({ ...current, frames: media.filter(item => next.has(item.id)).map(item => ({ mediaId: item.id, duration: 5, method: 'fit' })) }));
  };
  const markReviewed = (output?: V4Output) => {
    if (!output) return;
    const siblings = new Set(workspace.outputs.filter(item => item.mediaId === output.mediaId).map(item => item.id));
    setReviewed(current => new Set([...current].filter(id => !siblings.has(id)).concat(output.id)));
  };
  const openFeedback = (item: V4Media, detect = false) => { setDetectOnOpen(detect); setFeedback(item); };
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

  const actions = running ? <><Button variant="outline" onClick={() => void perform(onCancel)} disabled={busy}>Cancel job</Button><Button data-variant="primary" disabled><Loader2 className="animate-spin" />Editing photos</Button></> : view === 'deliver' ? <><Button variant="outline" onClick={() => setView('gallery')}>Back to review</Button><Button data-variant="primary" disabled={!readyCount || busy} onClick={() => void perform(shareReviewed)}><Share2 />Share photos</Button></> : view === 'gallery' || view === 'focus' ? <><Button variant="outline" onClick={() => setView('configure')}><SlidersHorizontal />Edit recipe</Button><Button data-variant="primary" disabled={readyCount !== selected.length || selected.length === 0} onClick={() => void perform(async () => { const next = { ...withScope(), reviewedOutputIds: [...reviewed] }; await onSave(next); setConfig(next); setView('deliver'); })}>Finish review</Button></> : <><Button variant="outline" disabled={busy} onClick={() => void perform(async () => { const next = { ...withScope(), reviewedOutputIds: [...reviewed] }; await onSave(next); setConfig(next); setNotice('Recipe saved.'); })}>Save</Button><Button data-variant="primary" disabled={blocked} onClick={() => void perform(() => onGenerate(withScope()))}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}Generate {outputCount} {outputCount === 1 ? 'photo' : 'photos'}</Button></>;

  const settings = <>
    <InspectorSection title={staging ? 'Staging style' : 'Photo style'}>
      {staging ? <><label className="v4-field">Room type<select value={String(config.adjustments.roomType || 'living-room')} onChange={event => adjust('roomType', event.target.value)}><option value="living-room">Living room</option><option value="bedroom">Bedroom</option><option value="dining-room">Dining room</option><option value="office">Office</option></select></label><label className="v4-field">Furniture style<select value={String(config.adjustments.furnitureStyle || 'modern')} onChange={event => adjust('furnitureStyle', event.target.value)}><option value="modern">Modern</option><option value="scandinavian">Scandinavian</option><option value="editorial">Contemporary</option><option value="traditional">Traditional</option></select></label></> : <><p>Balanced rooms and true-to-life color.</p><div className="v4-look-options">{LOOKS.map(look => <button type="button" key={look} aria-pressed={String(config.adjustments.look || 'Natural') === look} onClick={() => adjust('look', look)}><StudioImage src={active?.thumbnailUrl || active?.url} alt="" /><span>{look}</span></button>)}</div></>}
      <Button variant="outline" onClick={() => setScopeOpen(true)}>Apply to selected photos</Button>
    </InspectorSection>
    <InspectorSection title="Included edits"><span className="v4-included"><Check />White balance & exposure</span><span className="v4-included"><Check />Window frames & detail</span><span className="v4-included"><Check />Preserve the architecture</span></InspectorSection>
    <InspectorSection title="Make it yours"><p>Guide the AI edit. Changes appear in the generated result.</p>{[['brightness', 'Brightness', -30, 30, 0], ['warmth', 'Warmth', -30, 30, 0], ['windows', 'Window recovery', 0, 100, 50]].map(([key, label, min, max, initial]) => <label className="v4-slider-field" key={String(key)}><span>{label}<output>{Number(config.adjustments[String(key)] ?? initial)}</output></span><input type="range" min={Number(min)} max={Number(max)} value={Number(config.adjustments[String(key)] ?? initial)} onChange={event => adjust(String(key), Number(event.target.value))} /></label>)}
      <Button variant="outline" aria-expanded={advanced} onClick={() => setAdvanced(value => !value)}>Advanced controls<ChevronDown /></Button>
      {advanced && <><label className="v4-switch-field">Lens correction<Switch checked={config.adjustments.lensCorrection !== false} onCheckedChange={value => adjust('lensCorrection', value)} /></label><label className="v4-switch-field">Straighten verticals<Switch checked={config.adjustments.verticalCorrection !== false} onCheckedChange={value => adjust('verticalCorrection', value)} /></label></>}
      {fullShoot && <label className="v4-field">RAW processing<select value={1} disabled><option value={1}>Enhance each image</option><option value={3} disabled>3-exposure merge · unavailable</option><option value={5} disabled>5-exposure merge · unavailable</option></select><span>RAW files are developed individually. Bracket merging is not available in this workflow.</span></label>}
    </InspectorSection>
    <InspectorSection title="Additional direction"><Textarea value={config.prompt} onChange={event => setConfig(current => ({ ...current, prompt: event.target.value }))} placeholder="Describe anything specific to this property…" maxLength={4000} rows={3} /><InspectorFact label="Apply to" value={`${selected.length} selected ${fullShoot ? 'source images' : 'photos'}`} />{fullShoot && <InspectorFact label="Expected output" value={`${outputCount} photos`} />}{invalidBrackets && <p className="v4-inline-error">Choose a complete set of {bracketSize}-exposure brackets.</p>}</InspectorSection>
  </>;

  const inspector = view === 'configure' ? settings : <>
    <InspectorSection title="Review summary"><div className="v4-review-count">{readyCount}<span> / {selected.length}</span></div><p>Photos reviewed</p><Button variant="outline" onClick={() => setHumanOpen(true)}><UserRound />Ask a human editor</Button></InspectorSection>
    {active && <InspectorSection title={active.name}><StudioImage className="v4-inspector-preview" src={activeOutput?.thumbnailUrl || activeOutput?.url || active.thumbnailUrl || active.url} alt={active.name} /><InspectorFact label="Current version" value={activeOutput ? `V${activeOutput.version}` : 'Original'} /><Button variant="outline" disabled={!activeOutput || busy || running} onClick={() => openFeedback(active)}>Refine latest version</Button><Button variant="outline" disabled={!activeOutput} onClick={() => { setView('focus'); setComparison('compare'); }}>Compare with original</Button><Button variant="outline" disabled={!activeOutput || reviewed.has(activeOutput.id)} onClick={() => markReviewed(activeOutput)}><Check />{activeOutput && reviewed.has(activeOutput.id) ? 'Reviewed' : 'Use this photo'}</Button></InspectorSection>}
    <InspectorSection title="Versions">{activeVersions.length ? activeVersions.map(output => <button type="button" className="v4-version-row" key={output.id} aria-pressed={activeOutput?.id === output.id} onClick={() => { setVersionId(output.id); setView('focus'); setComparison('after'); }}><StudioImage src={output.thumbnailUrl || output.url} alt="" /><span>Version {output.version}</span>{activeOutput?.id === output.id && <Check size={14} />}</button>) : <p>No generated versions yet.</p>}</InspectorSection>
  </>;

  if (!active) return <div className="v4-workspace-empty"><h2>No photos selected</h2><p>Choose images from a shoot or upload media to begin.</p><Button onClick={onChangeMedia}>Select media</Button></div>;

  return <><EditorShell title={view === 'configure' ? 'Edit recipe' : view === 'deliver' ? 'Your edited photos' : view === 'gallery' ? 'Gallery review' : 'Photo review'} subtitle={`${preset.name} · ${view === 'configure' ? 'Create' : view === 'deliver' ? 'Deliver' : 'Refine'}`} shootLabel={workspace.name} onBack={onBack} onChangeSource={onChangeMedia} status={running ? workspace.status === 'preparing' ? 'Preparing' : 'Generating' : dirty || reviewDirty ? 'Unsaved changes' : notice || 'Saved'} error={localError || error || workspace.error} modeControl={<div className="v4-mode-buttons"><Button size="sm" variant="outline" aria-pressed={view === 'gallery'} onClick={() => setView('gallery')}><Grid2X2 />Gallery</Button><Button size="sm" variant="outline" aria-pressed={view === 'focus' || view === 'configure'} onClick={() => setView(outputs.size ? 'focus' : 'configure')}><Maximize2 />Focus</Button></div>} actions={actions} inspector={inspector} filmstrip={<MediaFilmstrip items={media.map(item => ({ id: item.id, name: item.name, url: outputs.get(item.id)?.thumbnailUrl || item.thumbnailUrl || item.url }))} selectedId={active.id} onSelect={id => openPhoto(media.find(item => item.id === id)!)} />}>
    {notice && <p className="v4-workspace-notice" role="status">{notice}</p>}
    {running && <div className="v4-generation-banner" role="status"><Loader2 className="animate-spin" /><div><strong>Editing your property photos</strong><p>{workspace.progress == null ? 'Updates appear as each photo is ready.' : `${Math.round(workspace.progress)}% complete`}</p></div><Button variant="outline" onClick={onRefresh}><RefreshCw />Refresh</Button></div>}
    {view === 'gallery' ? <><div className="v4-gallery-toolbar"><div className="v4-filter-tabs">{[['all', `All ${selected.length}`], ['review', `Needs review ${selected.length - readyCount}`], ['ready', `Ready ${readyCount}`]].map(([id, label]) => <button type="button" key={id} aria-pressed={galleryFilter === id} onClick={() => setGalleryFilter(id as typeof galleryFilter)}>{label}</button>)}</div><Button variant="outline" disabled={!outputs.get(active.id) || busy || running} onClick={() => openFeedback(active)}>Refine selected</Button></div><div className="v4-photo-grid">{selected.filter(item => { const output = outputs.get(item.id), ready = output && reviewed.has(output.id); return galleryFilter === 'all' || (galleryFilter === 'ready' ? ready : !ready); }).map((item, index) => { const output = outputs.get(item.id), ready = output && reviewed.has(output.id); return <button type="button" className="v4-media-card" key={item.id} onClick={() => openPhoto(item)} aria-label={`Open ${item.name}`}><div className="v4-media-card-image"><StudioImage src={output?.url || item.thumbnailUrl || item.url} alt={item.name} loading="lazy" /><span className="v4-card-badge">{ready ? 'Ready' : output ? 'Review' : running ? 'Processing' : 'Original'}</span></div><div className="v4-card-caption"><strong>{item.name}</strong><small>{String(index + 1).padStart(2, '0')}</small></div><p>{output ? `Version ${output.version} · ${ready ? 'Reviewed' : 'Check original details'}` : 'Original source photo'}</p></button>; })}</div></> : view === 'deliver' ? <div className="v4-delivery-grid"><div className="v4-delivery-heading"><Check /><h2>Your photos are ready</h2><p>Download the versions you reviewed.</p></div>{selected.map(item => { const output = outputs.get(item.id); return output ? <div className="v4-download-row" key={item.id}><StudioImage src={output.thumbnailUrl || output.url} alt="" /><div><strong>{item.name}</strong><span>Version {output.version}</span></div><Button variant="outline" disabled={Boolean(downloadingId) || busy || running} onClick={() => void perform(() => downloadPhoto(output, item))}>{downloadingId === output.id ? <Loader2 className="animate-spin" /> : <Download />}{downloadingId === output.id ? 'Preparing…' : 'Download'}</Button></div> : null; })}</div> : <div className="v4-photo-focus"><StudioImage src={comparison === 'before' || !activeOutput ? active.url : activeOutput.url} alt={`${active.name} ${comparison === 'before' || !activeOutput ? 'original' : 'edited'}`} />{comparison === 'compare' && activeOutput && <><StudioImage className="v4-compare-original" src={active.url} alt="Original for comparison" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }} /><BeforeAfterControl position={comparePosition} onPositionChange={setComparePosition} /></>}<div className="v4-comparison-tabs">{(['before', 'after', 'compare'] as const).map(mode => <button type="button" key={mode} disabled={mode !== 'before' && !activeOutput} aria-pressed={comparison === mode} onClick={() => setComparison(mode)}>{mode === 'before' ? 'Before' : mode === 'after' ? 'After' : 'Compare'}</button>)}</div><Button className="v4-canvas-detect" variant="outline" disabled={busy || running} onClick={() => openFeedback(active, true)}><ScanSearch />Detect areas</Button><span className="v4-focus-badge">{comparison === 'before' || !activeOutput ? 'Original' : `Version ${activeOutput.version}`}</span></div>}
  </EditorShell>
  {feedback && <FeedbackEditor key={feedback.id} mediaId={feedback.id} name={feedback.name} imageUrl={latest.get(feedback.id)?.url || feedback.url} busy={busy || running} detectOnOpen={detectOnOpen} onClose={() => setFeedback(null)} onSubmit={onRefine} onDetect={onDetect} />}
  <Dialog open={scopeOpen} onOpenChange={setScopeOpen}><DialogContent className="v4-editor-dialog v4-scope-dialog"><DialogTitle>Apply this recipe to photos</DialogTitle><DialogDescription>{selected.length} selected. Choose the exact photos to edit together.</DialogDescription><div className="v4-scope-grid">{media.map(item => <button type="button" key={item.id} aria-pressed={selectedIds.has(item.id)} onClick={() => toggleScope(item.id)}><StudioImage src={item.thumbnailUrl || item.url} alt="" /><span>{selectedIds.has(item.id) && <Check size={16} />}{item.name}</span></button>)}</div><Button data-variant="primary" disabled={!selected.length} onClick={() => setScopeOpen(false)}>Use {selected.length} photos</Button></DialogContent></Dialog>
  <Dialog open={humanOpen} onOpenChange={setHumanOpen}><DialogContent className="v4-editor-dialog"><DialogTitle>Ask a human editor</DialogTitle><DialogDescription>Send the editing team a request for {active.name}.</DialogDescription><Textarea value={humanNote} onChange={event => setHumanNote(event.target.value)} placeholder="Describe the issue and the result you need." maxLength={4000} rows={4} /><Button data-variant="primary" disabled={!humanNote.trim() || humanBusy} onClick={() => void requestHuman()}>{humanBusy && <Loader2 className="animate-spin" />}Send request</Button></DialogContent></Dialog>
  </>;
}
