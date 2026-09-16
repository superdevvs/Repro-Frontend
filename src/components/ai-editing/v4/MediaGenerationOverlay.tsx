import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { PropertyParticleField } from './PropertyParticleField';
import { containRect } from './workspaceLogic';
import './generationOverlay.css';

interface Props { progress: number | null; label: string; detail?: string; compact?: boolean; fitToImage?: boolean; onRefresh?: () => void }

export function MediaGenerationOverlay({ progress, label, detail, compact = false, fitToImage = false, onRefresh }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<CSSProperties>();
  const percent = typeof progress === 'number' && Number.isFinite(progress) ? Math.min(100, Math.max(0, Math.round(progress))) : null;
  const reveal = percent === null ? 0 : percent <= 50 ? percent / 250 : .2 + Math.min(percent - 50, 49) * .25 / 49;
  const veil = Number((1 - reveal).toFixed(4));
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
  return <div ref={ref} className={`v4-media-generation${compact ? ' v4-media-generation-compact' : ''}`} style={{ ...bounds, '--v4-generation-veil': veil } as CSSProperties}>
    <PropertyParticleField displacement />
    <div className="v4-generation-hud">
      <div className="v4-generation-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined} aria-valuetext={percent === null ? 'Progress unavailable' : `${percent}% complete`}>
        <Sparkles size={16} aria-hidden="true" />
        <span className="v4-generation-label">{label}</span>
        <strong aria-live={compact ? 'off' : 'polite'}>{percent === null ? 'Working…' : `${percent}%`}</strong>
        <span className={`v4-generation-meter${percent === null ? ' is-indeterminate' : ''}`} style={percent === null ? undefined : { width: `${percent}%` }} aria-hidden="true" />
      </div>
      {!compact && onRefresh && <button type="button" className="v4-generation-refresh" onClick={onRefresh} aria-label="Refresh progress" title="Refresh progress"><RefreshCw size={15} /></button>}
    </div>
    {!compact && detail && <p className="v4-generation-detail">{detail}</p>}
  </div>;
}
