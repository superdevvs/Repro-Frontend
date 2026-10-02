import { TravelFeasibilityPanel } from '@/features/travel/TravelFeasibilityPanel';
import { useTravelFeasibility } from '@/features/travel/useTravelFeasibility';
import { shootTravelPayload } from '@/features/travel/travelPayload';
import { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { ServiceDurationPicker } from '@/components/shoots/ServiceDurationPicker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/services/api';
import { transformShootFromApi, type ApiShoot } from '@/context/shootNormalization';
import { getShootSchedule } from '@/utils/shootSchedule';
import { buildShootScheduleTimestamp } from '@/utils/shootScheduleSubmission';
import { normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import { formatPrice } from '@/utils/servicePricing';
import type { ShootServiceObject } from '@/types/shoots';
import { ShootUnitScopeBar } from './ShootUnitScope';
import { useShootUnitScope } from './useShootUnitScope';
import { allUnitLines, unitLinePayload } from './unitMutations';
import { getServiceUnitId } from './shootUnitData';

type Props = { open: boolean; onClose: () => void; source: unknown; photographers: Array<{ id: string | number; name: string }>; onApproved?: () => void };
export function MultiUnitApprovalDialog({ open, onClose, source, photographers, onApproved }: Props) {
  const shoot = useMemo(() => transformShootFromApi(source as ApiShoot), [source]);
  const { activeUnitId, units, unit } = useShootUnitScope(shoot);
  const [changes, setChanges] = useState<Record<string, Partial<ShootServiceObject>>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const lines = allUnitLines(shoot).map(line => ({ ...line, ...changes[String(line.shoot_service_id ?? line.shootServiceId)] }));
  const serviceLinesPayload = lines.map(unitLinePayload);
  const firstStart = serviceLinesPayload.map(line => line.scheduled_at).filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  const travel = useTravelFeasibility({ payload: open ? shootTravelPayload(shoot, { service_lines: serviceLinesPayload, ...(firstStart ? { scheduled_at: firstStart } : {}) }, 'approve') : null });
  const total = lines.reduce((sum, line) => sum + line.price * normalizeBookingQuantity(line.quantity), 0);
  const selected = lines.filter(line => getServiceUnitId(line) === activeUnitId);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(selected.length / 8) - 1));
  const update = (line: ShootServiceObject, value: Partial<ShootServiceObject>) => {
    const id = String(line.shoot_service_id ?? line.shootServiceId);
    setChanges(previous => ({ ...previous, [id]: { ...previous[id], ...value } }));
  };
  const approve = async () => {
    if (busy || travel.blocked) return;
    setBusy(true); setError('');
    try {
      const service_lines = lines.map(unitLinePayload);
      const scheduled_at = service_lines.map(line => line.scheduled_at).filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
      await apiClient.post(`/shoots/${shoot.id}/approve`, { ...travel.confirmation, expected_units_revision: shoot.units_revision, service_lines, ...(scheduled_at ? { scheduled_at } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) });
      onApproved?.(); onClose();
    } catch (caught) {
      const data = (caught as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
      travel.acceptServerError(data);
      setError(Object.values(data?.errors ?? {}).flat().join(' ') || data?.message || 'Approval failed. Review the assignments and try again.');
    } finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}><DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden p-0">
    <DialogHeader className="shrink-0 px-4 pt-5 sm:px-6"><DialogTitle>Approve multi-unit booking</DialogTitle><DialogDescription>{units.length} units / areas · {lines.length} booked services. Review each unit’s schedule and photographer before approving the whole property.</DialogDescription></DialogHeader>
    <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
      <TravelFeasibilityPanel travel={travel} />
      <ShootUnitScopeBar shoot={shoot} disabled={busy} />
      <p className="text-xs text-muted-foreground">{shoot.location?.address} · {shoot.client?.name}. Unit prices stay at their booked amounts.</p>
      <div className="space-y-3">{selected.slice(currentPage * 8, currentPage * 8 + 8).map(line => {
        const id = String(line.shoot_service_id ?? line.shootServiceId);
        const quantity = normalizeBookingQuantity(line.quantity);
        const schedule = getShootSchedule({ scheduled_at: line.scheduled_at ?? line.scheduledAt, timezone: shoot.timezone });
        const setSchedule = (date: string, time: string) => update(line, { scheduled_at: date && time ? buildShootScheduleTimestamp(date, time, shoot.timezone, line.scheduled_at ?? line.scheduledAt) : null });
        return <fieldset key={id} className="min-w-0 rounded-lg border p-3" disabled={busy}><legend className="max-w-full break-words px-1 text-xs font-semibold">{line.name || 'Service'} · {unit?.label}</legend>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">{formatPrice(line.price)} each · <span className="font-semibold text-foreground">{formatPrice(line.price * quantity)}</span> total</div>
            {line.allow_multiple ? <div role="group" aria-label={`Quantity for ${line.name}`} className="inline-flex items-center rounded-lg border bg-background">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" aria-label={`Decrease ${line.name} quantity`} disabled={quantity <= 1} onClick={() => update(line, { quantity: quantity - 1 })}><Minus className="h-3.5 w-3.5" /></Button>
              <output aria-label={`${line.name} quantity`} aria-live="polite" className="min-w-7 px-1 text-center text-sm font-semibold tabular-nums">{quantity}</output>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-l-none" aria-label={`Increase ${line.name} quantity`} onClick={() => update(line, { quantity: quantity + 1 })}><Plus className="h-3.5 w-3.5" /></Button>
            </div> : <span className="text-xs text-muted-foreground">Quantity: {quantity}</span>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs">Date<Input aria-label={`${line.name} date`} type="date" value={schedule.date || ''} onChange={event => setSchedule(event.target.value, schedule.time || '09:00')} /></label>
          <label className="space-y-1 text-xs">Time<Input aria-label={`${line.name} time`} type="time" value={schedule.time || ''} onChange={event => setSchedule(schedule.date || '', event.target.value)} /></label>
          <label className="space-y-1 text-xs">Photographer<select aria-label={`${line.name} photographer`} className="h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm" value={String(line.photographer_id ?? '')} onChange={event => update(line, { photographer_id: event.target.value || null })}><option value="">Unassigned</option>{photographers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        </div><div className="mt-3"><ServiceDurationPicker durationSource={line} serviceName={`${line.name || 'Service'} · ${unit?.label || ''}`} value={line.duration_minutes} onChange={duration_minutes => update(line, { duration_minutes })} /></div></fieldset>;
      })}{!selected.length && <p className="rounded-lg border p-4 text-sm">This unit has no booked services. Add services before approval.</p>}</div>
      {selected.length > 8 && <div className="flex items-center justify-between gap-2 text-xs"><span>{currentPage * 8 + 1}–{Math.min((currentPage + 1) * 8, selected.length)} of {selected.length} services</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={(currentPage + 1) * 8 >= selected.length} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>}
      <label className="block space-y-1 text-xs">Internal approval notes<Textarea value={notes} onChange={event => setNotes(event.target.value)} disabled={busy} /></label>
      {error && <p role="alert" className="whitespace-pre-wrap break-words text-sm text-destructive">{error}</p>}
    </div>
    <DialogFooter className="shrink-0 border-t px-4 py-3 sm:px-6"><p className="mr-auto self-center text-sm">Services total: <span className="font-semibold tabular-nums">{formatPrice(total)}</span></p><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || travel.blocked} onClick={() => void approve()}>{busy ? 'Approving…' : `Approve ${units.length} units / areas`}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
