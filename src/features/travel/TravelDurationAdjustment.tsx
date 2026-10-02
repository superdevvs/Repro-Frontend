import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ServiceDurationPicker } from '@/components/shoots/ServiceDurationPicker';

export type TravelDurationAdjuster = {
  items: Array<{ key: string; name: string; currentMinutes: number; minMinutes: number; maxMinutes: number }>;
  onApply: (durations: Record<string, number>) => void;
};

/** Changes stay inside this dialog until the pending save has been cancelled. */
export function TravelDurationAdjustment({ adjuster, cancelSave, onPendingChange }: {
  adjuster: TravelDurationAdjuster; cancelSave: () => void; onPendingChange: (pending: boolean) => void;
}) {
  const initial = () => Object.fromEntries(adjuster.items.map(item => [item.key, item.currentMinutes]));
  const [minutes, setMinutes] = useState<Record<string, number>>(initial);
  const [validity, setValidity] = useState<Record<string, boolean>>({});
  const [reset, setReset] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const applied = useRef(false);
  const changed = adjuster.items.filter(item => minutes[item.key] !== item.currentMinutes);
  const valid = adjuster.items.every(item => validity[item.key] !== false)
    && changed.every(item => Number.isInteger(minutes[item.key]) && minutes[item.key] >= item.minMinutes && minutes[item.key] <= item.maxMinutes);
  const pending = changed.length > 0 || !valid;
  useEffect(() => { onPendingChange(pending); }, [onPendingChange, pending]);
  return <section aria-label="Adjust proposed service duration" className="space-y-3 rounded-xl border bg-background p-3 sm:p-4">
    <Button type="button" variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-xs" aria-expanded={expanded}
      disabled={expanded && pending} onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide duration options' : 'Adjust duration'}</Button>
    {expanded && <>
    <p className="text-xs text-muted-foreground">Adjust only the proposed booking. Apply to recheck travel; this does not save the booking.</p>
    <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
      {adjuster.items.map(item => <div key={`${item.key}:${reset}`} className="grid gap-2 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center sm:gap-4">
        <p className="text-sm font-medium">{item.name}</p>
        <ServiceDurationPicker serviceName={item.name} value={minutes[item.key]} minMinutes={item.minMinutes} maxMinutes={item.maxMinutes}
          onChange={value => setMinutes(previous => ({ ...previous, [item.key]: value }))}
          onValidityChange={value => setValidity(previous => previous[item.key] === value ? previous : { ...previous, [item.key]: value })} />
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={!valid || changed.length === 0} onClick={() => {
        if (applied.current || !valid || changed.length === 0) return;
        applied.current = true;
        const durations = Object.fromEntries(changed.map(item => [item.key, minutes[item.key]]));
        cancelSave();
        adjuster.onApply(durations);
      }}>Apply duration and recheck</Button>
      {pending && <Button type="button" variant="ghost" size="sm" onClick={() => {
        setMinutes(initial()); setValidity({}); setReset(value => value + 1);
      }}>Cancel duration changes</Button>}
    </div>
    {pending && <p role="status" className="text-xs text-muted-foreground">Apply or cancel the duration changes before confirming this booking.</p>}
    </>}
  </section>;
}
