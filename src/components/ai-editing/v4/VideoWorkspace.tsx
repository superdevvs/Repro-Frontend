import { StudioImage } from '@/components/studio/v4/StudioImage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, Download, Loader2, Play, RefreshCw, Settings2, Share2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StudioRatio, V4Config, V4Frame, V4Media, V4WorkspaceProps } from '@/components/studio/v4/types';
import { EditorShell, InspectorFact, InspectorSection, MediaFilmstrip } from './EditorShell';
import { FramePreparation, FramePreview } from './FramePreparation';
import { FeedbackEditor } from './FeedbackEditor';
import { VideoStyling } from './VideoStyling';
import { currentPreparedFrame, FRAME_SECONDS, isWorkspaceRunning, methodLabel, prepareMethod, RATIO_VALUES, selectedFrames } from './workspaceLogic';
import { useWorkspaceDraft } from './useWorkspaceDraft';
import { shareOutputs } from './shareOutput';
import { downloadWorkspaceOutput } from './downloadOutput';

type Step = 'setup' | 'media' | 'prepare' | 'review' | 'style' | 'result';
const TITLES: Record<Step, string> = { setup: 'Output', media: 'Choose your story', prepare: 'Extend & crop frames', review: 'Prepared frames', style: 'Style your reel', result: 'Final review' };
const formatTime = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;

