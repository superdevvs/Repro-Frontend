import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MessageSquareMore,
  User2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { WeeklyInvoice, WeeklyInvoiceTimelineEvent } from '@/services/invoiceService';
import type { ReviewWorkspaceRole } from './invoiceReviewWorkspaceUtils';
import {
  formatBillingPeriod,
  formatCurrency,
  formatRelativeTimestamp,
  getInvoiceWarnings,
  getStatusBadgeClassName,
  getStatusLabel,
} from './invoiceReviewWorkspaceUtils';

const getPayeeLabel = (role: ReviewWorkspaceRole, plural = false) => {
  if (role === 'salesRep') {
    return plural ? 'sales reps' : 'sales rep';
  }

  return plural ? 'photographers' : 'photographer';
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString();
};

const getSubmittedTimestamp = (invoice: WeeklyInvoice | null) => {
  if (!invoice) return undefined;
  return invoice.modified_at || invoice.created_at || invoice.last_activity_at || null;
};

const getTimelineTone = (event: WeeklyInvoiceTimelineEvent) => {
  switch (event.key) {
    case 'approved':
    case 'accounts_approved':
      return 'border-primary/20 bg-primary/5';
    case 'returned':
      return 'border-destructive/20 bg-destructive/5';
    default:
      return 'border-border/70 bg-muted/20';
  }
};

export const EmptyQueueState = ({ statusLabel, payeePlural }: { statusLabel: string; payeePlural: string }) => (
  <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/15 px-6 py-10 text-center">
    <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-background">
      <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
    </div>
    <div className="flex flex-col gap-1">
      <p className="text-base font-semibold">No {statusLabel.toLowerCase()} invoices</p>
      <p className="text-sm text-muted-foreground">
        Adjust the filters or wait for the next {payeePlural} submission.
      </p>
    </div>
  </div>
);

const getNumberFromRecord = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key];
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const getSalesRepCommissionSummary = (invoice: WeeklyInvoice) => {
  const snapshot = invoice.approval_snapshot || null;
  const itemMeta = (invoice.items || []).map((item) => item.meta || {});
  const commissionableGross = snapshot
    ? getNumberFromRecord(snapshot, 'commissionable_gross')
    : itemMeta.reduce((sum, meta) => sum + getNumberFromRecord(meta, 'commissionable_gross'), 0);
  const excludedFeeTotal = snapshot
    ? getNumberFromRecord(snapshot, 'excluded_fees_total') || getNumberFromRecord(snapshot, 'excluded_fee_total')
    : itemMeta.reduce(
        (sum, meta) =>
          sum + (getNumberFromRecord(meta, 'excluded_fees_total') || getNumberFromRecord(meta, 'excluded_fee_total')),
        0,
      );
  const commissionRate = snapshot
    ? getNumberFromRecord(snapshot, 'commission_rate')
    : getNumberFromRecord(itemMeta.find((meta) => meta.commission_rate != null), 'commission_rate');

  return {
    commissionableGross,
    excludedFeeTotal,
    commissionRate,
    commissionAmount: Number(invoice.total_amount || 0),
    isFrozen: Boolean(snapshot),
  };
};

