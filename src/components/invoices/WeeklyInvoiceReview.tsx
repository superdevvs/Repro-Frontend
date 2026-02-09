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
  Send,
  Plus,
  Trash2,
  AlertTriangle,
  DollarSign,
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
  pending_approval: { label: 'Submitted for Approval', color: 'bg-blue-100 text-blue-800', icon: <Send className="w-3 h-3" /> },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> },
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
  const [rejectOpen, setRejectOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
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

  const handleReject = async () => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      await rejectWeeklyInvoice(selectedInvoice.id, invoiceRole, rejectReason);
      toast({ title: 'Invoice rejected', description: 'The accounting department has been notified.' });
      setRejectOpen(false);
      setRejectReason('');
      await loadInvoices();
    } catch (error: any) {
      toast({ title: 'Failed to reject invoice', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!selectedInvoice) return;
    try {
      setActionLoading(true);
      await submitWeeklyInvoiceForApproval(selectedInvoice.id, invoiceRole, submitNotes);
      toast({ title: 'Invoice submitted for approval', description: 'Accounting will review your changes.' });
      setSubmitOpen(false);
      setSubmitNotes('');
      await loadInvoices();
    } catch (error: any) {
      toast({ title: 'Failed to submit', description: error.message, variant: 'destructive' });
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
    } catch (error: any) {
      toast({ title: 'Failed to add expense', description: error.message, variant: 'destructive' });
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
    } catch (error: any) {
      toast({ title: 'Failed to remove expense', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = (invoice: WeeklyInvoice) => {
    setSelectedInvoice(invoice);
    setDetailOpen(true);
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
            Weekly invoices are generated every Sunday at 9:00 AM for the previous week.
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
          Invoices are auto-generated every Sunday for the previous week (Sun–Sat)
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
                  <Badge className={`${statusCfg.color} flex items-center gap-1`}>
                    {statusCfg.icon}
                    {statusCfg.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{formatCurrency(invoice.total_amount)}</span>
                </div>
              </div>
              {invoice.rejection_reason && invoice.approval_status === 'rejected' && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Rejection Reason:
                  </div>
                  <p className="text-red-600 text-sm mt-1">{invoice.rejection_reason}</p>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setRejectOpen(true);
                        }}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setSubmitOpen(true);
                        }}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Submit for Approval
                      </Button>
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

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Invoice</DialogTitle>
            <DialogDescription>
              Please provide a reason why you are rejecting this invoice. The accounting department will review your feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason for Rejection</Label>
              <Textarea
                placeholder="Describe the issue with this invoice..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit for Approval Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for Approval</DialogTitle>
            <DialogDescription>
              Submit this invoice with your changes to the accounting department for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes about the changes you made..."
                value={submitNotes}
                onChange={(e) => setSubmitNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitForApproval} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit for Approval
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
