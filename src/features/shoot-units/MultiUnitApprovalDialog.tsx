import { usePaginationScrollReset } from '@/hooks/usePaginationScrollReset';
import { TravelFeasibilityPanel } from '@/features/travel/TravelFeasibilityPanel';
import { useTravelFeasibility, type TravelController } from '@/features/travel/useTravelFeasibility';
import { approvalScheduleChanges } from './approvalScheduleChanges';
import { shootTravelPayload } from '@/features/travel/travelPayload';
import { useEffect, useMemo, useState } from 'react';
import { ApprovalServiceCard } from './ApprovalServiceCard';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/services/api';
import { transformShootFromApi, type ApiShoot } from '@/context/shootNormalization';
import { normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import { formatPrice } from '@/utils/servicePricing';
import type { ShootServiceObject } from '@/types/shoots';
import { ShootUnitScopeBar } from './ShootUnitScope';
import { useShootUnitScope } from './useShootUnitScope';
import { allUnitLines, unitLinePayload } from './unitMutations';
import { getServiceUnitId } from './shootUnitData';
import '@/components/shoots/shootScheduleDialogs.css';
import { useShootEditorViewport } from '@/components/shoots/useShootEditorViewport';

type Props = { open: boolean; onClose: () => void; source: unknown; photographers: Array<{ id: string | number; name: string }>; onApproved?: () => void };
export function MultiUnitApprovalDialog({ open, onClose, source, photographers, onApproved }: Props) {
  const editor = useShootEditorViewport(open);
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
  const paginationListRef = usePaginationScrollReset(page);
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}><DialogContent data-shoot-dialog data-shoot-layout={editor.layout} data-shoot-short={editor.short} style={editor.style} className="shoot-editor-shell flex flex-col overflow-hidden p-0">
    <DialogHeader data-shoot-header className="shrink-0 border-b px-4 pb-4 pt-5 text-left sm:px-6"><DialogTitle className="pr-12 text-lg">Approve booking</DialogTitle><DialogDescription className="pr-8"><span className="block break-words font-medium text-foreground">{shoot.location?.address}</span><span className="block mt-1">{shoot.client?.name} · {lines.length} services · {units.length} {units.length === 1 ? 'unit / area' : 'units / areas'}</span></DialogDescription></DialogHeader>
    <div ref={paginationListRef} data-pagination-list data-shoot-body className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
      <div className="shoot-editor-toolbar">
        <div className="min-w-0"><ShootUnitScopeBar variant="compact" shoot={shoot} disabled={busy} /></div>
        <div className="min-w-0 flex-1"><TravelFeasibilityPanel compact travel={travel} /></div>
      </div>
      <div className="approval-editor-content">
        <aside className="approval-booking-details min-w-0 space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="hidden sm:block"><p className="text-[11px] font-medium text-muted-foreground">Property</p><p className="mt-1 break-words text-sm font-semibold">{shoot.location?.address}</p><p className="text-xs text-muted-foreground">{[shoot.location?.city, shoot.location?.state, shoot.location?.zip].filter(Boolean).join(', ')}</p></div>
          <div className="hidden sm:block"><p className="text-[11px] font-medium text-muted-foreground">Client</p><p className="text-sm font-medium">{shoot.client?.name}</p></div>
          <p className="hidden border-t pt-2 text-xs text-muted-foreground sm:block">Booked prices are retained. Adjust dates, times, duration, or photographers below.</p>
          <label className="hidden space-y-1 text-xs sm:block">Internal approval notes<Textarea className="min-h-[80px]" value={notes} onChange={event => setNotes(event.target.value)} disabled={busy} /></label>
        </aside>
        <div className="min-w-0 space-y-3">
      <div className="approval-services-grid">{selected.slice(currentPage * 8, currentPage * 8 + 8).map(line => {
        const id = String(line.shoot_service_id ?? line.shootServiceId);
        return <ApprovalServiceCard key={id} line={line} unitLabel={unit?.label} timezone={shoot.timezone} photographers={photographers} busy={busy} onChange={value => update(line, value)} onValidityChange={valid => setDurationValidity(previous => previous[id] === valid ? previous : { ...previous, [id]: valid })} />;
      })}{!selected.length && <p className="rounded-lg border p-4 text-sm">This unit has no booked services. Add services before approval.</p>}</div>
      {selected.length > 8 && <div className="flex items-center justify-between gap-2 text-xs"><span>{currentPage * 8 + 1}–{Math.min((currentPage + 1) * 8, selected.length)} of {selected.length} services</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={(currentPage + 1) * 8 >= selected.length} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>}
        </div>
      </div>
      <details className="approval-notes-disclosure rounded-xl border bg-muted/10 px-4"><summary className="cursor-pointer py-3 text-sm font-medium">Internal approval notes{notes.trim() ? ' · Added' : ' (optional)'}</summary><Textarea aria-label="Internal approval notes" className="mb-4 min-h-[80px]" value={notes} onChange={event => setNotes(event.target.value)} disabled={busy} /></details>
      {error && <p role="alert" className="whitespace-pre-wrap break-words text-sm text-destructive">{error}</p>}
    </div>
    <DialogFooter data-shoot-footer className="shrink-0 flex-row items-center gap-3 border-t bg-background px-4 py-3 sm:px-6"><p className="mr-auto text-xs text-muted-foreground"><span className="block">Services total</span><span className="text-base font-semibold tabular-nums text-foreground">{formatPrice(total)}</span></p><Button className="hidden min-[640px]:inline-flex h-11" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button className="h-11 px-6" aria-label={busy ? 'Approving…' : `${travel.canOverride || travel.canOverrideWorkingHours ? 'Review and approve' : 'Approve'} ${units.length} units / areas`} disabled={busy || travel.blocked || Object.values(durationValidity).includes(false)} onClick={() => void approve()}>{busy ? 'Approving…' : travel.canOverride || travel.canOverrideWorkingHours ? 'Review and approve' : 'Approve booking'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
