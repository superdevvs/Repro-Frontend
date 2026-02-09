import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  Calendar,
  Loader2,
  User,
  FileText,
} from 'lucide-react';
import {
  WeeklyInvoice,
  fetchPendingApprovalInvoices,
  approveWeeklyInvoice,
  adminRejectWeeklyInvoice,
} from '@/services/invoiceService';

const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const PendingInvoiceApprovals: React.FC = () => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<WeeklyInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<WeeklyInvoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadPending = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchPendingApprovalInvoices({ per_page: 50 });
      setInvoices(response.data || []);
    } catch (error: any) {
      console.error('Failed to load pending invoices:', error);
      toast({ title: 'Failed to load pending invoices', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleApprove = async (invoice: WeeklyInvoice) => {
    try {
      setActionLoading(true);
      await approveWeeklyInvoice(invoice.id);
      toast({ title: 'Invoice approved', description: 'The photographer/rep has been notified and shoots marked as paid.' });
      await loadPending();
    } catch (error: any) {
      toast({ title: 'Failed to approve', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedInvoice || !rejectReason) return;
    try {
      setActionLoading(true);
      await adminRejectWeeklyInvoice(selectedInvoice.id, rejectReason);
      toast({ title: 'Invoice rejected', description: 'The photographer/rep has been notified.' });
      setRejectOpen(false);
      setRejectReason('');
      await loadPending();
    } catch (error: any) {
      toast({ title: 'Failed to reject', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground text-sm">Loading pending approvals...</span>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <CheckCircle className="w-10 h-10 text-green-400 mb-3" />
          <h3 className="text-base font-semibold">All Caught Up</h3>
          <p className="text-muted-foreground text-sm mt-1">No invoices pending approval.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Pending Invoice Approvals
          <Badge variant="secondary">{invoices.length}</Badge>
        </h2>
      </div>

      {invoices.map((invoice) => {
        const personName = invoice.photographer?.name || invoice.salesRep?.name || 'Unknown';
        const personRole = invoice.photographer_id ? 'Photographer' : 'Sales Rep';
        const charges = (invoice.items || []).filter((i) => i.type === 'charge');
        const expenses = (invoice.items || []).filter((i) => i.type === 'expense');

        return (
          <Card key={invoice.id} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {personName}
                    <Badge variant="outline" className="text-xs">{personRole}</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(invoice.billing_period_start)} – {formatDate(invoice.billing_period_end)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(invoice.total_amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {charges.length} shoot{charges.length !== 1 ? 's' : ''}, {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {invoice.modification_notes && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                    <FileText className="w-4 h-4" />
                    Notes from {personRole}:
                  </div>
                  <p className="text-blue-600 text-sm mt-1">{invoice.modification_notes}</p>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Badge variant="outline" className="text-xs">Shoot</Badge></TableCell>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                  {expenses.map((item) => (
                    <TableRow key={item.id} className="bg-blue-50/50">
                      <TableCell><Badge className="bg-blue-100 text-blue-700 text-xs">Expense</Badge></TableCell>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-right text-blue-600 font-medium">+{formatCurrency(item.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-3" />

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    setSelectedInvoice(invoice);
                    setRejectOpen(true);
                  }}
                  disabled={actionLoading}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(invoice)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3 h-3 mr-1" />
                  )}
                  Approve & Mark Paid
                </Button>
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
              Provide a reason for rejection. The photographer/sales rep will be notified and can make corrections.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="Explain what needs to be corrected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading || !rejectReason}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
