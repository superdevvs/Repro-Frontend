import React, { useMemo, useState } from 'react';
import { AreaChart as AreaIcon, BarChart3, LineChart as LineIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AreaChart, BarChart, LineChart } from '@/components/charts';
import type { ClientBillingItem } from '@/types/clientBilling';
import { clientBillingCurrency, getClientBillingChartData } from './clientBillingPresentation';

interface ClientBillingChartsProps {
  items: ClientBillingItem[];
  timeFilter?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  onTimeFilterChange?: (filter: 'day' | 'week' | 'month' | 'quarter' | 'year') => void;
}

export function ClientBillingCharts({ items }: ClientBillingChartsProps) {
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');
  const currentYear = new Date().getFullYear();
  const data = useMemo(() => getClientBillingChartData(items, currentYear), [items, currentYear]);
  const Chart = chartType === 'area' ? AreaChart : chartType === 'bar' ? BarChart : LineChart;
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Spending overview</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{currentYear} calendar year · monthly billing and completed payments</p>
        </div>
        <ToggleGroup type="single" value={chartType} onValueChange={(value) => value && setChartType(value as typeof chartType)} className="rounded-md border">
          <ToggleGroupItem value="area" aria-label="Area chart" className="h-8 w-8 p-0"><AreaIcon className="h-4 w-4" /></ToggleGroupItem>
          <ToggleGroupItem value="bar" aria-label="Bar chart" className="h-8 w-8 p-0"><BarChart3 className="h-4 w-4" /></ToggleGroupItem>
          <ToggleGroupItem value="line" aria-label="Line chart" className="h-8 w-8 p-0"><LineIcon className="h-4 w-4" /></ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="p-3 sm:p-4">
        <div className="h-[235px] min-w-0 w-full" role="img" aria-label={`Monthly amounts billed and paid in ${currentYear}`}>
          <Chart data={data} index="month" categories={['Amount billed', 'Amount paid']} colors={['#3b82f6', '#10b981']} valueFormatter={(value) => clientBillingCurrency.format(value)} showLegend={false} yAxisWidth={60} />
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue-500" />Amount billed</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Amount paid</span>
        </div>
      </div>
    </Card>
  );
}
