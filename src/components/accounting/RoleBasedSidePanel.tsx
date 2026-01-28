import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { InvoiceData } from '@/utils/invoiceUtils';
import { ArrowUpRight, CreditCard, Clock, TrendingUp, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountingMode } from '@/config/accountingConfig';
import { useAuth } from '@/components/auth/AuthProvider';

interface RoleBasedSidePanelProps {
  invoices: InvoiceData[];
  mode: AccountingMode;
  shoots?: any[];
  editingJobs?: any[];
}

export function RoleBasedSidePanel({ 
  invoices, 
  mode,
  shoots = [],
  editingJobs = [],
}: RoleBasedSidePanelProps) {
  const { user } = useAuth();

  // For admin mode, use the original PaymentsSummary
  if (mode === 'admin') {
    return <AdminPaymentsSummary invoices={invoices} />;
  }

  // For client mode, show payment methods and recent payments
  if (mode === 'client') {
    return <ClientSidePanel invoices={invoices} user={user} />;
  }

  // For photographer mode, show payout status and upcoming shoots
  if (mode === 'photographer') {
    return <PhotographerSidePanel shoots={shoots} user={user} />;
  }

  // For editor mode, show jobs in progress and turnaround performance
  if (mode === 'editor') {
    return <EditorSidePanel editingJobs={editingJobs} user={user} />;
  }

  // For rep mode, show top clients and pipeline snapshot
  if (mode === 'rep') {
    return <RepSidePanel invoices={invoices} user={user} />;
  }

  return null;
}

