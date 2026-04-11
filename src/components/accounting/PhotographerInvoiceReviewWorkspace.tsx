import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  Download,
  FileText,
  Loader2,
  MessageSquareMore,
  RefreshCw,
  Search,
  User2,
} from 'lucide-react';

import { PayoutReportPanel } from '@/components/accounting/PayoutReportPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  adminRejectWeeklyInvoice,
  approveWeeklyInvoice,
  fetchAdminInvoiceReviewDetail,
  fetchAdminInvoiceReviewQueue,
  type WeeklyInvoice,
  type WeeklyInvoiceReviewQueueResponse,
  type WeeklyInvoiceTimelineEvent,
} from '@/services/invoiceService';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';

type ReviewWorkspaceTab = 'review-queue' | 'payout-report';
type ReviewStatusFilter = 'pending_approval' | 'approved' | 'rejected';
type ReviewWorkspaceRole = 'photographer' | 'salesRep';

interface InvoiceReviewWorkspaceProps {
  role?: ReviewWorkspaceRole;
  title?: string;
  shortLabel?: string;
  pluralLabel?: string;
}

const STATUS_OPTIONS: Array<{ value: ReviewStatusFilter; label: string }> = [
  { value: 'pending_approval', label: 'Needs review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Returned' },
];

const getPayeeLabel = (role: ReviewWorkspaceRole, plural = false) => {
  if (role === 'salesRep') {
    return plural ? 'sales reps' : 'sales rep';
  }

  return plural ? 'photographers' : 'photographer';
};

const formatCurrency = (amount: number | string | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount || 0));

const formatBillingPeriod = (start?: string, end?: string) => {
  if (!start || !end) return 'Billing period unavailable';

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 'Billing period unavailable';
  }

  const startLabel = formatter.format(startDate);
  const endLabel = formatter.format(endDate);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString();
};

const getSubmittedTimestamp = (invoice: WeeklyInvoice | null) => {
  if (!invoice) return undefined;
  return invoice.modified_at || invoice.created_at || invoice.last_activity_at || null;
};

const formatRelativeTimestamp = (value?: string | null) => {
  if (!value) return 'No recent activity';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No recent activity';

  return formatDistanceToNowStrict(parsed, { addSuffix: true });
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending':
    case 'pending_approval':
      return 'Needs Review';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Returned';
    default:
      return status;
  }
};

