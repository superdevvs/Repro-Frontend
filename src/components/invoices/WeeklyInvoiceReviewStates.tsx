import { FileText, Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

interface WeeklyInvoiceLoadingStateProps {
  message: string;
}

export const WeeklyInvoiceLoadingState = ({ message }: WeeklyInvoiceLoadingStateProps) => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    <span className="ml-2 text-muted-foreground">{message}</span>
  </div>
);

interface WeeklyInvoiceEmptyStateProps {
  title: string;
  description: string;
}

export const WeeklyInvoiceEmptyState = ({ title, description }: WeeklyInvoiceEmptyStateProps) => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-12">
      <FileText className="w-12 h-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground text-sm mt-1">{description}</p>
    </CardContent>
  </Card>
);
