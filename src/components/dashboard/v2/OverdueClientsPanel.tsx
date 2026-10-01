import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import type { OverdueClientsState } from '@/features/dashboard/hooks/useOverdueClients';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function OverdueClientsPanel({ overdue }: { overdue: OverdueClientsState }) {
  if (overdue.loading) return <p role="status" className="p-3 text-sm text-muted-foreground">Loading overdue clients...</p>;
  if (overdue.error) return (
    <div role="alert" className="space-y-2 p-3 text-sm">
      <p>{overdue.error}</p>
      <Button variant="outline" size="sm" onClick={overdue.refresh}>Retry</Button>
    </div>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-xs text-muted-foreground">Unpaid balances more than 30 days after completion and delivery.</p>
      {!overdue.clients.length ? <EmptyState icon="clear" title="No overdue clients." size="compact" /> : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {overdue.clients.map((client) => (
            <details key={client.id} className="group rounded-lg border border-border/60 bg-muted/20 p-2.5">
              <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
                <ChevronRight aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-xs font-semibold">{client.name}</span>
                  <span className="text-[10px] text-muted-foreground">{client.shoots.length} shoot{client.shoots.length === 1 ? '' : 's'} · {client.oldestDays} days</span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-rose-700 dark:text-rose-400">{money.format(client.balanceDue)}</span>
              </summary>
              <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
                <div className="space-y-1 break-all text-xs text-muted-foreground">
                  {client.email && <a className="block hover:underline" href={`mailto:${client.email}`}>{client.email}</a>}
                  {client.phone && <a className="block hover:underline" href={`tel:${client.phone}`}>{client.phone}</a>}
                </div>
                {client.shoots.map((shoot) => (
                  <div key={shoot.id} className="rounded-md bg-background/70 p-2 text-xs">
                    <Link className="break-words font-medium text-primary hover:underline" to={`/shoots/${shoot.id}`}>{shoot.address || `Shoot #${shoot.id}`}</Link>
                    <div className="mt-1 flex flex-wrap justify-between gap-1 text-[10px] text-muted-foreground">
                      <span>{shoot.daysSinceCompletion} days since completion</span>
                      <span className="font-semibold tabular-nums">{money.format(shoot.balanceDue)} due</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
      {overdue.lastPage > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button size="sm" variant="outline" disabled={overdue.page <= 1} onClick={() => overdue.setPage(overdue.page - 1)}>Previous</Button>
          <span className="text-[10px] text-muted-foreground">{overdue.page} / {overdue.lastPage}</span>
          <Button size="sm" variant="outline" disabled={overdue.page >= overdue.lastPage} onClick={() => overdue.setPage(overdue.page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
