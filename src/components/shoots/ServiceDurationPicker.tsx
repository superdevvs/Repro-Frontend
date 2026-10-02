import { useEffect, useId, useState } from 'react';
import { resolveShootDuration, serviceDurationLimits, type ServiceDurationSource } from '@/utils/shootDuration';

export function ServiceDurationPicker({ serviceName, value, onChange, disabled = false, showSlider = true,
  durationSource = {}, minMinutes = serviceDurationLimits(durationSource).minMinutes, maxMinutes = serviceDurationLimits(durationSource).maxMinutes,
}: {
  serviceName: string;
  value?: number | null;
  onChange: (minutes: number) => void;
  disabled?: boolean;
  showSlider?: boolean;
  minMinutes?: number;
  maxMinutes?: number;
  durationSource?: ServiceDurationSource;
}) {
  const id = useId();
  const minutes = resolveShootDuration(value);
  const [custom, setCustom] = useState(minutes % 5 !== 0);
  const [draft, setDraft] = useState(String(minutes));
  useEffect(() => { setDraft(String(minutes)); if (minutes % 5 !== 0) setCustom(true); }, [minutes]);
  const customValue = Number(draft);
  const invalid = !draft.trim() || !Number.isInteger(customValue) || customValue < minMinutes || customValue > maxMinutes;
  if (durationSource.photographer_required === false) return <p className="text-xs text-muted-foreground">No on-site time</p>;
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        {showSlider ? <label htmlFor={id} className="text-xs font-medium text-muted-foreground">Shoot duration</label>
          : <span className="text-xs font-medium text-muted-foreground">Shoot duration</span>}
        <output htmlFor={showSlider ? id : custom ? `${id}-custom` : undefined} aria-label={`Selected duration for ${serviceName}`}
          className="whitespace-nowrap text-sm font-medium tabular-nums">{minutes} min</output>
      </div>
      <div className="flex items-center justify-end gap-3">
        {showSlider && <input id={id} type="range" aria-label={`Shoot duration for ${serviceName}`}
          aria-valuetext={`${minutes} minutes`} min={minMinutes} max={maxMinutes} step={5}
          value={Math.max(minMinutes, Math.min(maxMinutes, minutes))} disabled={disabled}
          onChange={event => { setCustom(false); onChange(Math.max(minMinutes, Math.min(maxMinutes, Math.round(Number(event.target.value) / 5) * 5))); }}
          className="h-9 min-w-0 flex-1 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" />}
        <button id={`${id}-custom-toggle`} type="button" disabled={disabled} aria-pressed={custom} aria-label={`Set custom duration for ${serviceName}`}
          onClick={() => { setCustom(current => !current); setDraft(String(minutes)); }}
          className="rounded-md border border-input px-2 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">Custom</button>
      </div>
      {custom && <div className="space-y-1">
        <label htmlFor={`${id}-custom`} className="text-xs text-muted-foreground">Custom minutes</label>
        <input id={`${id}-custom`} type="number" inputMode="numeric" min={minMinutes} max={maxMinutes} step={1}
          aria-label={`Custom duration for ${serviceName}`} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}
          disabled={disabled} value={draft} onChange={event => {
            setDraft(event.target.value);
            const next = Number(event.target.value);
            if (event.target.value.trim() && Number.isInteger(next) && next >= minMinutes && next <= maxMinutes) onChange(next);
          }} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        {invalid && <p id={`${id}-error`} className="text-xs text-destructive">Enter a whole number from {minMinutes} to {maxMinutes} minutes.</p>}
      </div>}
    </div>
  );
}
