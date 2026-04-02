import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useShoots } from '@/context/ShootsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ReceiptText,
} from 'lucide-react';
import {
  WeeklyInvoice,
  WeeklyInvoiceItem,
  fetchPhotographerInvoices,
  fetchSalesRepInvoices,
  addWeeklyInvoiceExpense,
  removeWeeklyInvoiceExpense,
  rejectWeeklyInvoice,
  submitWeeklyInvoiceForApproval,
} from '@/services/invoiceService';
import {
  getMatchingShootServiceForInvoiceItem,
  getPhotographerPayForService,
  getPhotographerPayForShoot,
} from '@/components/accounting/photographerEarningsUtils';

const approvalStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
  pending_approval: { label: 'Accepted', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'Requested for Modification', color: 'bg-amber-100 text-amber-800', icon: <AlertTriangle className="w-3 h-3" /> },
};

const ITEMS_PER_PAGE = 6;

const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const WeeklyInvoiceReview: React.FC = () => {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const { shoots } = useShoots();
  const [invoices, setInvoices] = useState<WeeklyInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<WeeklyInvoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);

  const invoiceRole: 'photographer' | 'salesRep' = role === 'salesRep' ? 'salesRep' : 'photographer';

  const shootLookup = React.useMemo(() => {
    const map = new Map<string, (typeof shoots)[number]>();
    shoots.forEach((shoot) => {
      map.set(String(shoot.id), shoot);
    });
    return map;
  }, [shoots]);

  const getChargeDisplayAmount = useCallback(
    (invoice: WeeklyInvoice, item: WeeklyInvoiceItem) => {
      const rawAmount = typeof item.total_amount === 'string' ? parseFloat(item.total_amount) : item.total_amount;
      if (invoiceRole !== 'photographer') {
        return Number(rawAmount || 0);
      }

      const shoot =
        item.shoot_id != null
          ? shootLookup.get(String(item.shoot_id))
          : null;

      if (!shoot) {
        return Number(rawAmount || 0);
      }

      const matchedService = getMatchingShootServiceForInvoiceItem(shoot, item.description);
      if (matchedService) {
        return getPhotographerPayForService(shoot, matchedService);
      }

      const sameShootCharges = (invoice.items || []).filter(
        (invoiceItem) =>
          invoiceItem.type === 'charge' &&
          invoiceItem.shoot_id != null &&
          item.shoot_id != null &&
          String(invoiceItem.shoot_id) === String(item.shoot_id),
      );

      if (sameShootCharges.length === 1) {
        return getPhotographerPayForShoot(shoot, user);
      }

      return Number(rawAmount || 0);
    },
    [invoiceRole, shootLookup, user],
  );

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const fetchFn = invoiceRole === 'photographer' ? fetchPhotographerInvoices : fetchSalesRepInvoices;
      const response = await fetchFn({ page: currentPage, per_page: ITEMS_PER_PAGE });
      setInvoices(response.data || []);
      setCurrentPage(response.current_page || 1);
      setLastPage(response.last_page || 1);
      setTotalInvoices(response.total || 0);
    } catch (error) {
      console.error('Failed to load weekly invoices:', error);
      toast({ title: 'Failed to load invoices', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentPage, invoiceRole, toast]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const canModify = (invoice: WeeklyInvoice) =>
    ['pending', 'rejected'].includes(invoice.approval_status) && invoice.status === 'draft';

  const canReview = (invoice: WeeklyInvoice) =>
    ['pending', 'rejected'].includes(invoice.approval_status);

  const handleRequestModification = async () => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      await rejectWeeklyInvoice(selectedInvoice.id, invoiceRole, reviewNotes.trim() || undefined);
      toast({
        title: 'Modification requested',
        description: 'Invoice status has been updated to requested modification.',
      });
      setReviewOpen(false);
      setReviewNotes('');
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to request modification',
        description: error instanceof Error ? error.message : 'Unable to update invoice status',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptReview = async () => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      await submitWeeklyInvoiceForApproval(selectedInvoice.id, invoiceRole, reviewNotes.trim() || undefined);
      toast({
        title: 'Invoice accepted',
        description: 'Invoice status has been updated to accepted.',
      });
      setReviewOpen(false);
      setReviewNotes('');
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to accept invoice',
        description: error instanceof Error ? error.message : 'Unable to update invoice status',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async (invoice: WeeklyInvoice) => {
    try {
      setActionLoading(true);
      await submitWeeklyInvoiceForApproval(invoice.id, invoiceRole, invoice.modification_notes || undefined);
      toast({
        title: 'Invoice resubmitted',
        description: 'Invoice status has been updated to accepted.',
      });
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to resubmit invoice',
        description: error instanceof Error ? error.message : 'Unable to update invoice status',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!selectedInvoice || !expenseDesc || !expenseAmount) return;
    try {
      setActionLoading(true);
      await addWeeklyInvoiceExpense(selectedInvoice.id, invoiceRole, {
        description: expenseDesc,
        amount: parseFloat(expenseAmount),
      });
      toast({ title: 'Expense added' });
      setExpenseOpen(false);
      setExpenseDesc('');
      setExpenseAmount('');
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to add expense',
        description: error instanceof Error ? error.message : 'Unable to add expense',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveExpense = async (invoice: WeeklyInvoice, item: WeeklyInvoiceItem) => {
    try {
      setActionLoading(true);
      await removeWeeklyInvoiceExpense(invoice.id, item.id, invoiceRole);
      toast({ title: 'Expense removed' });
      await loadInvoices();
    } catch (error: unknown) {
      toast({
        title: 'Failed to remove expense',
        description: error instanceof Error ? error.message : 'Unable to remove expense',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = (invoice: WeeklyInvoice) => {
    setSelectedInvoice(invoice);
    setDetailOpen(true);
  };

  const openReviewDialog = (invoice: WeeklyInvoice) => {
    setSelectedInvoice(invoice);
    setReviewNotes(invoice.modification_notes || '');
    setReviewOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading invoices...</span>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No Invoices Yet</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Weekly invoices are generated every Monday morning for the previous completed week.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Weekly Invoices</h2>
        <p className="text-sm text-muted-foreground">
          Invoices are auto-generated every Monday for the previous completed week (Sun-Sat)
        </p>
      </div>

      {invoices.map((invoice) => {
        const statusCfg = approvalStatusConfig[invoice.approval_status] || approvalStatusConfig.pending;
        const charges = (invoice.items || []).filter((i) => i.type === 'charge');
        const expenses = (invoice.items || []).filter((i) => i.type === 'expense');
        const totalCharges = charges.reduce((sum, item) => sum + getChargeDisplayAmount(invoice, item), 0);
        const totalExpenses = expenses.reduce((s, i) => s + parseFloat(String(i.total_amount || 0)), 0);
        const invoiceDisplayTotal = totalCharges + totalExpenses;
        const isExpanded = expandedInvoiceId === invoice.id;
        const reviewActionLabel =
          invoice.approval_status === 'pending' ? 'Review Invoice' : 'Review Response';

        return (
          <Card key={invoice.id} className="overflow-hidden rounded-3xl border border-border/70 bg-card/80">
            <button
              type="button"
              onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)}
              className="w-full text-left"
            >
              <CardHeader className="gap-4 border-b border-border/60 pb-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <CardTitle className="flex items-center gap-2 text-[1.15rem]">
                        <Calendar className="h-4 w-4 text-primary" />
                        {formatDate(invoice.billing_period_start)} – {formatDate(invoice.billing_period_end)}
                      </CardTitle>
                      {canReview(invoice) ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openReviewDialog(invoice);
                          }}
                          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <Badge className={`${statusCfg.color} flex items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity`}>
                            {statusCfg.icon}
                            {statusCfg.label}
                          </Badge>
                        </button>
                      ) : (
                        <Badge className={`${statusCfg.color} flex items-center gap-1`}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Compact weekly payout summary with line items, expenses, and review actions on expand.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-start rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3">
                    <div className="text-right">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/80">Invoice Total</p>
                      <p className="mt-1 text-2xl font-semibold">{formatCurrency(invoiceDisplayTotal)}</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Shoot Pay</p>
                    <p className="mt-2 text-lg font-semibold">{formatCurrency(totalCharges)}</p>
                  </div>
                  <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-sky-500">Expenses</p>
                    <p className="mt-2 text-lg font-semibold">{formatCurrency(totalExpenses)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Shoots</p>
                    <p className="mt-2 text-lg font-semibold">{charges.length}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Expense Items</p>
                    <p className="mt-2 text-lg font-semibold">{expenses.length}</p>
                  </div>
                </div>

                {invoice.rejection_reason && invoice.approval_status === 'rejected' && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
                      <AlertTriangle className="h-4 w-4" />
                      Modification Request
                    </div>
                    <p className="mt-2 text-sm text-amber-100/90 dark:text-amber-200">
                      {invoice.rejection_reason}
                    </p>
                  </div>
                )}
              </CardHeader>
            </button>

            {isExpanded && (
              <CardContent className="space-y-5 p-5">
                <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold">Service Breakdown</h4>
                    </div>
                    <div className="mt-4 space-y-2">
                      {charges.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-2xl border border-border/50 bg-background/60 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{item.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Shoot payout item
                            </p>
                          </div>
                          <p className="text-sm font-semibold whitespace-nowrap">
                            {formatCurrency(getChargeDisplayAmount(invoice, item))}
                          </p>
                        </div>
                      ))}
                      {charges.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
                          No payout line items for this week.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-semibold">Expenses & Notes</h4>
                      </div>
                      <div className="mt-4 space-y-2">
                        {expenses.length > 0 ? (
                          expenses.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{item.description}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Expense reimbursement</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold whitespace-nowrap">
                                  +{formatCurrency(item.total_amount)}
                                </p>
                                {canModify(invoice) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                    onClick={() => handleRemoveExpense(invoice, item)}
                                    disabled={actionLoading}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
                            No expenses added for this invoice.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Summary</p>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Shoot lines</span>
                          <span className="font-medium">{charges.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Expense lines</span>
                          <span className="font-medium">{expenses.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Review state</span>
                          <span className="font-medium">{statusCfg.label}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between text-base font-semibold">
                          <span>Total</span>
                          <span>{formatCurrency(invoiceDisplayTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {charges.length} shoot{charges.length !== 1 ? 's' : ''} and {expenses.length} expense{expenses.length !== 1 ? 's' : ''} in this invoice.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canModify(invoice) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setExpenseOpen(true);
                        }}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add Expense
                      </Button>
                    )}
                    {canReview(invoice) && (
                      <Button size="sm" onClick={() => openReviewDialog(invoice)}>
                        {reviewActionLabel}
                      </Button>
                    )}
                    {invoice.approval_status === 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResubmit(invoice)}
                        disabled={actionLoading}
                      >
                        {actionLoading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                        Accept & Resubmit
                      </Button>
                    )}
                    {invoice.approval_status === 'approved' && (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Approved – Payment Processing
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {lastPage > 1 && (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            Page {currentPage} of {lastPage} · {totalInvoices} invoice{totalInvoices === 1 ? '' : 's'}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1 || loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.min(lastPage, page + 1))}
              disabled={currentPage >= lastPage || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Invoice</DialogTitle>
            <DialogDescription>
              Choose how you want to review this invoice. You can accept it or request a modification with notes. The invoice status will update immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Add an optional note for this review..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={handleRequestModification} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Request Modification
            </Button>
            <Button onClick={handleAcceptReview} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>
              Add an expense item to this invoice (e.g., mileage, equipment rental).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Description</Label>
              <Input
                placeholder="e.g., Mileage reimbursement"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
              />
            </div>
            <div>
              <Label>Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button>
            <Button onClick={handleAddExpense} disabled={actionLoading || !expenseDesc || !expenseAmount}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
