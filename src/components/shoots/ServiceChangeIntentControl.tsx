import { useId } from 'react';
import type { ServiceChangeIntent } from '@/utils/activeShootWork';

export function ServiceChangeIntentControl({ value, onChange }: {
  value: ServiceChangeIntent;
  onChange: (value: ServiceChangeIntent) => void;
}) {
  const id = useId();
  return <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-2.5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs font-medium">Added services</label>
      <select id={id} value={value} onChange={event => onChange(event.target.value as ServiceChangeIntent)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs">
        <option value="new_work">New work</option>
        <option value="billing_correction">Already completed / billing only</option>
      </select>
    </div>
    <p className="text-[11px] text-muted-foreground">
      {value === 'new_work' ? 'The shoot becomes Active until the added work is delivered.'
        : 'Updates billing while keeping the existing delivery status.'}
    </p>
  </div>;
}
