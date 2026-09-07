import { ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { V4Config, V4Output } from '@/components/studio/v4/types';
import type { StudioCapabilities } from '@/services/studioProviderService';

export function PhotoServiceControls({ config, adjust, disabled }: {
  config: V4Config; adjust: (key: string, value: string | number | boolean) => void; disabled: boolean;
}) {
  return <div className="space-y-4">
    <label className="v4-field">Photo type<select value={String(config.adjustments.sceneType || 'auto')} disabled={disabled} onChange={event => adjust('sceneType', event.target.value)}><option value="auto">Detect automatically</option><option value="interior">Interior</option><option value="exterior">Exterior</option></select></label>
    <label className="v4-switch-field">Replace sky<Switch checked={config.adjustments.skyReplacement === true} disabled={disabled} onCheckedChange={value => adjust('skyReplacement', value)} /></label>
    <p className="text-xs text-muted-foreground">These choices guide the edit. Review the generated result against the original.</p>
  </div>;
}

export function UpscalePhotoAction({ output, capabilities, busy, onUpscale }: {
  output?: V4Output; capabilities?: StudioCapabilities | null; busy: boolean;
  onUpscale?: (mediaId: string, outputId: string) => void;
}) {
  const ready = Boolean(capabilities?.upscale.ready && onUpscale);
  return <div className="space-y-2"><Button variant="outline" disabled={!ready || !output || busy} onClick={() => { if (output && ready) onUpscale?.(output.mediaId, output.id); }}>{busy ? <Loader2 className="animate-spin" /> : <ArrowUpRight />}Upscale{output ? ` version ${output.version}` : ' photo'}</Button><p className="text-xs text-muted-foreground">{ready ? 'Create a larger, separate version of this photo.' : capabilities?.upscale.reason || 'Upscaling is not configured yet.'}</p></div>;
}
