import { AlertTriangle, FileText } from 'lucide-react';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { WeeklyInvoice } from '@/services/invoiceService';
import { InvoiceAccountsNote } from './InvoiceAccountsNote';
import { payoutInvoiceLines } from '@/components/invoices/payoutInvoiceLinePresentation';
import {
  formatBillingPeriod, formatCurrency, formatRelativeTimestamp, getInvoiceWarnings,
  getSalesRepCommissionSummary, getStatusBadgeClassName, getStatusLabel, type ReviewWorkspaceRole,
} from './invoiceReviewWorkspaceUtils';
import './admin-review-workspace.css';

const timestamp = (value?: string | null) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Not available';
  return new Date(value).toLocaleString();
};

export const EmptyQueueState = ({ statusLabel, payeePlural }: { statusLabel: string; payeePlural: string }) => (
  <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
    <FileText className="size-6 text-muted-foreground" />
    <p className="font-medium">No {statusLabel === 'All records' ? '' : statusLabel.toLowerCase() + ' '}invoices</p>
    <p className="text-xs text-muted-foreground">Adjust the filters or wait for the next {payeePlural} submission.</p>
  </div>
);

export const DetailShell = ({ invoice, detailLoading, onApprove, onReturn, onOpenInvoice, onEditInvoice, role }: {
  invoice: WeeklyInvoice | null;
  detailLoading: boolean;
  onApprove: () => void;
  onReturn: () => void;
  onOpenInvoice?: () => void;
  onEditInvoice?: () => void;
  role: ReviewWorkspaceRole;
}) => {
  if (detailLoading || !invoice) return <div className="ar-detail flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
    {detailLoading ? <span className="flex items-center gap-2"><InlineSpinner className="size-4" /> Loading invoice detail…</span>
      : <span>Select an invoice to review payout lines, notes and history.</span>}
  </div>;
  const canReview = ['pending', 'pending_approval'].includes(invoice.approval_status);
  const payee = (role === 'salesRep' ? invoice.salesRep : invoice.photographer) ?? invoice.payee;
  const warnings = getInvoiceWarnings(invoice);
  const commission = role === 'salesRep' ? getSalesRepCommissionSummary(invoice) : null;
  const items = invoice.items || [];
  return <section className="ar-detail" aria-label="Selected invoice detail">
    <header className="ar-detail-header">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{payee?.name || 'Invoice'} <span className="text-xs font-normal text-muted-foreground">W-{invoice.id}</span></h2>
          <Badge variant="outline" className={getStatusBadgeClassName(invoice.approval_status)}>{invoice.payout_review?.label || getStatusLabel(invoice.approval_status)}</Badge>
        </div>
        <p className="mt-1 break-all text-xs text-muted-foreground">{payee?.email || 'No email available'}</p>
        <p className="mt-2 text-xs text-muted-foreground">{formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end)} · Updated {formatRelativeTimestamp(invoice.last_activity_at)}</p>
      </div>
      <div className="shrink-0"><p className="text-xs text-muted-foreground">Invoice total</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(invoice.total_amount)}</p></div>
    </header>
    <Tabs key={invoice.id} defaultValue="details" className="ar-detail-tabs">
      <div className="ar-detail-tabbar">
        <TabsList className="h-9"><TabsTrigger value="details" className="text-xs">Details</TabsTrigger><TabsTrigger value="history" className="text-xs">Notes &amp; history</TabsTrigger></TabsList>
        <div className="flex flex-wrap gap-2">{onEditInvoice && ['pending', 'pending_approval', 'rejected'].includes(invoice.approval_status) && !invoice.is_paid && !invoice.paid_at && Number(invoice.amount_paid) === 0 && <Button variant="outline" size="sm" onClick={onEditInvoice}>Edit invoice</Button>}{onOpenInvoice && <Button variant="outline" size="sm" onClick={onOpenInvoice}>View invoice</Button>}</div>
      </div>
      <TabsContent value="details" className="ar-detail-body">
        <div className="ar-facts">
          <span><strong>{invoice.shoot_count ?? invoice.shoots?.length ?? 0}</strong> shoots</span>
          <span><strong>{invoice.charge_count ?? items.filter((item) => item.type === 'charge').length}</strong> charges</span>
          <span><strong>{invoice.expense_count ?? items.filter((item) => item.type === 'expense').length}</strong> expenses</span>
          <span>Submitted {timestamp(invoice.modified_at || invoice.created_at || invoice.last_activity_at)}</span>
        </div>
        {!!warnings.length && <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <h3 className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 shrink-0" /> Unresolved warnings</h3>
          <p className="mt-1 text-xs text-muted-foreground">Approval requires an accounts override reason.</p>
          {warnings.map((warning, index) => <p className="mt-2 text-xs" key={index}>{warning.message || 'Unresolved payout warning.'}</p>)}
        </section>}
        {invoice.warning_override_reason && <p className="rounded-lg bg-muted/40 p-3 text-xs"><strong>Accounts override:</strong> {invoice.warning_override_reason}</p>}
        {commission && <div className="ar-facts ar-commission">
          <span>Commissionable <strong>{formatCurrency(commission.commissionableGross)}</strong></span>
          <span>Excluded fees <strong>{formatCurrency(commission.excludedFeeTotal)}</strong></span>
          <span>Rate <strong>{commission.commissionRate == null ? 'Not recorded' : `${commission.commissionRate}%`}</strong></span>
          <span>{commission.isFrozen ? 'Frozen total' : 'Current total'} <strong>{formatCurrency(commission.commissionAmount)}</strong></span>
        </div>}
        <section><h3 className="ar-section-title">Line items <span>{items.length}</span></h3>
          <div className="ar-table-scroll"><table className="ar-table"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th className="text-right">Amount</th></tr></thead>
            <tbody>{payoutInvoiceLines(invoice).map(({ item, dateLabel }) => <tr key={item.id}><td className="whitespace-nowrap text-muted-foreground">{dateLabel}</td><td>{item.description}</td><td className="capitalize text-muted-foreground">{item.type}</td><td className="text-right font-medium tabular-nums">{formatCurrency(item.total_amount)}</td></tr>)}</tbody>
          </table></div>{!items.length && <p className="ar-empty">No line items are available.</p>}
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-lg bg-muted/30 p-3 text-xs"><h3 className="mb-2 font-semibold">{role === 'salesRep' ? 'Sales rep' : 'Photographer'} note</h3><p className="whitespace-pre-wrap text-muted-foreground">{invoice.modification_notes || 'No submission note.'}</p></section>
          <section className="rounded-lg bg-muted/30 p-3 text-xs"><h3 className="mb-2 font-semibold">Latest return reason</h3><p className="whitespace-pre-wrap text-muted-foreground">{invoice.payout_review?.last_return_reason || invoice.rejection_reason || 'This invoice has not been returned.'}</p></section>
        </div>
        <section><h3 className="ar-section-title">Linked shoots <span>{invoice.shoots?.length || 0}</span></h3>
          {(invoice.shoots || []).map((shoot) => {
            const paidAt = role === 'salesRep' ? shoot.sales_rep_paid_at : shoot.photographer_paid_at;
            return <div className="ar-linked-shoot" key={String(shoot.id)}><div className="min-w-0"><p className="font-medium">{shoot.address || shoot.location?.address || 'Address unavailable'}</p><p className="text-muted-foreground">{[shoot.city || shoot.location?.city, shoot.state || shoot.location?.state].filter(Boolean).join(', ')} · {shoot.client?.name || 'Unknown client'}</p></div><div className="text-right"><p>{formatCurrency(shoot.total_quote)} shoot total</p><p className="text-muted-foreground">{paidAt ? `Payout recorded ${timestamp(paidAt)}` : 'Payout not recorded'}</p></div></div>;
          })}{!invoice.shoots?.length && <p className="ar-empty">No linked shoots.</p>}
        </section>
      </TabsContent>
      <TabsContent value="history" className="ar-detail-body">
        <InvoiceAccountsNote invoiceId={invoice.id} />
        <section><h3 className="ar-section-title">Approval timeline</h3>
          {(invoice.timeline || []).map((event, index) => <div key={`${event.key}-${index}`} className="ar-history-event"><p className="font-medium">{event.label}</p><p className="text-xs text-muted-foreground">{event.actor?.name || 'System'} · {timestamp(event.timestamp)}</p>{event.reason && <p className="mt-1 whitespace-pre-wrap text-xs">{event.reason}</p>}</div>)}
          {!invoice.timeline?.length && <p className="ar-empty">No timeline activity yet.</p>}
        </section>
        <section><h3 className="ar-section-title">Audit history</h3>
          {(invoice.audit_events || []).map((event) => <div className="ar-history-event" key={event.id}><p className="font-medium">{event.summary || event.event.replace(/_/g, ' ')}</p><p className="text-xs text-muted-foreground">{event.actor?.name || 'System'} · {timestamp(event.created_at)}</p></div>)}
          {!invoice.audit_events?.length && <p className="ar-empty">No audit events yet.</p>}
        </section>
        <dl className="ar-facts"><div><dt>Submitted by</dt><dd>{invoice.modifiedBy?.name || 'Unknown'}</dd></div><div><dt>Returned by</dt><dd>{invoice.rejectedBy?.name || 'N/A'}</dd></div><div><dt>Approved by</dt><dd>{invoice.approvedBy?.name || 'N/A'}</dd></div></dl>
      </TabsContent>
    </Tabs>
    <footer className="ar-decisionbar"><p className="text-xs text-muted-foreground">{canReview ? 'Review the amount before recording approval.' : `Status: ${getStatusLabel(invoice.approval_status)}. Payment is recorded separately.`}</p>
      {canReview && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={onReturn}>Return for changes</Button><Button size="sm" onClick={onApprove}>Approve amount</Button></div>}
    </footer>
  </section>;
};
