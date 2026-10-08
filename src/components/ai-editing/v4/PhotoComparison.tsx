import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronsLeftRight } from 'lucide-react';
import { StudioImage } from '@/components/studio/v4/StudioImage';
import { BeforeAfterControl } from '@/components/studio/BeforeAfterControl';
import { containRect } from './workspaceLogic';
import { GenerationPhoto } from './GenerationPhoto';

interface Props {
  overlay?: ReactNode;
  name: string; originalUrl: string; editedUrl?: string; version?: number; generating: boolean;
  comparing: boolean; position: number; onPositionChange: (position: number) => void;
  progress?: number | null; generationLabel?: string; outcome?: string; onRefresh?: () => void; resultKey?: string;
}

/** Keep the divider and controls inside the visible photo, excluding letterboxing. */
export function PhotoComparison({ name, originalUrl, editedUrl, version, generating, comparing, position, onPositionChange, overlay, progress = null, generationLabel = 'Editing photos', outcome, onRefresh, resultKey }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const resize = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(element);
    window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, []);
  const bounds = size.width && size.height && naturalSize.width && naturalSize.height ? containRect(size.width, size.height, naturalSize.width, naturalSize.height) : null;
  const before = !editedUrl;
  return <div ref={surface} className="v4-photo-comparison">
    <div className="v4-photo-image-frame" style={bounds ? { width: bounds.width, height: bounds.height } : undefined}>
      <GenerationPhoto active={generating} progress={progress} label={generationLabel} outcome={outcome} resultKey={editedUrl ? resultKey || `${version}:${editedUrl}` : undefined} onRefresh={onRefresh} loading="eager" src={before ? originalUrl : editedUrl} alt={`${name} ${before ? 'original' : 'edited'}`} onLoad={event => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}>
      {phase => <>{!generating && !phase && comparing && editedUrl && <>
        <StudioImage className="v4-photo-original-layer" src={originalUrl} alt="Original for comparison" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} />
        <BeforeAfterControl className="v4-photo-compare-slider" position={position} onPositionChange={onPositionChange} />
        <span className="v4-photo-compare-handle" style={{ left: `${position}%` }} aria-hidden="true"><ChevronsLeftRight size={16} /></span>
        <span className="v4-compare-label v4-compare-label-before">Before</span>
        <span className="v4-compare-label v4-compare-label-after">After · V{version}</span>
      </>}
      {!phase && overlay}</>}
      </GenerationPhoto>
    </div>
  </div>;
}
