import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { ShootData } from '@/types/shoots';

/** The backend only exposes the complete source snapshot to administrators. */
export function HistoricalImportSummary({ shoot }: { shoot: ShootData }) {
  const payload = shoot.external_booking_payload;
  const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (!record(payload?.legacy_migration).released_to_history) return null;
  const fields = record(record(payload?.source_record).source_record);
  return <Dialog>
    <section className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-1 text-sm" aria-label="Historical import details">
      <p className="min-w-0 truncate font-medium">Historical shoot · Paid</p>
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="h-8 shrink-0 px-0">View details</Button>
      </DialogTrigger>
    </section>
    <DialogContent className="flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-lg p-4 sm:p-6">
      <DialogHeader className="shrink-0 pr-6 text-left">
        <DialogTitle>Historical shoot details</DialogTitle>
        <DialogDescription>Paid in the old dashboard</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto text-sm">
        <div className="space-y-2 text-muted-foreground">
          <p>{String(fields['TOTAL PAID'] ?? '')} recorded as collected. Last payment: {String(fields['LAST PAYMENT DATE'] ?? '')} ({String(fields['LAST PAYMENT TYPE'] ?? '')}). No new charge or notification was sent.</p>
          <p>Services use the original package total. Individual service prices, payment transactions, and staff payout history were not included in the export.</p>
          <p>Original photographer: {String(fields['PHOTOGRAPHER'] || 'Not supplied')}. Completed: {String(fields['COMPLETED'] || 'Not supplied')}.</p>
        </div>
        <h3 className="mt-4 font-medium">Original shoot details</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(fields).map(([name, value]) => <div className="min-w-0" key={name}>
          <dt className="text-xs text-muted-foreground">{name}</dt>
          <dd className="whitespace-pre-wrap break-words">{String(value || '—')}</dd>
        </div>)}</dl>
      </div>
    </DialogContent>
  </Dialog>;
}
