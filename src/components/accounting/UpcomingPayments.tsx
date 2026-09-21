import { EmptyState } from '@/components/ui/empty-state';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, BellIcon, AlertCircleIcon } from 'lucide-react';
import { InvoiceData } from '@/utils/invoiceUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, addDays, isAfter, parseISO, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';

interface UpcomingPaymentsProps {
  invoices: InvoiceData[];
}

export function UpcomingPayments({ invoices }: UpcomingPaymentsProps) {
  // In a real app, we would have actual date objects, but for this demo,
  // we'll parse the string dates
  const today = new Date();

  // Helper function to check if a date is within the next N days
  const isWithinNextDays = (dateStr: string, days: number) => {
    try {
      const date = parseISO(dateStr);
      const futureDate = addDays(today, days);
      return isAfter(date, today) && isBefore(date, futureDate);
    } catch (e) {
      return false;
    }
  };

  // Find upcoming payments (due within next 14 days)
  const upcomingPayments = invoices
    .filter(invoice => 
      invoice.status !== 'paid' && 
      isWithinNextDays(invoice.dueDate, 14)
    )
    .sort((a, b) => {
      try {
        return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
      } catch (e) {
        return 0;
      }
    });

  // Organize by urgency
  const urgentPayments = upcomingPayments
    .filter(invoice => isWithinNextDays(invoice.dueDate, 3));
  
  const normalPayments = upcomingPayments
    .filter(invoice => !isWithinNextDays(invoice.dueDate, 3));

  // Format date for display
  const formatDueDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      
      if (isToday) return 'Today';
      
      const tomorrow = addDays(today, 1);
      const isTomorrow = format(date, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd');
      
      if (isTomorrow) return 'Tomorrow';
      
      return format(date, 'MMM d, yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <Card className={cn("overflow-hidden border", upcomingPayments.length > 0 && urgentPayments.length > 0 && "border-amber-500/20")}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Upcoming Payments
          </CardTitle>
          {upcomingPayments.length > 0 && (
            <Badge variant="outline" className="bg-primary/10 hover:bg-primary/20">
              {upcomingPayments.length} upcoming
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {upcomingPayments.length > 0 ? (
          <div className="space-y-4">
            {urgentPayments.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertCircleIcon className="h-4 w-4 text-amber-500" />
                  <h4 className="text-sm font-medium text-amber-500">
                    Urgent Attention Required
                  </h4>
                </div>
                <div className="space-y-2">
                  {urgentPayments.map(invoice => (
                    <PaymentItem key={invoice.id} invoice={invoice} formatDueDate={formatDueDate} urgent />
                  ))}
                </div>
              </div>
            )}
            
            {normalPayments.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <BellIcon className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">
                    Coming Up
                  </h4>
                </div>
                <div className="space-y-2">
                  {normalPayments.map(invoice => (
                    <PaymentItem key={invoice.id} invoice={invoice} formatDueDate={formatDueDate} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-center">

            <EmptyState icon="payments" title={<>No upcoming payments</>} size="compact" />
            <p className="text-sm text-muted-foreground mt-1">
              All invoices are paid or due dates are far in the future.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PaymentItemProps {
  invoice: InvoiceData;
  formatDueDate: (dateStr: string) => string;
  urgent?: boolean;
}

function PaymentItem({ invoice, formatDueDate, urgent = false }: PaymentItemProps) {
  return (
    <div className={cn(
      "p-3 rounded-md border flex items-center justify-between",
      urgent 
        ? "bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20"
        : "bg-muted/30 border-border"
    )}>
      <div>
        <p className="text-sm font-medium">{invoice.client}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">
            Invoice #{invoice.id}
          </p>
          <span className="h-1 w-1 rounded-full bg-muted-foreground"></span>
          <p className={cn(
            "text-xs font-medium",
            urgent ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
          )}>
            Due {formatDueDate(invoice.dueDate)}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <p className="text-sm font-bold">${invoice.amount.toLocaleString()}</p>
        <Button size="sm" variant={urgent ? "default" : "outline"} className="h-8">
          Pay Now
        </Button>
      </div>
    </div>
  );
}
