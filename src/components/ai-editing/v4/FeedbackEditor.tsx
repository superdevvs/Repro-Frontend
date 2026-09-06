import { StudioImage } from '@/components/studio/v4/StudioImage';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { BoxSelect, Brush, Loader2, ScanSearch, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { V4Feedback, V4Region, V4Segment } from '@/components/studio/v4/types';
import { clampUnit, containRect, regionFromPoints } from './workspaceLogic';
import { MAX_DRAWING_STROKES, MAX_STROKE_POINTS, prepareDrawingFeedback, simplifyStroke } from './drawingFeedback';

type Point = { x: number; y: number };
const detectionCache = new Map<string, Promise<V4Segment[]>>();
let detectionAccount: string | null = null;
interface FeedbackEditorProps {
  mediaId: string; name: string; imageUrl: string; busy: boolean;
  detectOnOpen?: boolean;
  onClose: () => void; onSubmit: (feedback: V4Feedback) => Promise<void>;
  onDetect: (mediaId: string) => Promise<V4Segment[]>;
}

export function FeedbackEditor({ mediaId, name, imageUrl, busy, detectOnOpen = false, onClose, onSubmit, onDetect }: FeedbackEditorProps) {
  const [tool, setTool] = useState<'box' | 'draw' | 'objects'>('box');
  const [prompt, setPrompt] = useState('');
  const [region, setRegion] = useState<V4Region>();
  const [drawing, setDrawing] = useState<Point[][]>([]);
  const [segments, setSegments] = useState<V4Segment[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const surface = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const autoDetected = useRef(false);
  const start = useRef<Point | null>(null), activePointer = useRef<number | null>(null);
  const rect = containRect(size.width, size.height, imageSize.width, imageSize.height);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update); observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !rect.width || !rect.height) return;
    const density = window.devicePixelRatio || 1;
    element.width = rect.width * density; element.height = rect.height * density;
    const context = element.getContext('2d');
    if (!context) return;
    context.scale(density, density); context.lineWidth = 3; context.strokeStyle = '#93c5fd'; context.lineCap = 'round'; context.lineJoin = 'round';
    for (const stroke of drawing) {
      context.beginPath();
      stroke.forEach((point, index) => index ? context.lineTo(point.x * rect.width, point.y * rect.height) : context.moveTo(point.x * rect.width, point.y * rect.height));
      context.stroke();
    }
  }, [drawing, rect.width, rect.height]);

  const pointFor = (event: PointerEvent<HTMLDivElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: clampUnit((event.clientX - bounds.left) / bounds.width), y: clampUnit((event.clientY - bounds.top) / bounds.height) };
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (busy || sending || tool === 'objects' || event.button !== 0) return;
    if (tool === 'draw' && drawing.length >= MAX_DRAWING_STROKES) return;
    activePointer.current = event.pointerId; start.current = pointFor(event); event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'box') setRegion(regionFromPoints(start.current, start.current));
    else setDrawing(previous => [...previous, [start.current!]]);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId || !start.current) return;
    const point = pointFor(event);
    if (tool === 'box') setRegion(regionFromPoints(start.current, point));
    else setDrawing(previous => previous.map((stroke, index) => index === previous.length - 1 ? [...(stroke.length >= MAX_STROKE_POINTS * 4 ? simplifyStroke(stroke) : stroke), point] : stroke));
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (tool === 'draw' && activePointer.current !== null) {
      const final = event.type === 'pointercancel' ? null : pointFor(event);
      setDrawing(previous => previous.flatMap((stroke, index) => {
        if (index !== previous.length - 1) return [stroke];
        const last = stroke[stroke.length - 1];
        const complete = final && (last.x !== final.x || last.y !== final.y) ? [...stroke, final] : stroke;
        return complete.length > 1 ? [simplifyStroke(complete)] : [];
      }));
    }
    activePointer.current = null; start.current = null;
  };
  const detect = useCallback(async () => {
    setDetecting(true); setError('');
    const account = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (account !== detectionAccount) { detectionCache.clear(); detectionAccount = account; }
    const key = `${mediaId}:${imageUrl}`;
    try {
      if (!detectionCache.has(key)) {
        if (detectionCache.size >= 30) detectionCache.delete(detectionCache.keys().next().value!);
        detectionCache.set(key, onDetect(mediaId));
      }
      const result = await detectionCache.get(key)!;
      setSegments(result); setTool('objects');
      if (!result.length) setError('No suggested areas found. Select an area or draw your feedback.');
    } catch (reason) { detectionCache.delete(key); setError(reason instanceof Error ? reason.message : 'Could not find suggested areas. You can draw an area instead.'); }
    finally { setDetecting(false); }
  }, [mediaId, imageUrl, onDetect]);
  useEffect(() => {
    if (detectOnOpen && !busy && !autoDetected.current) { autoDetected.current = true; void detect(); }
  }, [detectOnOpen, busy, detect]);
  const chooseSegment = (segment: V4Segment) => { setRegion(segment.region); setTool('objects'); promptInput.current?.focus(); };
  const submit = async () => {
    if (!prompt.trim() || busy || sending) return;
    setSending(true); setError('');
    try { await onSubmit({ mediaId, prompt: prompt.trim(), region: region && region.width > .005 && region.height > .005 ? region : undefined, drawing: prepareDrawingFeedback(drawing) }); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not submit the revision. Your feedback is still here.'); }
    finally { setSending(false); }
  };

  return <Dialog open onOpenChange={open => { if (!open && !sending) onClose(); }}><DialogContent className="v4-editor-dialog v4-feedback-dialog"><DialogTitle>Refine {name}</DialogTitle><DialogDescription>Mark an area and describe the change. Your original stays available.</DialogDescription>
    <div className="v4-feedback-tools"><Button variant="outline" aria-pressed={tool === 'box'} onClick={() => setTool('box')}><BoxSelect />Select area</Button><Button variant="outline" aria-pressed={tool === 'draw'} onClick={() => setTool('draw')}><Brush />Draw</Button><Button variant="outline" aria-pressed={tool === 'objects'} disabled={detecting || busy} onClick={() => void detect()}>{detecting ? <Loader2 className="animate-spin" /> : <ScanSearch />}Find objects</Button><Button variant="ghost" disabled={!region && !drawing.length} onClick={() => { if (drawing.length) setDrawing(previous => previous.slice(0, -1)); else setRegion(undefined); }}><Undo2 />Undo</Button></div>
    <div className="v4-feedback-image" ref={surface}><StudioImage src={imageUrl} alt={name} onLoad={event => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
      <div className="v4-feedback-drawing" data-tool={tool} style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label="Draw feedback on the image"><canvas ref={canvas} />{tool === 'objects' && segments.map(segment => <button type="button" className="v4-object-area" key={segment.id} aria-label={`Select suggested ${segment.label} area`} aria-pressed={region === segment.region} onClick={() => chooseSegment(segment)} style={{ left: `${segment.region.x * 100}%`, top: `${segment.region.y * 100}%`, width: `${segment.region.width * 100}%`, height: `${segment.region.height * 100}%` }}><span>{segment.label}</span></button>)}{region && <span className="v4-feedback-region" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />}</div>
    </div>
    {tool === 'draw' && <p className="v4-muted" role="status">{drawing.length >= MAX_DRAWING_STROKES ? '20 strokes added. Undo a stroke to draw more.' : `${drawing.length} of ${MAX_DRAWING_STROKES} strokes used`}</p>}
    {segments.length > 0 && <div className="v4-feedback-suggestions"><span>AI suggested areas · hover or tap to select</span>{segments.map(segment => <Button key={segment.id} size="sm" variant="outline" onClick={() => chooseSegment(segment)}>{segment.label}</Button>)}</div>}
    <label className="v4-field">Describe the change<Textarea ref={promptInput} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Keep the window shape. Recover the view outside." maxLength={4000} rows={3} /></label>
    {error && <p className="v4-inline-error" role="alert">{error}</p>}
    <div className="v4-dialog-actions"><Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button><Button data-variant="primary" disabled={!prompt.trim() || busy || sending} onClick={() => void submit()}>{sending || busy ? <Loader2 className="animate-spin" /> : null}Generate revision</Button></div>
  </DialogContent></Dialog>;
}