const getStatusBadgeClassName = (status: string) => {
  switch (status) {
    case 'pending':
    case 'pending_approval':
      return 'border-primary/20 bg-primary/10 text-primary';
    case 'approved':
      return 'border-border bg-secondary text-secondary-foreground';
    case 'rejected':
      return 'border-destructive/20 bg-destructive/10 text-destructive';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
};

const getTimelineTone = (event: WeeklyInvoiceTimelineEvent) => {
  switch (event.key) {
    case 'approved':
      return 'border-primary/20 bg-primary/5';
    case 'returned':
      return 'border-destructive/20 bg-destructive/5';
    default:
      return 'border-border/70 bg-muted/20';
  }
};

const EmptyQueueState = ({ statusLabel, payeePlural }: { statusLabel: string; payeePlural: string }) => (
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

const DetailShell = ({
  invoice,
  detailLoading,
  onApprove,
  onReturn,
  role,
}: {
  invoice: WeeklyInvoice | null;
  detailLoading: boolean;
  onApprove: () => void;
  onReturn: () => void;
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
                <Button size="sm" variant="outline" onClick={onReturn}>
                  Return for Changes
                </Button>
                <Button size="sm" onClick={onApprove}>
                  Approve &amp; Mark Shoots Paid
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {invoice.approval_status === 'approved'
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

export function PhotographerInvoiceReviewWorkspace({
  role = 'photographer',
  title,
  shortLabel,
  pluralLabel,
}: InvoiceReviewWorkspaceProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [workspaceTab, setWorkspaceTab] = useState<ReviewWorkspaceTab>('review-queue');
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('pending_approval');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [queueResponse, setQueueResponse] = useState<WeeklyInvoiceReviewQueueResponse | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<WeeklyInvoice | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());
  const resolvedShortLabel = shortLabel || (role === 'salesRep' ? 'Sales Rep' : 'Photographer');
  const resolvedPluralLabel = pluralLabel || (role === 'salesRep' ? 'Sales Reps' : 'Photographers');
  const resolvedTitle = title || `${resolvedPluralLabel} Review`;

  const queue = queueResponse?.data || [];
  const summary = queueResponse?.summary || {
    invoice_count: 0,
    total_amount: 0,
    needs_review_count: 0,
    approved_count: 0,
    returned_count: 0,
  };

  const selectedStatusLabel = useMemo(
    () => STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label || 'Review',
    [statusFilter],
  );

  const summaryCards = useMemo(
    () => [
      {
        label: 'Filtered invoices',
        value: summary.invoice_count,
        icon: FileText,
      },
      {
        label: 'Filtered payout',
        value: formatCurrency(summary.total_amount),
        icon: DollarSign,
      },
      {
        label: 'Needs review',
        value: summary.needs_review_count,
        icon: Clock3,
      },
      {
        label: 'Returned',
        value: summary.returned_count,
        icon: MessageSquareMore,
      },
    ],
    [summary.invoice_count, summary.needs_review_count, summary.returned_count, summary.total_amount],
  );

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);

    try {
      const response = await fetchAdminInvoiceReviewQueue({
        role,
        approval_status: statusFilter,
        search: deferredSearch || undefined,
        start: startDate || undefined,
        end: endDate || undefined,
        page,
        per_page: 10,
      });

      setQueueResponse(response);
      setSelectedInvoiceId((current) => {
        if (!response.data.length) {
          return null;
        }

        const currentStillVisible = current != null && response.data.some((invoice) => invoice.id === current);
        return currentStillVisible ? current : response.data[0].id;
      });

      if (!response.data.length) {
        setSelectedInvoice(null);
        setMobileDetailOpen(false);
      }

      return response;
    } catch (error) {
      toast({
        title: `Failed to load ${resolvedShortLabel.toLowerCase()} review queue`,
        description: error instanceof Error ? error.message : 'Unable to load the review queue.',
        variant: 'destructive',
      });
      setQueueResponse(null);
      setSelectedInvoiceId(null);
      setSelectedInvoice(null);
      return null;
    } finally {
      setQueueLoading(false);
    }
  }, [deferredSearch, endDate, page, resolvedShortLabel, role, startDate, statusFilter, toast]);

  useEffect(() => {
    if (workspaceTab !== 'review-queue') {
      return;
    }

    void loadQueue();
  }, [loadQueue, workspaceTab]);

  useEffect(() => {
    if (workspaceTab !== 'review-queue' || selectedInvoiceId == null) {
      return;
    }

    let active = true;
    setDetailLoading(true);

    void fetchAdminInvoiceReviewDetail(selectedInvoiceId)
      .then((invoice) => {
        if (!active) return;
        setSelectedInvoice(invoice);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: 'Failed to load invoice detail',
          description: error instanceof Error ? error.message : 'Unable to load the invoice detail.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedInvoiceId, toast, workspaceTab]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, endDate, startDate, statusFilter]);

  const handleSelectInvoice = (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId);

    if (isMobile) {
      setMobileDetailOpen(true);
    }
  };

  const handleRefresh = async () => {
    const response = await loadQueue();
    if (response && selectedInvoiceId != null && response.data.some((invoice) => invoice.id === selectedInvoiceId)) {
      setDetailLoading(true);
      try {
        const detail = await fetchAdminInvoiceReviewDetail(selectedInvoiceId);
        setSelectedInvoice(detail);
      } catch (error) {
        toast({
          title: 'Failed to refresh invoice detail',
          description: error instanceof Error ? error.message : 'Unable to refresh the selected invoice.',
          variant: 'destructive',
        });
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const rows = queue.map((invoice) => ({
      payee: role === 'salesRep' ? invoice.salesRep?.name || 'Sales Rep' : invoice.photographer?.name || 'Photographer',
      email: role === 'salesRep' ? invoice.salesRep?.email || '' : invoice.photographer?.email || '',
      period: formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end),
      status: getStatusLabel(invoice.approval_status),
      shoots: invoice.shoot_count || 0,
      expenses: invoice.expense_count || 0,
      total: formatCurrency(invoice.total_amount),
      updated: formatRelativeTimestamp(invoice.last_activity_at),
    }));

    const columns = [
      { key: 'payee', label: resolvedShortLabel },
      { key: 'email', label: 'Email' },
      { key: 'period', label: 'Billing Period' },
      { key: 'status', label: 'Status' },
      { key: 'shoots', label: 'Shoots' },
      { key: 'expenses', label: 'Expenses' },
      { key: 'total', label: 'Total' },
      { key: 'updated', label: 'Last Updated' },
    ] as const;

    const fileName = `${resolvedShortLabel.toLowerCase().replace(/\s+/g, '-')}-review-queue`;

    if (format === 'csv') {
      exportRowsAsCsv(fileName, columns, rows);
      return;
    }

    if (format === 'excel') {
      exportRowsAsExcel(fileName, `${resolvedShortLabel} Queue`, columns, rows);
      return;
    }

    exportRowsAsPdf(fileName, `${resolvedTitle} Export`, columns, rows);
  };

  const handleApprove = async () => {
    if (!selectedInvoice) return;

    setActionLoading(true);

    try {
      await approveWeeklyInvoice(selectedInvoice.id);
      toast({
        title: 'Invoice approved',
        description: 'The invoice was approved and linked shoots were marked as paid.',
      });
      setApproveDialogOpen(false);
      await handleRefresh();
    } catch (error) {
      toast({
        title: 'Approval failed',
        description: error instanceof Error ? error.message : 'Unable to approve this invoice.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnForChanges = async () => {
    if (!selectedInvoice || !returnReason.trim()) return;

    setActionLoading(true);

    try {
      await adminRejectWeeklyInvoice(selectedInvoice.id, returnReason.trim());
      toast({
        title: 'Invoice returned',
        description: `The ${resolvedShortLabel.toLowerCase()} has been asked to make changes before payout.`,
      });
      setReturnDialogOpen(false);
      setReturnReason('');
      await handleRefresh();
    } catch (error) {
      toast({
        title: 'Return failed',
        description: error instanceof Error ? error.message : 'Unable to return this invoice.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Tabs
      value={workspaceTab}
      onValueChange={(value) => setWorkspaceTab(value as ReviewWorkspaceTab)}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <TabsList className="grid w-full grid-cols-2 xl:max-w-[26rem]">
          <TabsTrigger value="review-queue">Review Queue</TabsTrigger>
          <TabsTrigger value="payout-report">Payout Report</TabsTrigger>
        </TabsList>

        {workspaceTab === 'review-queue' ? (
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={queueLoading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', queueLoading && 'animate-spin')} />
              Refresh Queue
            </Button>
          </div>
        ) : null}
      </div>

      <TabsContent value="review-queue" className="mt-0 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.label} className="border-border/70 bg-card/80 shadow-sm">
                <CardContent className="flex items-start justify-between gap-3 px-4 py-4">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {card.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{card.value}</div>
                  </div>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/25">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="overflow-hidden border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="gap-3 border-b border-border/70 pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">{resolvedTitle}</CardTitle>
                <CardDescription>
                  Filter {resolvedPluralLabel.toLowerCase()} weekly invoices by review state, week, or {resolvedShortLabel.toLowerCase()}.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full border-border/70 bg-background/70 px-3 py-1 text-xs font-medium">
                  {summary.invoice_count} filtered
                </Badge>
                <Badge variant="outline" className="rounded-full border-border/70 bg-background/70 px-3 py-1 text-xs font-medium">
                  {selectedStatusLabel}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-5">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(15rem,0.85fr)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${resolvedShortLabel.toLowerCase()} name or email`}
                  className="h-11 rounded-xl border-border/70 bg-background pl-9"
                />
              </div>

              <DateRangePicker
                value={{ startDate, endDate }}
                onChange={({ startDate: nextStartDate, endDate: nextEndDate }) => {
                  setStartDate(nextStartDate);
                  setEndDate(nextEndDate);
                }}
                triggerClassName="h-11 rounded-xl border-border/70 bg-background"
              />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-muted/20 p-1.5">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    aria-pressed={statusFilter === option.value}
                    className={cn(
                      'rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-all',
                      statusFilter === option.value
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                        : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="text-sm text-muted-foreground">
                Reviewing <span className="font-medium text-foreground">{resolvedPluralLabel.toLowerCase()}</span> with{' '}
                <span className="font-medium text-foreground">{selectedStatusLabel.toLowerCase()}</span> status.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)]">
          <Card className="border-border/70 bg-card/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">{selectedStatusLabel}</CardTitle>
                  <CardDescription>
                    {queueResponse?.total || 0} invoice{(queueResponse?.total || 0) === 1 ? '' : 's'} in this view
                  </CardDescription>
                </div>
                {queueLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {queue.length === 0 && !queueLoading ? (
                <EmptyQueueState statusLabel={selectedStatusLabel} payeePlural={resolvedPluralLabel.toLowerCase()} />
              ) : (
                queue.map((invoice) => {
                  const isSelected = invoice.id === selectedInvoiceId;
                  const isNeedsReview = ['pending', 'pending_approval'].includes(invoice.approval_status);
                  const payee = role === 'salesRep' ? invoice.salesRep : invoice.photographer;

                  return (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => handleSelectInvoice(invoice.id)}
                      className={cn(
                        'flex w-full flex-col gap-3 rounded-xl border px-4 py-4 text-left transition-colors',
                        isSelected
                          ? 'border-primary/35 bg-primary/5'
                          : isNeedsReview
                            ? 'border-primary/20 bg-card hover:border-primary/30'
                            : 'border-border/70 bg-card hover:border-border',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold">{payee?.name || resolvedShortLabel}</span>
                            <Badge
                              variant="outline"
                              className={cn('font-medium', getStatusBadgeClassName(invoice.approval_status))}
                            >
                              {getStatusLabel(invoice.approval_status)}
                            </Badge>
                          </div>
                          <span className="truncate text-sm text-muted-foreground">
                            {payee?.email || 'No email available'}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total</div>
                          <div className="mt-1 font-semibold">{formatCurrency(invoice.total_amount)}</div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Shoots</div>
                          <div className="mt-1 font-semibold">{invoice.shoot_count || 0}</div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Expenses</div>
                          <div className="mt-1 font-semibold">{invoice.expense_count || 0}</div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <span>{formatBillingPeriod(invoice.billing_period_start, invoice.billing_period_end)}</span>
                        <span>Updated {formatRelativeTimestamp(invoice.last_activity_at)}</span>
                      </div>
                    </button>
                  );
                })
              )}

              {queueResponse && queueResponse.last_page > 1 ? (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span>
                      Page {queueResponse.current_page} of {queueResponse.last_page}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={queueLoading || queueResponse.current_page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((current) => Math.min(queueResponse.last_page, current + 1))}
                        disabled={queueLoading || queueResponse.current_page >= queueResponse.last_page}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {isMobile ? (
            <>
              <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
                <SheetContent side="right" className="w-full sm:max-w-2xl">
                  <SheetHeader className="flex flex-col gap-2 border-b border-border/70 pb-4">
                    <SheetTitle>Invoice Review Detail</SheetTitle>
                    <SheetDescription>
                      Review {resolvedShortLabel.toLowerCase()} payout lines, notes, and approval history.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 flex flex-col gap-4 overflow-y-auto pb-6">
                    <DetailShell
                      invoice={selectedInvoice}
                      detailLoading={detailLoading}
                      onApprove={() => setApproveDialogOpen(true)}
                      onReturn={() => setReturnDialogOpen(true)}
                      role={role}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <Card className="border-border/70 bg-card/80">
                <CardContent className="flex min-h-[14rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-background">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold">Open invoice detail</p>
                    <p className="text-sm text-muted-foreground">
                      Tap any queue item to open the full review detail in a side sheet.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <DetailShell
              invoice={selectedInvoice}
              detailLoading={detailLoading}
              onApprove={() => setApproveDialogOpen(true)}
              onReturn={() => setReturnDialogOpen(true)}
              role={role}
            />
          )}
        </div>
      </TabsContent>

      <TabsContent value="payout-report" className="flex flex-col gap-4">
        <PayoutReportPanel
          role={role}
          title={`${resolvedPluralLabel} Report`}
          description={`Export payout totals and weekly summaries for ${resolvedPluralLabel.toLowerCase()}.`}
        />
      </TabsContent>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {resolvedShortLabel} Invoice</DialogTitle>
            <DialogDescription>
              This will approve the invoice and mark all linked {resolvedShortLabel.toLowerCase()} shoots as paid.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
            {selectedInvoice ? (
              <>
                <div className="font-medium text-foreground">
                  {role === 'salesRep' ? selectedInvoice.salesRep?.name : selectedInvoice.photographer?.name}
                </div>
                <div className="mt-1">{formatBillingPeriod(selectedInvoice.billing_period_start, selectedInvoice.billing_period_end)}</div>
                <div className="mt-1 font-medium text-foreground">{formatCurrency(selectedInvoice.total_amount)}</div>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Approve &amp; Mark Shoots Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Invoice for Changes</DialogTitle>
            <DialogDescription>
              Add a clear reason so the {resolvedShortLabel.toLowerCase()} knows exactly what needs to be updated before resubmitting.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-return-reason">Required reason</Label>
              <Textarea
                id="admin-return-reason"
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
                placeholder="Explain the correction needed before payout can be approved."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleReturnForChanges}
              disabled={actionLoading || !returnReason.trim()}
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Return for Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
