import { useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { StudioImage } from '@/components/studio/v4/StudioImage';
import { MediaGenerationOverlay } from './MediaGenerationOverlay';
import { useGenerationReveal, type GenerationPhase } from './useGenerationReveal';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'children'> {
  active: boolean; progress: number | null; label: string; resultKey?: string; outcome?: string;
  compact?: boolean; onRefresh?: () => void; children?: (phase: GenerationPhase) => ReactNode;
}

/** Keep generation and its completion reveal mounted across image replacement. */
export function GenerationPhoto({ active, progress, label, resultKey, outcome, compact, onRefresh, children, onLoad, onError, src, ...imageProps }: Props) {
  const imageKey = `${resultKey || 'source'}:${src}`;
  const [loadedKey, setLoadedKey] = useState<string>();
  const [failedKey, setFailedKey] = useState<string>();
  const phase = useGenerationReveal({ active, resultKey, outcome, resultReady: loadedKey === imageKey, resultFailed: failedKey === imageKey });
  return <>
    <StudioImage {...imageProps} key={imageKey} src={src} onLoad={event => { setLoadedKey(imageKey); onLoad?.(event); }} onError={event => { setFailedKey(imageKey); onError?.(event); }} />
    {phase && <MediaGenerationOverlay progress={phase === 'working' ? progress : phase === 'revealing' ? 100 : null} label={phase === 'waiting' ? 'Loading edited photo' : phase === 'revealing' ? 'Ready to review' : label} compact={compact} revealing={phase === 'revealing'} onRefresh={onRefresh} />}
    {failedKey === imageKey && <span className="v4-generation-image-error" role="alert">Preview could not load. Refresh to try again.</span>}
    {children?.(phase)}
  </>;
}