export function VideoWorkspace({ workspace, preset, busy, error, onBack, onChangeMedia, onSave, onPrepare, onGenerate, onRefine, onCancel, onRefresh, onDetect }: V4WorkspaceProps) {
  const media = workspace.media.filter(item => item.kind !== 'video');
  const { config, setConfig } = useWorkspaceDraft(workspace);
  const [step, setStep] = useState<Step>(workspace.outputs.some(output => output.kind === 'video' && output.url) ? 'result' : workspace.preparedFrames.length ? 'review' : 'setup');
  const [activeId, setActiveId] = useState(media[0]?.id || '');
  const [feedback, setFeedback] = useState<V4Media | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set(workspace.config.reviewedFrameIds || []));
  const [dimensions, setDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');
  const [notice, setNotice] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [playback, setPlayback] = useState(0);
  const previousStatus = useRef(workspace.status);
  const video = useRef<HTMLVideoElement>(null);
  const running = isWorkspaceRunning(workspace.status);
  const frames = selectedFrames(config, media);
  const selectedIds = new Set(frames.map(frame => frame.mediaId));
  const active = media.find(item => item.id === activeId) || media[0];
  const activeFrame = frames.find(frame => frame.mediaId === active?.id);
  const requiredScenes = Math.max(1, Math.round(config.duration / FRAME_SECONDS));
  const exactSelection = frames.length === requiredScenes;
  const prepared = useMemo(() => new Map(frames.map(frame => [frame.mediaId, config.ratio === workspace.config.ratio ? currentPreparedFrame(workspace.preparedFrames, frame.mediaId, frame.method, config.ratio) : undefined])), [workspace.preparedFrames, workspace.config.ratio, config.ratio, frames]);
  const readyFrames = frames.filter(frame => prepared.get(frame.mediaId));
  const reviewKey = (frame: V4Frame) => `${frame.mediaId}:${prepared.get(frame.mediaId)?.version}:${frame.method}:${config.ratio}`;
  const reviewedCount = frames.filter(frame => reviewed.has(reviewKey(frame))).length;
  const allPrepared = exactSelection && frames.length > 0 && readyFrames.length === frames.length;
  const allReviewed = allPrepared && reviewedCount === frames.length;
  const failedPreparation = workspace.status === 'failed' && !allPrepared;
  const generation = workspace.generation;
  const generationCopy = generation?.phase === 'rendering' ? 'Your clips are ready. Rendering the final reel…'
    : generation ? `${generation.completed} of ${generation.total} clips ready · ${generation.submitted} submitted. Queued clips will start as capacity becomes available.`
    : 'Your job is processing. This can take several minutes; you can leave and return from History.';
  const videoOutputs = workspace.outputs.filter(output => output.kind === 'video' && output.url && ['completed', 'ready'].includes(output.status)).sort((a, b) => b.version - a.version);
  const output = videoOutputs.find(item => item.id === selectedOutputId) || videoOutputs[0];
  const block = busy || running;

  useEffect(() => {
    if (workspace.status === 'completed' && previousStatus.current === 'generating') setStep('result');
    if (workspace.status === 'ready' && previousStatus.current === 'preparing') setStep('review');
    previousStatus.current = workspace.status;
  }, [workspace.status]);

  const perform = async (action: () => Promise<void>, after?: () => void) => {
    setLocalError(''); setNotice('');
    try { await action(); after?.(); } catch (reason) { setLocalError(reason instanceof Error ? reason.message : 'The job could not be started. Your choices are still saved here.'); }
  };
  const shareVideo = async () => {
    if (!output) return;
    const result = await shareOutputs(`${workspace.name} · Version ${output.version}`, [{ name: `${preset.name} · Version ${output.version}`, url: output.url }]);
    if (result !== 'cancelled') setNotice(result === 'shared' ? `Version ${output.version} shared.` : `Version ${output.version} link copied.`);
  };
  const downloadVideo = async () => {
    if (!output || downloading) return;
    setDownloading(true);
    try { await downloadWorkspaceOutput(workspace.id, output, `${workspace.name} ${preset.name}`); setNotice(`Download started for version ${output.version}.`); }
    finally { setDownloading(false); }
  };
  const selectMedia = (item: V4Media) => {
    setActiveId(item.id);
    setConfig(current => {
      const existing = selectedFrames(current, media);
      if (existing.some(frame => frame.mediaId === item.id)) return { ...current, frames: existing.filter(frame => frame.mediaId !== item.id) };
      return { ...current, frames: [...existing, { mediaId: item.id, duration: FRAME_SECONDS, method: prepareMethod(dimensions[item.id]?.width || 0, dimensions[item.id]?.height || 0, current.ratio) }] };
    });
  };
  const changeRatio = (ratio: StudioRatio) => {
    setConfig(current => ({ ...current, ratio, frames: selectedFrames(current, media).map(frame => ({ ...frame, method: prepareMethod(dimensions[frame.mediaId]?.width || 0, dimensions[frame.mediaId]?.height || 0, ratio) })) }));
    setReviewed(new Set());
  };
  const move = (index: number, by: number) => {
    const next = [...frames]; const to = index + by; if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]]; setConfig(current => ({ ...current, frames: next }));
  };
  const focusScene = (id: string) => {
    setActiveId(id);
    if (step === 'result' && video.current) { const index = frames.findIndex(frame => frame.mediaId === id); if (index >= 0) video.current.currentTime = index * FRAME_SECONDS; }
  };
  const markReviewed = (frame: V4Frame) => { if (prepared.get(frame.mediaId)) setReviewed(previous => new Set([...previous, reviewKey(frame)])); };
  const goBack = () => {
    const previous: Record<Step, Step | null> = { setup: null, media: 'setup', prepare: 'media', review: 'prepare', style: 'review', result: 'review' };
    if (previous[step]) setStep(previous[step]!); else onBack();
  };
  const hasText = config.text.style !== 'none';
  const validStyle = !hasText || Boolean(config.text.title.trim() || config.text.subtitle.trim());

  const primary = failedPreparation ? <Button data-variant="primary" disabled={!exactSelection || block} onClick={() => void perform(() => onPrepare({ ...config, frames }), () => setStep('review'))}><RefreshCw />Retry frame preparation</Button> : step === 'setup' ? <Button data-variant="primary" disabled={!media.length || block} onClick={() => setStep('media')}>Choose {requiredScenes} scenes</Button> : step === 'media' ? <Button data-variant="primary" disabled={!exactSelection || block} onClick={() => setStep('prepare')}>Use {frames.length} scenes</Button> : step === 'prepare' ? <Button data-variant="primary" disabled={!exactSelection || block} onClick={() => void perform(() => onPrepare({ ...config, frames }), () => setStep('review'))}><Sparkles />Prepare {frames.length} frames</Button> : step === 'review' ? <Button data-variant="primary" disabled={!allReviewed || block} onClick={() => void perform(async () => { const next = { ...config, reviewedFrameIds: [...reviewed] }; await onSave(next); setConfig(next); setStep('style'); })}>Use {frames.length} frames</Button> : step === 'style' ? <Button data-variant="primary" disabled={!allReviewed || !validStyle || block} onClick={() => void perform(() => onGenerate({ ...config, frames }))}><Play />Generate {config.duration}s reel</Button> : output ? <Button data-variant="primary" disabled={downloading || block} onClick={() => void perform(downloadVideo)}>{downloading ? <Loader2 className="animate-spin" /> : <Download />}{downloading ? 'Preparing download…' : 'Download reel'}</Button> : <Button data-variant="primary" disabled>No output yet</Button>;
  const actions = running ? <><Button variant="outline" disabled={busy} onClick={() => void perform(onCancel)}>Cancel job</Button><Button data-variant="primary" disabled><Loader2 className="animate-spin" />{workspace.status === 'preparing' ? 'Preparing frames' : 'Generating reel'}</Button></> : <>{step !== 'setup' && step !== 'result' && <Button variant="outline" disabled={busy} onClick={goBack}><ChevronLeft />Back</Button>}{step === 'result' && output && <Button variant="outline" onClick={() => void perform(shareVideo)}><Share2 />Share reel</Button>}{primary}</>;

  const inspector = <>
    <InspectorSection title={step === 'result' ? 'Walkthrough review' : 'Selected preset'}>{step !== 'result' && <><StudioImage className="v4-inspector-preview" src={media[0]?.thumbnailUrl || media[0]?.url} alt="" /><strong className="v4-inspector-preset-name">{preset.name}</strong><p>{preset.description}</p></>}<InspectorFact label="Duration" value={`${config.duration} seconds`} /><InspectorFact label="Format" value={config.ratio} /><InspectorFact label="Story scenes" value={`${frames.length} / ${requiredScenes}`} />{step === 'result' && <InspectorFact label="Playback" value={`${formatTime(playback)} / ${formatTime(config.duration)}`} />}</InspectorSection>
    {active && <InspectorSection title={active.name}>{activeFrame && <InspectorFact label="Preparation" value={methodLabel(activeFrame.method)} />}{['review', 'style', 'result'].includes(step) && <><StudioImage className="v4-inspector-preview" src={prepared.get(active.id)?.url || active.thumbnailUrl || active.url} alt={active.name} /><Button variant="outline" disabled={block || !prepared.get(active.id)} onClick={() => setFeedback(active)}>Refine this frame</Button><Button variant="outline" disabled={block} onClick={() => setStep('prepare')}>Change preparation</Button>{step === 'review' && activeFrame && <Button variant="outline" disabled={!prepared.get(active.id) || reviewed.has(reviewKey(activeFrame)) || block} onClick={() => markReviewed(activeFrame)}><Check />{reviewed.has(reviewKey(activeFrame)) ? 'Reviewed' : 'Use this frame'}</Button>}</>}</InspectorSection>}
    {step === 'review' && <InspectorSection title="Frame review"><div className="v4-review-count">{reviewedCount}<span> / {frames.length}</span></div><p>Check every frame before generating motion.</p>{!allPrepared && <Button variant="outline" onClick={onRefresh}><RefreshCw />Refresh prepared frames</Button>}</InspectorSection>}
    {step === 'style' && <InspectorSection title="Composition"><InspectorFact label="Transitions" value={config.transition === 'none' ? 'No effect' : config.transition} /><InspectorFact label="Text" value={config.text.style === 'none' ? 'No text' : config.text.style} /><Button variant="outline" disabled={block} onClick={() => void perform(async () => { await onSave(config); setNotice('Styling saved.'); })}>Save styling</Button><div className="v4-inspector-note"><strong>Review before generating</strong>Generating creates a new video version from your selected frames and styling.</div></InspectorSection>}
    {step === 'result' && <><InspectorSection title="Versions">{videoOutputs.map(item => <button type="button" key={item.id} className="v4-version-row" aria-pressed={output?.id === item.id} onClick={() => setSelectedOutputId(item.id)}>{item.thumbnailUrl ? <StudioImage src={item.thumbnailUrl} alt="" /> : <Play size={20} />}<span>Version {item.version}</span>{output?.id === item.id && <Check size={14} />}</button>)}</InspectorSection><Button variant="outline" disabled={block} onClick={() => setStep('style')}><Settings2 />Edit styling</Button></>}
    <div className="v4-inspector-note"><strong>Originals stay intact</strong>Prepared images and generated videos are separate versions of your source media.</div>
  </>;

  if (!active) return <div className="v4-workspace-empty"><h2>Choose images for your video</h2><p>Start with property photos from a shoot or your uploads.</p><Button onClick={onChangeMedia}>Select media</Button></div>;

  const stripItems = (frames.length ? frames.map(frame => media.find(item => item.id === frame.mediaId)!).filter(Boolean) : media).map(item => ({ id: item.id, name: item.name, url: prepared.get(item.id)?.url || item.thumbnailUrl || item.url, detail: '0:05' }));
  return <><EditorShell title={TITLES[step]} subtitle={`${preset.name} · ${['setup', 'media', 'prepare'].includes(step) ? 'Create' : step === 'result' ? 'Deliver' : 'Refine'}`} shootLabel={workspace.name} onBack={goBack} onChangeSource={onChangeMedia} actions={actions} status={running ? workspace.status : notice || `${frames.length} scenes · ${config.duration}s`} error={localError || error || workspace.error} inspector={inspector} filmstrip={<MediaFilmstrip items={stripItems} selectedId={active.id} onSelect={focusScene} label={frames.length ? 'Story scenes' : 'Source images'} />}>
    {notice && <p className="v4-workspace-notice" role="status">{notice}</p>}
    {failedPreparation && <div className="v4-prep-note" role="status"><strong>Frame preparation stopped</strong><p>{readyFrames.length} of {frames.length} frames are ready. Retry to finish preparation; completed frames stay saved.</p></div>}
    {running ? <div className="v4-generating-stage"><div className="v4-generating-preview"><FramePreview media={active} method={activeFrame?.method || 'crop'} ratio={config.ratio} resultUrl={workspace.status === 'generating' ? prepared.get(active.id)?.url : undefined} /><div className="v4-generating-indicator"><Loader2 className="animate-spin" /></div></div><h2>{workspace.status === 'preparing' ? 'Preparing your frames' : 'Creating your property video'}</h2><p>{workspace.status === 'generating' ? generationCopy : 'AI Extend and crop preparation are processing. Completed frames appear here as they become ready.'}</p>{workspace.progress != null && <p>{Math.min(100, Math.max(0, Math.round(workspace.progress)))}% complete</p>}<Button variant="outline" onClick={onRefresh}><RefreshCw />Refresh status</Button></div> : step === 'setup' ? <div className="v4-video-setup"><FramePreview media={active} method="crop" ratio={config.ratio} /><div className="v4-video-setup-controls"><h2>How will you share it?</h2><label className="v4-field">Duration<div className="v4-choice-row">{[15, 30, 45, 60].map(duration => <Button key={duration} variant="outline" aria-pressed={config.duration === duration} onClick={() => setConfig(current => ({ ...current, duration }))}>{duration}s</Button>)}</div></label><p className="v4-muted">A {config.duration}-second story uses {requiredScenes} scenes of 5 seconds each.</p><div className="v4-field">Format<div className="v4-format-grid">{(Object.keys(RATIO_VALUES) as StudioRatio[]).map(ratio => <button key={ratio} type="button" aria-pressed={config.ratio === ratio} onClick={() => changeRatio(ratio)}><span style={{ aspectRatio: RATIO_VALUES[ratio] }} /><strong>{ratio}</strong><small>{{ '9:16': 'Reels / Shorts', '16:9': 'YouTube / MLS', '1:1': 'Social', '4:5': 'Instagram' }[ratio]}</small></button>)}</div></div><div className="v4-prep-note"><strong>Review framing before generation</strong><p>Choose the story, prepare each crop or extension, then review the results.</p></div></div></div> : step === 'media' ? <><div className="v4-gallery-toolbar"><div><h2>{frames.length} of {requiredScenes} scenes selected</h2><p className="v4-muted">Choose your images in story order. Move them below to refine the sequence.</p></div><Button variant="outline" onClick={onChangeMedia}>Add media</Button></div><div className="v4-scene-selection">{media.map(item => <button type="button" className="v4-scene-choice" aria-pressed={selectedIds.has(item.id)} key={item.id} onClick={() => selectMedia(item)}><StudioImage src={item.thumbnailUrl || item.url} alt={item.name} loading="lazy" onLoad={event => { const width = event.currentTarget.naturalWidth, height = event.currentTarget.naturalHeight; setDimensions(current => current[item.id]?.width === width && current[item.id]?.height === height ? current : { ...current, [item.id]: { width, height } }); }} /><span>{item.name}</span><i>{selectedIds.has(item.id) ? frames.findIndex(frame => frame.mediaId === item.id) + 1 : '+'}</i></button>)}</div>{frames.length > 0 && <div className="v4-story-order"><h2>Your sequence · {frames.length * 5}s</h2>{frames.map((frame, index) => <div key={frame.mediaId}><span>{String(index + 1).padStart(2, '0')}</span><strong>{media.find(item => item.id === frame.mediaId)?.name}</strong><small>{formatTime(index * 5)}–{formatTime((index + 1) * 5)}</small><Button variant="ghost" size="icon" aria-label={`Move scene ${index + 1} earlier`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button><Button variant="ghost" size="icon" aria-label={`Move scene ${index + 1} later`} disabled={index === frames.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button></div>)}</div>}</> : step === 'prepare' ? <FramePreparation media={media} frames={frames} ratio={config.ratio} onChange={next => { setConfig(current => ({ ...current, frames: next })); setReviewed(new Set()); }} /> : step === 'review' ? <><div className="v4-gallery-toolbar"><div><h2>{readyFrames.length} prepared frames</h2><p className="v4-muted">Review every image. Select a frame to refine or use it.</p></div><span className="v4-muted">{config.ratio} · {config.duration}s</span></div><div className="v4-prepared-row">{frames.map((frame, index) => { const item = media.find(source => source.id === frame.mediaId)!; const result = prepared.get(item.id); return <article key={item.id} className="v4-prepared-card" data-active={active.id === item.id}><button type="button" className="v4-prepared-image-button" onClick={() => setActiveId(item.id)}>{result ? <FramePreview media={item} method={frame.method} ratio={config.ratio} resultUrl={result.url} /> : <div className="v4-frame-pending" style={{ aspectRatio: RATIO_VALUES[config.ratio] }}><RefreshCw /><span>Waiting for prepared frame</span></div>}</button><div className="v4-card-caption"><strong>{String(index + 1).padStart(2, '0')} {item.name}</strong><small>0:05</small></div><p>{methodLabel(frame.method)}{result ? ` · V${result.version}` : ''}</p><div className="v4-prepared-actions"><Button variant="outline" disabled={!result || block} onClick={() => setFeedback(item)}>Refine</Button><Button variant="outline" aria-pressed={reviewed.has(reviewKey(frame))} disabled={!result || block} onClick={() => markReviewed(frame)}><Check />{reviewed.has(reviewKey(frame)) ? 'Reviewed' : 'Use frame'}</Button></div></article>; })}</div></> : step === 'style' ? <VideoStyling config={config} onChange={setConfig} media={active} preparedUrl={prepared.get(active.id)?.url} /> : <div className="v4-video-result">{output ? <><video ref={video} key={output.id} src={output.url} poster={output.thumbnailUrl} controls playsInline preload="metadata" style={{ aspectRatio: RATIO_VALUES[config.ratio] }} onTimeUpdate={event => setPlayback(event.currentTarget.currentTime)} /><div className="v4-video-result-caption"><span>Version {output.version}</span><span>{config.ratio} · {config.duration}s</span></div></> : <div className="v4-workspace-empty"><h2>No video output yet</h2><p>Generate the reel after reviewing every prepared frame.</p><Button onClick={() => setStep('review')}>Review frames</Button></div>}</div>}
  </EditorShell>{feedback && <FeedbackEditor key={feedback.id} mediaId={feedback.id} name={feedback.name} imageUrl={prepared.get(feedback.id)?.url || feedback.url} busy={block} onClose={() => setFeedback(null)} onSubmit={async value => { await onRefine(value); setReviewed(current => new Set([...current].filter(key => !key.startsWith(`${feedback.id}:`)))); setStep('review'); }} onDetect={onDetect} />}</>;
}