export const DetailShell = ({
  invoice,
  detailLoading,
  onApprove,
  onReturn,
  onOpenInvoice,
  role,
}: {
  invoice: WeeklyInvoice | null;
  detailLoading: boolean;
  onApprove: () => void;
  onReturn: () => void;
  onOpenInvoice?: () => void;
  role: ReviewWorkspaceRole;
}) => {
  if (detailLoading) {
    return (
      <div className="flex min-h-[28rem] items-center justify-center rounded-2xl border border-border/70 bg-card/70">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading invoice detail...
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-[28rem] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-background">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold">Select an invoice</p>
          <p className="text-sm text-muted-foreground">
            Choose a {getPayeeLabel(role)} payout from the queue to review its details.
          </p>
        </div>
      </div>
    );
  }

  const charges = (invoice.items || []).filter((item) => item.type === 'charge');
  const expenses = (invoice.items || []).filter((item) => item.type === 'expense');
  const canReview = ['pending', 'pending_approval'].includes(invoice.approval_status);
  const payee = role === 'salesRep' ? invoice.salesRep : invoice.photographer;
  const warnings = getInvoiceWarnings(invoice);
  const commissionSummary = role === 'salesRep' ? getSalesRepCommissionSummary(invoice) : null;

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-col gap-4 border-b border-border/70">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{payee?.name || `${getPayeeLabel(role)} Invoice`}</CardTitle>
              <Badge variant="outline" className={cn('font-medium', getStatusBadgeClassName(invoice.approval_status))}>
                {getStatusLabel(invoice.approval_status)}
              </Badge>
            </div>
            <CardDescription>{payee?.email || 'No email available'}</CardDescription>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end)}</span>
              <span className="text-border">•</span>
              <span>Last activity {formatRelativeTimestamp(invoice.last_activity_at)}</span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Invoice total</div>
            <div className="text-3xl font-semibold">{formatCurrency(invoice.total_amount)}</div>
            {canReview ? (
              <div className="flex flex-wrap gap-2">
                {onOpenInvoice && role === 'photographer' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-950/40"
                    onClick={onOpenInvoice}
                  >
                    Open Invoice
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={onReturn}>
                  Return for Changes
                </Button>
                <Button size="sm" onClick={onApprove}>
                  Approve Amount
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {['approved', 'accounts_approved'].includes(invoice.approval_status)
                  ? `This ${getPayeeLabel(role)} invoice has already been approved.`
                  : `This invoice was returned to the ${getPayeeLabel(role)}.`}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Shoots</div>
            <div className="mt-2 text-lg font-semibold">{invoice.shoot_count || (invoice.shoots || []).length}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Charge Lines</div>
            <div className="mt-2 text-lg font-semibold">{invoice.charge_count || charges.length}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Expense Lines</div>
            <div className="mt-2 text-lg font-semibold">{invoice.expense_count || expenses.length}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Submitted</div>
            <div className="mt-2 text-sm font-medium">{formatTimestamp(getSubmittedTimestamp(invoice))}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-6">
        {warnings.length > 0 ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex flex-col gap-2">
                <div className="text-sm font-semibold">Unresolved warnings block approval by default</div>
                <div className="space-y-1 text-sm">
                  {warnings.map((warning, index) => (
                    <div key={`${warning.code || 'warning'}-${index}`}>
                      {warning.message || 'This invoice has an unresolved payout warning.'}
                    </div>
                  ))}
                </div>
                {invoice.warning_override_reason ? (
                  <div className="rounded-lg border border-amber-200 bg-background/70 px-3 py-2 text-sm">
                    Override reason: {invoice.warning_override_reason}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {commissionSummary ? (
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Commissionable</div>
              <div className="mt-2 text-lg font-semibold">{formatCurrency(commissionSummary.commissionableGross)}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Excluded Fees</div>
              <div className="mt-2 text-lg font-semibold">{formatCurrency(commissionSummary.excludedFeeTotal)}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Rate</div>
              <div className="mt-2 text-lg font-semibold">{commissionSummary.commissionRate || 15}%</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {commissionSummary.isFrozen ? 'Frozen Total' : 'Current Total'}
              </div>
              <div className="mt-2 text-lg font-semibold">{formatCurrency(commissionSummary.commissionAmount)}</div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.35fr_minmax(18rem,0.95fr)]">
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <MessageSquareMore className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Review Notes</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {role === 'salesRep' ? 'Sales rep note' : 'Photographer note'}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {invoice.modification_notes || `No ${getPayeeLabel(role)} note was included with this submission.`}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Return reason</div>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {invoice.rejection_reason || 'This invoice has not been returned by admin.'}
                  </p>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Line Items</h3>
              </div>
              <div className="flex flex-col gap-3">
                {charges.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="font-medium">{item.description}</div>
                        <div className="text-sm text-muted-foreground">Charge line</div>
                      </div>
                      <div className="text-sm font-semibold">{formatCurrency(item.total_amount)}</div>
                    </div>
                  </div>
                ))}
                {expenses.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="font-medium">{item.description}</div>
                        <div className="text-sm text-muted-foreground">Expense reimbursement</div>
                      </div>
                      <div className="text-sm font-semibold">{formatCurrency(item.total_amount)}</div>
                    </div>
                  </div>
                ))}
                {charges.length === 0 && expenses.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    No line items were returned for this invoice.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Linked Shoots</h3>
              </div>
              <div className="flex flex-col gap-3">
                {(invoice.shoots || []).map((shoot) => (
                  <div
                    key={String(shoot.id)}
                    className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background px-4 py-3"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="font-medium">
                        {shoot.address || shoot.location?.address || 'Address unavailable'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {[shoot.city || shoot.location?.city, shoot.state || shoot.location?.state].filter(Boolean).join(', ') || 'Location unavailable'}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                      <div>Client: {shoot.client?.name || 'Unknown client'}</div>
                      <div>Shoot total: {formatCurrency(shoot.total_quote)}</div>
                      <div>
                        Paid at:{' '}
                        {role === 'salesRep'
                          ? (shoot.sales_rep_paid_at ? formatTimestamp(shoot.sales_rep_paid_at) : 'Unpaid')
                          : (shoot.photographer_paid_at ? formatTimestamp(shoot.photographer_paid_at) : 'Unpaid')}
                      </div>
                    </div>
                  </div>
                ))}
                {(invoice.shoots || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    No linked shoots were returned for this invoice.
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-4">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Approval Timeline</h3>
              </div>
              <div className="flex flex-col gap-3">
                {(invoice.timeline || []).map((event) => (
                  <div
                    key={`${event.key}-${event.timestamp}`}
                    className={cn('rounded-xl border px-4 py-3', getTimelineTone(event))}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="font-medium">{event.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {event.actor?.name || 'System'} · {formatTimestamp(event.timestamp)}
                        </div>
                      </div>
                    </div>
                    {event.reason ? <p className="mt-2 text-sm leading-6 text-foreground">{event.reason}</p> : null}
                  </div>
                ))}
                {(invoice.timeline || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    No timeline activity is available for this invoice yet.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Audit History</h3>
              </div>
              <div className="flex flex-col gap-3">
                {(invoice.audit_events || []).map((event) => (
                  <div key={event.id} className="rounded-xl border border-border/70 bg-background px-4 py-3">
                    <div className="font-medium">{event.summary || event.event.replace(/_/g, ' ')}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {event.actor?.name || 'System'} · {formatTimestamp(event.created_at)}
                    </div>
                  </div>
                ))}
                {(invoice.audit_events || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    No audit events are available for this invoice yet.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-4">
              <div className="flex items-center gap-2">
                <User2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Actors</h3>
              </div>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Submitted by</span>
                  <span className="text-right font-medium">{invoice.modifiedBy?.name || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Returned by</span>
                  <span className="text-right font-medium">{invoice.rejectedBy?.name || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Approved by</span>
                  <span className="text-right font-medium">{invoice.approvedBy?.name || 'N/A'}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
