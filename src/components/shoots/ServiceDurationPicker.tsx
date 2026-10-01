import { useId } from 'react';
import { resolveShootDuration } from '@/utils/shootDuration';

export function ServiceDurationPicker({ serviceName, value, onChange, disabled = false }: {
  serviceName: string;
  value?: number | null;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const minutes = resolveShootDuration(value);
  // Preserve existing durations between the half-hour choices until changed.
  const options = [...new Set([30, 60, 90, 120, 150, 180, 210, 240, minutes])].sort((a, b) => a - b);
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">Shoot duration</label>
      <select id={id} aria-label={`Shoot duration for ${serviceName}`} value={minutes} disabled={disabled}
        onChange={event => onChange(Number(event.target.value))}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        {options.map(option => <option key={option} value={option}>{option === 60 ? '1 hour' : option % 60 === 0 ? `${option / 60} hours` : `${option} minutes`}</option>)}
      </select>
    </div>
  );
}
