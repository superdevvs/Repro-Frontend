import { ShootData } from '@/types/shoots';

/** The backend only exposes the complete source snapshot to administrators. */
export function HistoricalImportSummary({ shoot }: { shoot: ShootData }) {
  const payload = shoot.external_booking_payload;
  const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (!record(payload?.legacy_migration).released_to_history) return null;
  const fields = record(record(payload?.source_record).source_record);
  return <section className="rounded-lg border bg-muted/30 p-3 text-sm" aria-label="Historical import details">
    <p className="font-medium">Historical shoot · Paid in the old dashboard</p>
    <p className="mt-1 text-muted-foreground">{String(fields['TOTAL PAID'] ?? '')} recorded as collected. Last payment: {String(fields['LAST PAYMENT DATE'] ?? '')} ({String(fields['LAST PAYMENT TYPE'] ?? '')}). No new charge or notification was sent.</p>
    <p className="mt-1 text-muted-foreground">Services use the original package total. Individual service prices, payment transactions, and staff payout history were not included in the export.</p>
    <p className="mt-1 text-muted-foreground">Original photographer: {String(fields['PHOTOGRAPHER'] || 'Not supplied')}. Completed: {String(fields['COMPLETED'] || 'Not supplied')}.</p>
    <details className="mt-2">
      <summary className="cursor-pointer font-medium">Original shoot details</summary>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(fields).map(([name, value]) => <div key={name}>
        <dt className="text-xs text-muted-foreground">{name}</dt>
        <dd className="whitespace-pre-wrap break-words">{String(value || '—')}</dd>
      </div>)}</dl>
    </details>
  </section>;
}
