import { useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { StudioImage } from '@/components/studio/v4/StudioImage';
import type { V4Config } from '@/components/studio/v4/types';
import { studioError, studioWorkspaceService } from '@/services/studioWorkspaceService';

const ROOMS = [
  ['living', 'Living room'],
  ['bed', 'Bedroom'],
  ['kitchen', 'Kitchen'],
  ['dining', 'Dining room'],
  ['home_office', 'Home office'],
  ['outdoor', 'Outdoor'],
  ['kids_room', 'Kids room'],
] as const;

const STYLES = [
  ['modern', 'Modern'],
  ['scandinavian', 'Scandinavian'],
  ['industrial', 'Industrial'],
  ['midcentury', 'Mid-century'],
  ['luxury', 'Luxury'],
  ['farmhouse', 'Farmhouse'],
  ['coastal', 'Coastal'],
  ['standard', 'Standard'],
] as const;

const TREATMENTS = [
  ['off', 'Add furniture'],
  ['auto', 'Remove furniture only if some is detected, then stage'],
  ['on', 'Remove existing furniture, then stage'],
  ['remove', 'Remove furniture only'],
] as const;

type AdjustmentPatch = Record<string, string | number | boolean>;

/** Controls that map directly onto the Virtual Staging AI staging config. */
export function VirtualStagingControls({ workspaceId, mediaId, config, patch, disabled }: {
  workspaceId: string;
  mediaId: string;
  config: V4Config;
  patch: (changes: AdjustmentPatch) => void;
  disabled: boolean;
}) {
  const [analysis, setAnalysis] = useState<{ mediaId: string; percentageMasked: number; previewUrl: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const treatment = config.adjustments.addFurniture === false ? 'remove' : String(config.adjustments.removal || 'off');
  const removal = treatment === 'off' ? 'off' : 'on';
  const currentAnalysis = analysis?.mediaId === mediaId ? analysis : null;

  const setTreatment = (value: string) => {
    if (value === 'remove') patch({ removal: 'on', addFurniture: false });
    else patch({ removal: value, addFurniture: true });
  };

  const detect = async () => {
    if (analyzing || disabled) return;
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const result = await studioWorkspaceService.analyzeFurniture(workspaceId, mediaId);
      setAnalysis({ mediaId, ...result });
    } catch (reason) {
      setAnalysisError(studioError(reason));
    } finally {
      setAnalyzing(false);
    }
  };

  return <>
    <label className="v4-field">Room type<select aria-label="Room type" value={String(config.adjustments.roomType || 'living')} disabled={disabled} onChange={event => patch({ roomType: event.target.value })}>{ROOMS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label className="v4-field">Furniture style<select aria-label="Furniture style" value={String(config.adjustments.furnitureStyle || 'modern')} disabled={disabled || treatment === 'remove'} onChange={event => patch({ furnitureStyle: event.target.value })}>{STYLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label className="v4-field">What to do<select aria-label="What to do" value={treatment} disabled={disabled} onChange={event => setTreatment(event.target.value)}>{TREATMENTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label className="v4-field">Arrangements<select aria-label="Arrangements" value={String(config.adjustments.variationCount || 1)} disabled={disabled} onChange={event => patch({ variationCount: Number(event.target.value) })}>{Array.from({ length: 20 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count === 1 ? '1 arrangement' : `${count} arrangements`}</option>)}</select><span>Each arrangement is a different furniture layout. Up to 20 per photo.</span></label>
    <label className="v4-field">Output size<select aria-label="Output size" value={String(config.adjustments.resolution || 'default')} disabled={disabled} onChange={event => patch({ resolution: event.target.value })}><option value="default">Smart, up to 3072px</option><option value="1536">1536px</option></select></label>
    <label className="v4-switch-field">Add a virtually staged disclaimer<Switch checked={config.adjustments.watermark === true} disabled={disabled || treatment === 'remove'} onCheckedChange={value => patch({ watermark: value })} /></label>
    {removal !== 'off' && <>
      <label className="v4-switch-field">Use the detected furniture mask<Switch checked={config.adjustments.useDetectedMask === true} disabled={disabled} onCheckedChange={value => patch({ useDetectedMask: value })} /></label>
      <Button type="button" variant="outline" disabled={disabled || analyzing} onClick={() => void detect()}>{analyzing ? <Loader2 aria-hidden="true" className="" /> : <ScanSearch />}{analyzing ? 'Detecting furniture…' : 'Detect furniture'}</Button>
      {currentAnalysis && <div className="space-y-2"><StudioImage src={currentAnalysis.previewUrl} alt="Detected furniture mask" /><p className="text-xs text-muted-foreground">{currentAnalysis.percentageMasked}% of this photo was marked as furniture. Detect each photo you want masked.</p></div>}
      {analysisError && <p role="alert" className="v4-inline-error">{analysisError}</p>}
    </>}
    <p className="text-xs text-muted-foreground">Virtual Staging AI chooses the furniture from the room and style. Color sliders and written direction are not sent.</p>
  </>;
}
