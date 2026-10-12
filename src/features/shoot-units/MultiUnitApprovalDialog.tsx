import { TravelFeasibilityPanel } from '@/features/travel/TravelFeasibilityPanel';
import { useTravelFeasibility, type TravelController } from '@/features/travel/useTravelFeasibility';
import { approvalScheduleChanges } from './approvalScheduleChanges';
import { shootTravelPayload } from '@/features/travel/travelPayload';
import { useEffect, useMemo, useState } from 'react';
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
  const [durationValidity, setDurationValidity] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  useEffect(() => {
    setChanges({}); setNotes(''); setError(''); setDurationValidity({}); setPage(0);
  }, [open, shoot.id]);
  const lines = allUnitLines(shoot).map(line => ({ ...line, ...changes[String(line.shoot_service_id ?? line.shootServiceId)] }));
  const serviceLinesPayload = lines.map(unitLinePayload);
  const firstStart = serviceLinesPayload.map(line => line.scheduled_at).filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  const travel: TravelController = { ...useTravelFeasibility({ payload: open ? shootTravelPayload(shoot, { expected_units_revision: shoot.units_revision, service_lines: serviceLinesPayload, ...(firstStart ? { scheduled_at: firstStart } : {}) }, 'approve') : null,
    onScheduleChange: change => {
      const shifted = approvalScheduleChanges(lines, shoot.timezone, change);
      setChanges(previous => Object.fromEntries([...new Set([...Object.keys(previous), ...Object.keys(shifted)])]
        .map(id => [id, { ...previous[id], ...shifted[id] }])));
    },
  }), dayScheduleScope: true, photographerNames: Object.fromEntries(photographers.map(person => [String(person.id), person.name])) };
  const total = lines.reduce((sum, line) => sum + line.price * normalizeBookingQuantity(line.quantity), 0);
  const selected = lines.filter(line => getServiceUnitId(line) === activeUnitId);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(selected.length / 8) - 1));
  const update = (line: ShootServiceObject, value: Partial<ShootServiceObject>) => {
    const id = String(line.shoot_service_id ?? line.shootServiceId);
    setChanges(previous => ({ ...previous, [id]: { ...previous[id], ...value } }));
  };
  const approve = async () => {
    if (busy || travel.blocked || Object.values(durationValidity).includes(false)) return;
    setBusy(true); setError('');
    try {
      const travelConfirmation = await travel.confirmSave();
      if (!travelConfirmation) return;
      const service_lines = lines.map(unitLinePayload);
      const scheduled_at = service_lines.map(line => line.scheduled_at).filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
      await apiClient.post(`/shoots/${shoot.id}/approve`, { ...travelConfirmation, expected_units_revision: shoot.units_revision, service_lines, ...(scheduled_at ? { scheduled_at } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) });
      onApproved?.(); onClose();
    } catch (caught) {
      const data = (caught as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
      travel.acceptServerError(data);
      setError(Object.values(data?.errors ?? {}).flat().join(' ') || data?.message || 'Approval failed. Review the assignments and try again.');
    } finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}><DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-[1200px] flex-col overflow-hidden p-0">
    <DialogHeader className="shrink-0 px-4 pt-4 text-left sm:px-6"><DialogTitle>Approve multi-unit booking</DialogTitle><DialogDescription>{units.length} units / areas · {lines.length} services · Review schedules and assignments before approving.</DialogDescription></DialogHeader>
    <div className="min-h-0 space-y-3 overflow-y-auto px-4 py-3 sm:px-6">
      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-start">
        <div className="min-w-0 lg:w-[390px] lg:shrink-0"><ShootUnitScopeBar variant="compact" shoot={shoot} disabled={busy} /></div>
        <div className="min-w-0 flex-1"><TravelFeasibilityPanel compact travel={travel} /></div>
      </div>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-3 rounded-lg border bg-muted/20 p-3">
          <div><p className="text-[11px] font-medium text-muted-foreground">Property</p><p className="mt-1 break-words text-sm font-semibold">{shoot.location?.address}</p><p className="text-xs text-muted-foreground">{[shoot.location?.city, shoot.location?.state, shoot.location?.zip].filter(Boolean).join(', ')}</p></div>
          <div><p className="text-[11px] font-medium text-muted-foreground">Client</p><p className="text-sm font-medium">{shoot.client?.name}</p></div>
          <p className="border-t pt-2 text-xs text-muted-foreground">Booked prices are retained. Adjust dates, times, duration, or photographers below.</p>
          <label className="block space-y-1 text-xs">Internal approval notes<Textarea className="min-h-[80px]" value={notes} onChange={event => setNotes(event.target.value)} disabled={busy} /></label>
        </aside>
        <div className="min-w-0 space-y-3">
      <div className="grid min-w-0 gap-3 md:grid-cols-2">{selected.slice(currentPage * 8, currentPage * 8 + 8).map(line => {
        const id = String(line.shoot_service_id ?? line.shootServiceId);
        const quantity = normalizeBookingQuantity(line.quantity);
        const schedule = getShootSchedule({ scheduled_at: line.scheduled_at ?? line.scheduledAt, timezone: shoot.timezone });
        const setSchedule = (date: string, time: string) => update(line, { scheduled_at: date && time ? buildShootScheduleTimestamp(date, time, shoot.timezone, line.scheduled_at ?? line.scheduledAt) : null });
        return <fieldset key={id} className="min-w-0 rounded-lg border p-3" disabled={busy}><legend className="max-w-full break-words px-1 text-xs font-semibold">{line.name || 'Service'} · {unit?.label}</legend>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">{formatPrice(line.price)} each · <span className="font-semibold text-foreground">{formatPrice(line.price * quantity)}</span> total</div>
            {line.allow_multiple ? <div role="group" aria-label={`Quantity for ${line.name}`} className="inline-flex items-center rounded-lg border bg-background">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" aria-label={`Decrease ${line.name} quantity`} disabled={quantity <= 1} onClick={() => update(line, { quantity: quantity - 1 })}><Minus className="h-3.5 w-3.5" /></Button>
              <output aria-label={`${line.name} quantity`} aria-live="polite" className="min-w-7 px-1 text-center text-sm font-semibold tabular-nums">{quantity}</output>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-l-none" aria-label={`Increase ${line.name} quantity`} onClick={() => update(line, { quantity: quantity + 1 })}><Plus className="h-3.5 w-3.5" /></Button>
            </div> : <span className="text-xs text-muted-foreground">Quantity: {quantity}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs">Date<Input aria-label={`${line.name} date`} type="date" value={schedule.date || ''} onChange={event => setSchedule(event.target.value, schedule.time || '09:00')} /></label>
          <label className="space-y-1 text-xs">Time<Input aria-label={`${line.name} time`} type="time" value={schedule.time || ''} onChange={event => setSchedule(schedule.date || '', event.target.value)} /></label>
          <label className="col-span-2 space-y-1 text-xs">Photographer<select aria-label={`${line.name} photographer`} className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm" value={String(line.photographer_id ?? '')} onChange={event => update(line, { photographer_id: event.target.value || null })}><option value="">Unassigned</option>{photographers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        </div><div className="mt-2 border-t pt-2"><ServiceDurationPicker showSlider={false} durationSource={line} serviceName={`${line.name || 'Service'} · ${unit?.label || ''}`} value={line.duration_minutes} onChange={duration_minutes => update(line, { duration_minutes })} onValidityChange={valid => setDurationValidity(previous => previous[id] === valid ? previous : { ...previous, [id]: valid })} /></div></fieldset>;
      })}{!selected.length && <p className="rounded-lg border p-4 text-sm">This unit has no booked services. Add services before approval.</p>}</div>
      {selected.length > 8 && <div className="flex items-center justify-between gap-2 text-xs"><span>{currentPage * 8 + 1}–{Math.min((currentPage + 1) * 8, selected.length)} of {selected.length} services</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={(currentPage + 1) * 8 >= selected.length} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>}
        </div>
      </div>
      {error && <p role="alert" className="whitespace-pre-wrap break-words text-sm text-destructive">{error}</p>}
    </div>
    <DialogFooter className="shrink-0 border-t px-4 py-3 sm:px-6"><p className="mr-auto self-center text-sm">Services total: <span className="font-semibold tabular-nums">{formatPrice(total)}</span></p><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || travel.blocked || Object.values(durationValidity).includes(false)} onClick={() => void approve()}>{busy ? 'Approving…' : `Approve ${units.length} units / areas`}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
