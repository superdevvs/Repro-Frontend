import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { accountingPeriods, accountingRangeForPeriod, accountingRangeLabel, validAccountingRange, type AccountingDateRange, type AccountingPeriod } from './accountingDateRange';

export function AccountingDateRangeControl({ value, period, onChange, label = 'Reporting period' }: {
  value: AccountingDateRange; period: AccountingPeriod; label?: string;
  onChange: (range: AccountingDateRange, period: AccountingPeriod) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const openCustom = () => { setDraft(value); setError(''); setOpen(true); };
  return <>
    <div className="flex min-w-0 flex-col gap-1 sm:items-end">
      <label className="text-[11px] text-muted-foreground" htmlFor="accounting-reporting-period">{label}</label>
      <div className="flex gap-2">
        <select id="accounting-reporting-period" className="h-10 max-w-full rounded-lg border bg-card px-3 text-sm" value={period} onChange={event => {
          const next = event.target.value as AccountingPeriod;
          if (next === 'custom') openCustom(); else onChange(accountingRangeForPeriod(next), next);
        }}>{accountingPeriods.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        {period === 'custom' && <Button size="sm" variant="outline" onClick={openCustom}>Edit dates</Button>}
      </div>
      <span className="text-[11px] text-muted-foreground">{accountingRangeLabel(value)}</span>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Custom reporting period</DialogTitle><DialogDescription>Select the first and last date, including both days.</DialogDescription></DialogHeader>
      <form onSubmit={event => { event.preventDefault(); if (!validAccountingRange(draft)) { setError('Choose valid dates with the end on or after the start.'); return; } onChange(draft, 'custom'); setOpen(false); }}>
        <div className="grid min-w-0 grid-cols-2 gap-3 py-4">
          <label className="min-w-0 space-y-2 text-sm">From<Input aria-label="Reporting start date" type="date" required value={draft.startDate} onChange={event => setDraft({ ...draft, startDate: event.target.value })} /></label>
          <label className="min-w-0 space-y-2 text-sm">To<Input aria-label="Reporting end date" type="date" required value={draft.endDate} onChange={event => setDraft({ ...draft, endDate: event.target.value })} /></label>
        </div>
        {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Apply dates</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
}