// Admin Payments Summary (original component)
function AdminPaymentsSummary({ invoices }: { invoices: InvoiceData[] }) {
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const paymentPercentage = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);

  const paymentMethods = invoices
    .filter(i => i.status === 'paid' && i.paymentMethod)
    .reduce((acc, i) => {
      const method = i.paymentMethod || 'Unknown';
      acc[method] = (acc[method] || 0) + i.amount;
      return acc;
    }, {} as Record<string, number>);

  const paymentMethodsArray = Object.entries(paymentMethods)
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  const getTrendColor = (percentage: number) => {
    if (percentage >= 70) return 'text-emerald-500';
    if (percentage >= 40) return 'text-amber-500';
    return 'text-rose-500';
  };

  const latestTransactions = invoices
    .filter(i => i.status === 'paid')
    .slice(0, 15);

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card className="overflow-hidden border flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payments Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-sm font-medium">Payment Rate</p>
                  <p className="text-xs text-muted-foreground">
                    {paymentPercentage}% of invoices paid
                  </p>
                </div>
                <div className={cn("flex items-center gap-1 text-sm font-medium", getTrendColor(paymentPercentage))}>
                  {paymentPercentage}%
                  <ArrowUpRight className="h-3 w-3" />
                </div>
              </div>
              <Progress value={paymentPercentage} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Paid</h4>
                <p className="text-xl font-semibold">${totalPaid.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20">
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Overdue</h4>
                <p className="text-xl font-semibold">${totalOverdue.toLocaleString()}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">Payment Methods</h4>
              <div className="space-y-3">
                {paymentMethodsArray.length > 0 ? (
                  paymentMethodsArray.map(({ method, amount }) => (
                    <div key={method} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary"></div>
                        <p className="text-sm">{method}</p>
                      </div>
                      <p className="text-sm font-medium">${amount.toLocaleString()}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No payment data available</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border overflow-hidden flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Latest Transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          {latestTransactions.length > 0 ? (
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {latestTransactions.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex justify-between items-center p-2 rounded-md bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{invoice.client}</p>
                    <p className="text-xs text-muted-foreground">{invoice.date}</p>
                  </div>
                  <p className="text-sm font-medium">${invoice.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent payments</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Client Side Panel
function ClientSidePanel({ invoices, user }: { invoices: InvoiceData[]; user: any }) {
  const myInvoices = invoices.filter((i) => i.client === user?.name || i.client_id === user?.id);
  const paidInvoices = myInvoices.filter(i => i.status === 'paid');
  
  const paymentMethods = paidInvoices
    .filter(i => i.paymentMethod)
    .reduce((acc, i) => {
      const method = i.paymentMethod || 'Unknown';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const paymentMethodsArray = Object.entries(paymentMethods)
    .map(([method, count]) => ({ method, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const recentPayments = paidInvoices
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card className="overflow-hidden border flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {paymentMethodsArray.length > 0 ? (
              paymentMethodsArray.map(({ method, count }) => (
                <div key={method} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary"></div>
                    <p className="text-sm">{method}</p>
                  </div>
                  <p className="text-sm font-medium">{count} payment{count !== 1 ? 's' : ''}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No payment methods on file</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border overflow-hidden flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          {recentPayments.length > 0 ? (
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {recentPayments.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex justify-between items-center p-2 rounded-md bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{invoice.property || invoice.client}</p>
                    <p className="text-xs text-muted-foreground">{invoice.date}</p>
                  </div>
                  <p className="text-sm font-medium">${invoice.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent payments</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Photographer Side Panel
function PhotographerSidePanel({ shoots, user }: { shoots: any[]; user: any }) {
  const myShoots = shoots.filter((s: any) => s.photographer_id === user?.id || s.photographerId === user?.id);
  
  const paidThisMonth = myShoots.filter((s: any) => {
    const status = s.payout_status || s.payoutStatus || s.payment_status || s.paymentStatus;
    return status === 'paid';
  }).length;

  const pending = myShoots.filter((s: any) => {
    const status = s.payout_status || s.payoutStatus || s.payment_status || s.paymentStatus;
    return status === 'pending' || status === 'unpaid';
  }).length;

  const inReview = 0; // Review status removed

  const upcomingShoots = myShoots
    .filter((s: any) => {
      const scheduled = s.scheduled_date || s.scheduledDate;
      if (!scheduled) return false;
      const d = new Date(scheduled);
      return d >= new Date() && (!s.completed_at && !s.completedAt);
    })
    .sort((a: any, b: any) => {
      const dateA = new Date(a.scheduled_date || a.scheduledDate || 0);
      const dateB = new Date(b.scheduled_date || b.scheduledDate || 0);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card className="overflow-hidden border flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Payout Status Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Paid this month</h4>
              <p className="text-xl font-semibold">{paidThisMonth}</p>
            </div>
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Pending</h4>
              <p className="text-xl font-semibold">{pending}</p>
            </div>
            <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
              <h4 className="text-xs font-medium text-muted-foreground mb-1">In Review</h4>
              <p className="text-xl font-semibold">{inReview}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border overflow-hidden flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Upcoming Shoots Requiring Delivery</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          {upcomingShoots.length > 0 ? (
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {upcomingShoots.map((shoot: any) => (
                <div
                  key={shoot.id}
                  className="flex justify-between items-center p-2 rounded-md bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{shoot.address || shoot.property || 'Shoot'}</p>
                    <p className="text-xs text-muted-foreground">
                      {shoot.scheduled_date || shoot.scheduledDate || 'TBD'}
                    </p>
                  </div>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming shoots</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Editor Side Panel
function EditorSidePanel({ editingJobs, user }: { editingJobs: any[]; user: any }) {
  // Jobs in progress and turnaround time have been removed per user request
  return null;
}

// Rep Side Panel
function RepSidePanel({ invoices, user }: { invoices: InvoiceData[]; user: any }) {
  // Filter invoices for clients assigned to this rep
  const myClientInvoices = invoices; // Placeholder - would filter by rep_id
  
  const clientRevenue = myClientInvoices
    .filter(i => i.status === 'paid')
    .reduce((acc, i) => {
      const client = i.client;
      acc[client] = (acc[client] || 0) + i.amount;
      return acc;
    }, {} as Record<string, number>);

  const topClients = Object.entries(clientRevenue)
    .map(([client, revenue]) => ({ client, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card className="overflow-hidden border flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Top Clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topClients.length > 0 ? (
              topClients.map(({ client, revenue }, index) => (
                <div key={client} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <p className="text-sm">{client}</p>
                  </div>
                  <p className="text-sm font-medium">${revenue.toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No client data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border overflow-hidden flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Pipeline Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
              <h4 className="text-xs font-medium text-muted-foreground mb-1">New Leads</h4>
              <p className="text-2xl font-semibold">0</p>
            </div>
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Opportunities</h4>
              <p className="text-2xl font-semibold">0</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
