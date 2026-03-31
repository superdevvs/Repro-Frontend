import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
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

const approvalStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
  pending_approval: { label: 'Accepted', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'Requested Modification', color: 'bg-amber-100 text-amber-800', icon: <AlertTriangle className="w-3 h-3" /> },
};

const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const WeeklyInvoiceReview: React.FC = () => {
  const { role } = useAuth();
  const { toast } = useToast();
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

  const invoiceRole: 'photographer' | 'salesRep' = role === 'salesRep' ? 'salesRep' : 'photographer';

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const fetchFn = invoiceRole === 'photographer' ? fetchPhotographerInvoices : fetchSalesRepInvoices;
      const response = await fetchFn({ per_page: 50 });
      setInvoices(response.data || []);
    } catch (error) {
      console.error('Failed to load weekly invoices:', error);
      toast({ title: 'Failed to load invoices', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [invoiceRole, toast]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const canModify = (invoice: WeeklyInvoice) =>
    ['pending', 'rejected'].includes(invoice.approval_status) && invoice.status === 'draft';

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
        const totalCharges = charges.reduce((s, i) => s + parseFloat(String(i.total_amount || 0)), 0);
        const totalExpenses = expenses.reduce((s, i) => s + parseFloat(String(i.total_amount || 0)), 0);

        return (
          <Card key={invoice.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(invoice.billing_period_start)} – {formatDate(invoice.billing_period_end)}
                  </CardTitle>
                  {invoice.approval_status === 'pending' && canModify(invoice) ? (
                    <button
                      type="button"
                      onClick={() => openReviewDialog(invoice)}
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
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{formatCurrency(invoice.total_amount)}</span>
                </div>
              </div>
              {invoice.rejection_reason && invoice.approval_status === 'rejected' && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Modification Request:
                  </div>
                  <p className="text-amber-700 text-sm mt-1">{invoice.rejection_reason}</p>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total_amount)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                  {expenses.map((item) => (
                    <TableRow key={item.id} className="bg-blue-50/50">
                      <TableCell className="text-sm">
                        <span className="text-blue-600 font-medium">Expense:</span> {item.description}
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        +{formatCurrency(item.total_amount)}
                      </TableCell>
                      <TableCell>
                        {canModify(invoice) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            onClick={() => handleRemoveExpense(invoice, item)}
                            disabled={actionLoading}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-3" />

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {charges.length} shoot{charges.length !== 1 ? 's' : ''} • {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-2">
                  {canModify(invoice) && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setExpenseOpen(true);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Expense
                      </Button>
                      {invoice.approval_status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => openReviewDialog(invoice)}
                        >
                          Review Invoice
                        </Button>
                      )}
                      {invoice.approval_status === 'rejected' && (
                        <Button
                          size="sm"
                          onClick={() => handleResubmit(invoice)}
                          disabled={actionLoading}
                        >
                          {actionLoading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          Accept & Resubmit
                        </Button>
                      )}
                    </>
                  )}
                  {invoice.approval_status === 'approved' && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Approved – Payment Processing
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Invoice</DialogTitle>
            <DialogDescription>
              Choose how you want to review this invoice. You can accept it or request a modification with notes.
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
