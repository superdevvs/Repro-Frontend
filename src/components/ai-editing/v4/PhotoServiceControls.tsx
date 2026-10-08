import { ArrowUpRight } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { V4Config, V4Output } from '@/components/studio/v4/types';
import type { StudioCapabilities } from '@/services/studioProviderService';

export function PhotoServiceControls({ presetId, section = 'style', config, adjust, disabled }: {
  presetId: string; section?: 'style' | 'geometry' | 'scene'; config: V4Config; adjust: (key: string, value: string | number | boolean) => void; disabled: boolean;
}) {
  const choice = (key: string, label: string, options: [string, string][], fallback: string) => <label className="v4-field" key={key}>{label}<select disabled={disabled} value={String(config.adjustments[key] ?? fallback)} onChange={event => adjust(key, event.target.value)}>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>;
  const toggle = (key: string, label: string, fallback = false) => <label className="v4-switch-field" key={key}>{label}<Switch disabled={disabled} checked={Boolean(config.adjustments[key] ?? fallback)} onCheckedChange={value => adjust(key, value)} /></label>;
  const sky = choice('cloudType', 'Sky style', [['CLEAR', 'Clear sky'], ['LOW_CLOUD', 'Low clouds'], ['HIGH_CLOUD', 'High clouds']], 'CLEAR');
  const geometry = <>{toggle('lensCorrection', 'Lens correction', true)}{presetId !== 'perspective-correction' && toggle('verticalCorrection', 'Straighten verticals', true)}{choice('perspectiveMode', 'Perspective priority', [['DEFAULT_ENABLED', 'Automatic'], ['PRESERVE_CONTENT', 'Preserve image content'], ['PRIORITIZE_PERSPECTIVE', 'Prioritize straight lines']], 'DEFAULT_ENABLED')}</>;
  if (presetId === 'virtual-staging') return null;
  if (presetId === 'upscale') return <p>Increase resolution while preserving the source photo. No style or scene changes are applied.</p>;
  if (presetId === 'green-grass') return <p>Green the existing lawn while preserving its texture. Indoor staging and sky controls do not apply.</p>;
  if (presetId === 'twilight') return <p>Convert the scene to evening light. Use direction for a specific mood, then review the result against the original.</p>;
  if (presetId === 'sky-replacement') return <div className="space-y-4">{sky}<p>Replace the sky and match it to the property light.</p></div>;
  if (presetId === 'perspective-correction') return <div className="space-y-4">{geometry}</div>;
  if (presetId === 'full-shoot') {
    const clouds: [string, string][] = [['', 'Account default'], ['open_house_puffs', 'Open house puffs'], ['full_house_puffs', 'Full house puffs'], ['streaks_with_puffs', 'Streaks with puffs'], ['sweep_streaks', 'Sweep streaks'], ['scatter_streaks', 'Scatter streaks'], ['crisp_streaks', 'Crisp streaks'], ['clear_fade', 'Clear fade'], ['original', 'Original sky']];
    return <div className="space-y-4">{choice('sceneType', 'Photo type', [['auto', 'Detect automatically'], ['interior', 'Interior'], ['exterior', 'Exterior']], 'auto')}{choice('cloud_style', 'Exterior cloud style', clouds, '')}{choice('interior_cloud_style', 'Interior cloud style', clouds, '')}<label className="v4-field">Saved style ID<input disabled={disabled} value={String(config.adjustments.custom_style_id ?? '')} maxLength={200} placeholder="Use account default" onChange={event => adjust('custom_style_id', event.target.value)} /></label><p>Existing HDR stacks are merged together. Single photos are enhanced individually.</p></div>;
  }
  if (section === 'geometry') return <div className="space-y-4">{geometry}</div>;
  if (section === 'scene') return <div className="space-y-4">{toggle('privacy', 'Blur faces and license plates')}{choice('fireplace', 'Fireplace', [['', 'Account default'], ['AS_SHOT', 'Keep as photographed'], ['ALIGHT', 'Light the fireplace']], '')}{choice('tv', 'TV screens', [['', 'Account default'], ['AS_SHOT', 'Keep as photographed'], ['BLACK_OUT', 'Black screen']], '')}</div>;
  return <div className="space-y-4">{choice('enhanceType', 'Enhancement style', [['', 'Account default'], ['neutral', 'Neutral'], ['warm', 'Warm'], ['modern', 'Modern']], '')}{toggle('skyReplacement', 'Replace sky')}{config.adjustments.skyReplacement === true && sky}{choice('windowPull', 'Window recovery', [['', 'Account default'], ['NONE', 'None'], ['ONLY_WINDOWS', 'Windows only'], ['WINDOWS_WITH_SKIES', 'Windows and sky']], '')}</div>;
}

export function UpscalePhotoAction({ output, capabilities, busy, onUpscale }: {
  output?: V4Output; capabilities?: StudioCapabilities | null; busy: boolean;
  onUpscale?: (mediaId: string, outputId: string) => void;
}) {
  const ready = Boolean(capabilities?.upscale.ready && onUpscale);
  return <div className="space-y-2"><Button variant="outline" disabled={!ready || !output || busy} onClick={() => { if (output && ready) onUpscale?.(output.mediaId, output.id); }}>{busy ? <Loader2 aria-hidden="true" className="" /> : <ArrowUpRight />}Upscale{output ? ` version ${output.version}` : ' photo'}</Button><p className="text-xs text-muted-foreground">{ready ? 'Create a larger, separate version of this photo.' : capabilities?.upscale.reason || 'Upscaling is not configured yet.'}</p></div>;
}
