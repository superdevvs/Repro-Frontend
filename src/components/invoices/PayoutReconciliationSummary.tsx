import type { WeeklyInvoice, WeeklyInvoiceItem } from '@/services/invoiceService';

const money = (value: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));

export function PayoutReconciliationSummary({ invoice }: { invoice: WeeklyInvoice }) {
  const review = invoice.payout_review;
  const reconciliation = review?.reconciliation;
  if (invoice.role === 'salesRep') return null;
  return <section aria-label="Payout reconciliation" className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
    <p className="font-medium">Photographer work and invoice reconciliation</p>
    <p className="text-xs leading-relaxed text-muted-foreground">Submitted / uploaded work, delivered work and completed floorplans qualify. Editing and client delivery do not delay completed photographer work. Approval and payment remain separate.</p>
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
      {review?.before_total != null && <span>Before corrections <strong>{money(review.before_total)}</strong></span>}
      <span>Current invoice <strong>{money(invoice.total_amount)}</strong></span>
      {review?.before_total != null && <span>Change <strong>{money(invoice.total_amount - review.before_total)}</strong></span>}
      {review?.submitted_total != null && <span>Submitted for review <strong>{money(review.submitted_total)}</strong></span>}
    </div>
    {reconciliation && <>
      <p className="text-xs"><strong>{reconciliation.pending_count} shoots pending photographer completion · {money(reconciliation.pending_total)}</strong> · excluded from this invoice</p>
      {reconciliation.unallocated_count > 0 && <p className="text-xs text-amber-700 dark:text-amber-300"><strong>{reconciliation.unallocated_count} completed service lines · {money(reconciliation.unallocated_total)}</strong> awaiting allocation. Add the linked work or let the next reconciliation create a supplemental draft.</p>}
      {!!reconciliation.pending_lines.length && <details><summary className="cursor-pointer text-xs font-medium">See pending work and reasons</summary><ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs">{reconciliation.pending_lines.map(line => <li key={`${line.shoot_id}-${line.shoot_service_id}`} className="border-t pt-2"><p className="break-words font-medium">{line.work_date} · {line.address} · {money(line.amount)}</p><p className="text-muted-foreground">{line.service_name} · {line.reason}</p></li>)}</ul></details>}
    </>}
  </section>;
}

export function PayoutBasisSummary({ item }: { item: WeeklyInvoiceItem }) {
  const value = item.meta?.payout_basis;
  if (!value || typeof value !== 'object') return null;
  const basis = value as Record<string, unknown>;
  const previous = basis.previous_basis as Record<string, unknown> | undefined;
  const bookedTotal = Number(basis.unit_pay ?? 0) * Number(basis.quantity ?? 1);
  return <div className="mt-2 space-y-1 text-xs text-muted-foreground">
    <p className="break-words">Booked {String(basis.service_name ?? 'Service')} · {money(basis.booked_price)}{basis.photo_count != null ? ` · ${String(basis.photo_count)} photos` : ''}</p>
    <p>{basis.pay_type === 'percent' ? `${String(basis.percent)}% of booked price` : basis.pay_type === 'override' ? 'Agreed payout override' : 'Agreed fixed payout'} · {money(basis.unit_pay)} per unit · saved booking rate</p>
    {item.meta?.late_work === true && <p className="text-amber-700 dark:text-amber-300">Earlier-week work · original shoot date retained · allocated once</p>}
    {basis.review_required === true && <p className="text-amber-700 dark:text-amber-300">Package / payout basis changed{previous ? ` · previous payout ${money(previous.unit_pay)}` : ''}. Accounts must verify the agreement.</p>}
    {Number(item.total_amount) !== bookedTotal && <p className="text-amber-700 dark:text-amber-300">Invoice correction · booked payout {money(bookedTotal)} → reviewed line {money(item.total_amount)}</p>}
  </div>;
}
