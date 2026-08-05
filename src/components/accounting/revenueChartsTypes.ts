import type { InvoiceData } from '@/utils/invoiceUtils';

export type RevenueTimeFilter = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface RevenueChartsProps {
  invoices: InvoiceData[];
  timeFilter: RevenueTimeFilter;
  onTimeFilterChange: (filter: RevenueTimeFilter) => void;
  variant?: 'full' | 'compact';
  theme?: 'auto' | 'light' | 'dark';
  role?: string;
}
