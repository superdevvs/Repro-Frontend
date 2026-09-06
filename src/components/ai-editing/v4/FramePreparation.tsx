import { StudioImage } from '@/components/studio/v4/StudioImage';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { StudioRatio, V4Frame, V4Media } from '@/components/studio/v4/types';
import { methodLabel, RATIO_VALUES } from './workspaceLogic';

export function FramePreview({ media, method, ratio, className = '', resultUrl }: { media: V4Media; method: V4Frame['method']; ratio: StudioRatio; className?: string; resultUrl?: string }) {
  const [sourceRatio, setSourceRatio] = useState(3 / 2);
  const target = RATIO_VALUES[ratio];
  const sourceIsWider = sourceRatio > target;
  const extent = sourceIsWider ? target / sourceRatio : sourceRatio / target;
  const boundary = sourceIsWider ? { top: `${(1 - extent) * 50}%`, left: 0, width: '100%', height: `${extent * 100}%` } : { top: 0, left: `${(1 - extent) * 50}%`, width: `${extent * 100}%`, height: '100%' };
  return <div className={`v4-frame-preview ${className}`} data-method={method} style={{ aspectRatio: target }}>
    <StudioImage src={resultUrl || media.url} alt={resultUrl ? `${media.name}, prepared frame` : `${media.name}, ${methodLabel(method)} preview`} style={{ objectFit: resultUrl || method === 'crop' ? 'cover' : 'contain' }} onLoad={event => { if (!resultUrl) setSourceRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight); }} />
    {!resultUrl && method === 'extend' && <><span className="v4-source-boundary" style={boundary} /><span className={sourceIsWider ? 'v4-extend-label-top' : 'v4-extend-label-left'}>AI Extend area</span><span className={sourceIsWider ? 'v4-extend-label-bottom' : 'v4-extend-label-right'}>AI Extend area</span></>}
    {!resultUrl && method === 'crop' && <span className="v4-crop-boundary" />}
  </div>;
}

export function FramePreparation({ media, frames, ratio, onChange }: { media: V4Media[]; frames: V4Frame[]; ratio: StudioRatio; onChange: (frames: V4Frame[]) => void }) {
  const [changingId, setChangingId] = useState<string | null>(null);
  const changing = media.find(item => item.id === changingId);
  const changeMethod = (method: 'extend' | 'crop') => { onChange(frames.map(frame => frame.mediaId === changingId ? { ...frame, method } : frame)); setChangingId(null); };
  return <><div className="v4-prep-summary"><div>{(['fit', 'extend', 'crop'] as const).map(method => <span key={method}>{frames.filter(frame => frame.method === method).length} {methodLabel(method)}</span>)}</div><span>Target · {ratio}</span></div>
    <div className="v4-prep-grid">{frames.map((frame, index) => { const item = media.find(source => source.id === frame.mediaId); if (!item) return null; return <article key={item.id} className="v4-prep-card"><FramePreview media={item} method={frame.method} ratio={ratio} /><div><small>{String(index + 1).padStart(2, '0')}</small><h2>{item.name}</h2><span className="v4-method-badge">{methodLabel(frame.method)}</span><p>{frame.method === 'extend' ? 'Preserve the source image. Add canvas to fit.' : frame.method === 'crop' ? 'Keep the subject in the selected format.' : 'The source matches your format.'}</p><Button variant="outline" onClick={() => setChangingId(item.id)}>Change method</Button></div></article>; })}</div>
    <div className="v4-prep-note"><strong>Keep the property intact</strong><p>Review each prepared image before generating motion. Originals stay available.</p></div>
    <Dialog open={Boolean(changing)} onOpenChange={open => { if (!open) setChangingId(null); }}><DialogContent className="v4-editor-dialog v4-method-dialog"><DialogTitle>{changing?.name} · preparation</DialogTitle><DialogDescription>Choose how this frame fits {ratio}.</DialogDescription>{changing && <div className="v4-method-options">{(['extend', 'crop'] as const).map(method => <section key={method}><h3>{methodLabel(method)}</h3><FramePreview media={changing} ratio={ratio} method={method} /><p>{method === 'extend' ? 'Keep the whole photo and add canvas around it.' : 'Fill the format by cropping the edges.'}</p><Button variant="outline" onClick={() => changeMethod(method)}>Use {methodLabel(method)}</Button></section>)}</div>}</DialogContent></Dialog>
  </>;
}
