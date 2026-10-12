import { Minus, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ServiceDurationPicker } from '@/components/shoots/ServiceDurationPicker';
import { ServiceDatePicker, ServiceTimePicker } from '@/components/shoots/ServiceSchedulePicker';
import { buildFullDayServiceTimeOptions } from '@/components/shoots/fullDayServiceTimeOptions';
import { getShootSchedule } from '@/utils/shootSchedule';
import { buildShootScheduleTimestamp } from '@/utils/shootScheduleSubmission';
import { normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import { formatPrice } from '@/utils/servicePricing';
import type { ShootServiceObject } from '@/types/shoots';

export function ApprovalServiceCard({ line, unitLabel, timezone, photographers, busy, onChange, onValidityChange }: {
  line: ShootServiceObject; unitLabel?: string; timezone?: string;
  photographers: Array<{ id: string | number; name: string }>; busy: boolean;
  onChange: (value: Partial<ShootServiceObject>) => void; onValidityChange: (valid: boolean) => void;
}) {
  const name = line.name || 'Service';
  const quantity = normalizeBookingQuantity(line.quantity);
  const schedule = getShootSchedule({ scheduled_at: line.scheduled_at ?? line.scheduledAt, timezone });
  const timeOptions = useMemo(() => buildFullDayServiceTimeOptions(schedule.time), [schedule.time]);
  const setSchedule = (date: string, time: string) => onChange({ scheduled_at: date && time
    ? buildShootScheduleTimestamp(date, time, timezone, line.scheduled_at ?? line.scheduledAt) : null });
  return <fieldset disabled={busy} className="approval-service-card min-w-0 rounded-xl border bg-background p-4">
    <legend className="sr-only">{name} · {unitLabel}</legend>
    <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="break-words text-sm font-semibold">{name}</h3><p className="mt-1 text-xs text-muted-foreground">{formatPrice(line.price)} each · <span className="font-semibold text-foreground">{formatPrice(line.price * quantity)}</span> total</p></div>
      {line.allow_multiple ? <div role="group" aria-label={`Quantity for ${name}`} className="inline-flex shrink-0 items-center rounded-lg border bg-muted/20">
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-r-none" aria-label={`Decrease ${name} quantity`} disabled={quantity <= 1} onClick={() => onChange({ quantity: quantity - 1 })}><Minus className="h-4 w-4" /></Button>
        <output aria-label={`${name} quantity`} aria-live="polite" className="min-w-6 text-center text-sm font-semibold tabular-nums">{quantity}</output>
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-l-none" aria-label={`Increase ${name} quantity`} onClick={() => onChange({ quantity: quantity + 1 })}><Plus className="h-4 w-4" /></Button>
      </div> : <span className="shrink-0 pt-1 text-xs text-muted-foreground">Quantity: {quantity}</span>}
    </div>
    <div className="approval-service-fields">
      <div className="min-w-0 space-y-1.5"><span className="block text-xs font-medium text-muted-foreground">Date</span><ServiceDatePicker ariaLabel={`${name} date`} value={schedule.date || ''} triggerClassName="h-11 min-w-0 rounded-lg text-sm" onChange={date => setSchedule(date, schedule.time || '09:00')} /></div>
      <div className="min-w-0 space-y-1.5"><span className="block text-xs font-medium text-muted-foreground">Time</span><ServiceTimePicker ariaLabel={`${name} time`} value={schedule.time || ''} options={timeOptions} triggerClassName="h-11 min-w-0 rounded-lg text-sm" onChange={time => setSchedule(schedule.date || '', time)} /></div>
      <label className="approval-photographer-field min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">Photographer<select aria-label={`${name} photographer`} className="block h-11 w-full min-w-0 max-w-full rounded-lg border bg-background px-3 text-sm font-normal text-foreground" value={String(line.photographer_id ?? '')} onChange={event => onChange({ photographer_id: event.target.value || null })}><option value="">Unassigned</option>{photographers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    </div>
    <div className="mt-3 border-t pt-3"><ServiceDurationPicker showSlider={false} durationSource={line} serviceName={`${name} · ${unitLabel || ''}`} value={line.duration_minutes} onChange={duration_minutes => onChange({ duration_minutes })} onValidityChange={onValidityChange} /></div>
  </fieldset>;
}
