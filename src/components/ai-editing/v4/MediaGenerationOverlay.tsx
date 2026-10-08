import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { RefreshCw } from 'lucide-react';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { containRect } from './workspaceLogic';
import './generationOverlay.css';

interface Props { progress: number | null; label: string; detail?: string; compact?: boolean; fitToImage?: boolean; revealing?: boolean; onRefresh?: () => void }
const stars = [[8,22,6],[17,15,10],[27,23,5],[36,13,8],[47,21,4],[61,16,9],[73,23,5],[85,17,7],[93,30,11],[12,37,5],[24,34,12],[34,30,5],[67,31,8],[79,37,13],[88,43,5],[6,53,9],[17,49,4],[29,45,7],[71,48,5],[83,55,10],[94,62,4],[10,69,12],[23,65,7],[34,61,5],[65,62,8],[75,69,5],[87,74,11],[18,78,4],[30,74,9],[43,71,6],[54,76,4],[63,79,10],[40,35,4],[60,36,5],[37,54,4],[63,54,4]];
const motes = [[21,31],[74,19],[9,52],[87,66],[33,77],[66,56],[6,16],[55,13],[91,21],[18,58],[31,52],[76,59],[93,78],[48,65],[69,73],[36,20]];
const starPath = 'M12 1.5c1.2 6.1 4.4 9.3 10.5 10.5-6.1 1.2-9.3 4.4-10.5 10.5C10.8 16.4 7.6 13.2 1.5 12 7.6 10.8 10.8 7.6 12 1.5Z';
const starIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d={starPath} fill="currentColor" /></svg>;

export function MediaGenerationOverlay({ progress, label, detail, compact = false, fitToImage = false, revealing = false, onRefresh }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<CSSProperties>();
  const percent = typeof progress === 'number' && Number.isFinite(progress) ? Math.min(100, Math.max(0, Math.round(progress))) : null;
  useEffect(() => {
    const parent = ref.current?.parentElement;
    const image = parent?.querySelector('img');
    if (!fitToImage || !parent || !image) { setBounds(undefined); return; }
    const resize = () => {
      if (!image.naturalWidth || !image.naturalHeight) { setBounds(undefined); return; }
      const rect = containRect(parent.clientWidth, parent.clientHeight, image.naturalWidth, image.naturalHeight);
      setBounds({ left: rect.x, top: rect.y, width: rect.width, height: rect.height, right: 'auto', bottom: 'auto' });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(parent);
    image.addEventListener('load', resize);
    window.addEventListener('resize', resize);
    resize();
    return () => { observer?.disconnect(); image.removeEventListener('load', resize); window.removeEventListener('resize', resize); };
  }, [fitToImage]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let visible = true;
    const pause = () => { element.dataset.paused = String(document.hidden || !visible); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); pause(); });
    observer?.observe(element);
    document.addEventListener('visibilitychange', pause);
    pause();
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', pause); };
  }, []);
  return <div ref={ref} className={`v4-media-generation v4-edge-generation${compact ? ' v4-media-generation-compact' : ''}${revealing ? ' is-revealing' : ''}`} style={bounds}>
    <div className="v4-generation-stars" aria-hidden="true">
      {stars.map(([x, y, size], i) => <i key={i} className={`v4-generation-star${size <= 5 ? ' distant' : ''}`} style={{ left: `${x}%`, top: `${y}%`, '--star-size': `${size}px`, '--star-duration': `${4.8 + i % 7 * .55}s`, '--star-delay': `${-(i * 1.37 + .8)}s` } as CSSProperties}>{starIcon}</i>)}
      {!compact && motes.map(([x, y], i) => <i key={`mote-${i}`} className="v4-generation-mote" style={{ left: `${x}%`, top: `${y}%`, '--star-duration': `${9 + i * .6}s`, '--star-delay': `${-i * 2.1}s` } as CSSProperties} />)}
      {!compact && [[18,27], [67,22], [77,64]].map(([x,y],i) => <i key={`trail-${i}`} className="v4-generation-trail" style={{ left: `${x}%`, top: `${y}%`, '--star-duration': `${10 + i * 2}s`, '--star-delay': `${-(i * 3.7 + 2)}s` } as CSSProperties}>{starIcon}</i>)}
    </div>
    <div className="v4-generation-robbie" aria-hidden="true"><div className="v4-generation-mark"><ReproAiIcon useSolid /><span className="v4-generation-shimmer"><ReproAiIcon useSolid /></span></div><span>{/photo|stag|edit/i.test(label) ? 'Robbie is editing' : 'Robbie is working'}</span></div>
    <div className="v4-generation-edge" aria-hidden="true" />
    <i className="v4-generation-corner a" aria-hidden="true" /><i className="v4-generation-corner b" aria-hidden="true" />
    {!compact && <div className="v4-generation-working" aria-hidden="true"><i />Working</div>}
    <div className="v4-generation-hud">
      <div className="v4-generation-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined} aria-valuetext={percent === null ? 'Progress unavailable' : `${percent}% complete`}>
        <span className="v4-generation-label">{label}</span><strong>{percent === null ? 'Working…' : `${percent}%`}</strong>
        {!compact && <span className="v4-generation-detail">{detail || 'Your original stays available'}</span>}
        <span className="v4-generation-meter" aria-hidden="true"><i className={percent === null ? 'is-indeterminate' : ''} style={percent === null ? undefined : { width: `${percent}%` }} /></span>
      </div>
    </div>
    {!compact && onRefresh && !revealing && <button type="button" className="v4-generation-refresh" onClick={onRefresh} aria-label="Refresh progress" title="Refresh progress"><RefreshCw size={14} /></button>}
  </div>;
}
