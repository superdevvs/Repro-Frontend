import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatTimeForDisplay } from '@/utils/availabilityUtils';
import { normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';
import { formatPrice } from '@/utils/servicePricing';
import { draftUnitKey, lineTotal } from './model';
import { useBookingUnits } from './useMultiUnitBooking';

export function BookingUnitReview({ open, onClose, photographers }: { open: boolean; onClose: () => void; photographers: Array<{ id: string; name: string }> }) {
  const units = useBookingUnits();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  if (!units?.enabled) return null;
  const matches = units.draft.units.filter(unit => unit.label.toLowerCase().includes(query.toLowerCase()));
  const rows = matches.slice(page * 8, page * 8 + 8);
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden rounded-xl p-4">
      <DialogHeader><DialogTitle>Unit booking breakdown</DialogTitle><DialogDescription>Review each unit’s access, services, appointments, and prices.</DialogDescription></DialogHeader>
      <Input aria-label="Search unit breakdown" placeholder="Search units…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
      <div className="min-h-0 space-y-3 overflow-y-auto">
        {rows.map(unit => <section key={draftUnitKey(unit)} aria-label={`${unit.label} booking`} className="space-y-2 rounded-lg border p-3">
          <h3 className="font-semibold">{unit.label}</h3>
          <p className="text-xs text-muted-foreground">{unit.beds ?? 0} beds · {unit.baths ?? 0} baths · {unit.sqft?.toLocaleString() ?? '—'} sq ft</p>
          <p className="whitespace-pre-wrap break-words text-sm">{unit.access_notes || 'No access notes provided.'}</p>
          {units.schedule.lines.filter(line => line.unit_client_key === draftUnitKey(unit)).map(line => <div key={line.client_key} className="space-y-1 border-t pt-2 text-sm">
            <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words font-medium">{units.catalog.find(service => service.id === line.service_id)?.name} × {normalizeBookingQuantity(line.quantity)}</span><strong className="shrink-0">{formatPrice(lineTotal(line, unit, units.catalog))}</strong></div>
            <p>{line.scheduled_date} at {formatTimeForDisplay(line.start_time)}{line.duration > 0 ? `–${formatTimeForDisplay(line.end_time)}` : ''}</p>
            <p className="text-xs text-muted-foreground">{line.photographer_id ? photographers.find(person => String(person.id) === line.photographer_id)?.name || `Photographer ${line.photographer_id}` : 'No photographer needed'}</p>
          </div>)}
        </section>)}
        {!matches.length && <p className="text-sm text-muted-foreground">No matching units.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs"><span>{matches.length ? page * 8 + 1 : 0}–{Math.min(page * 8 + 8, matches.length)} of {matches.length}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={!page} onClick={() => setPage(page - 1)}>Previous</Button><Button type="button" variant="outline" size="sm" disabled={(page + 1) * 8 >= matches.length} onClick={() => setPage(page + 1)}>Next</Button><Button type="button" size="sm" onClick={onClose}>Done</Button></div></div>
    </DialogContent>
  </Dialog>;
}
