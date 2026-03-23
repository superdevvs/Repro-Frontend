import React, { useMemo, useState } from 'react';
import { BarChart3, LineChart as LineChartIcon, PieChart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AreaChart, BarChart, LineChart } from '@/components/charts';
import { cn } from '@/lib/utils';
import type { ClientBillingItem } from '@/types/clientBilling';

interface ClientBillingChartsProps {
  items: ClientBillingItem[];
  timeFilter: 'day' | 'week' | 'month' | 'quarter' | 'year';
  onTimeFilterChange: (filter: 'day' | 'week' | 'month' | 'quarter' | 'year') => void;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getItemDate = (item: ClientBillingItem) => item.paidAt || item.issueDate || item.dueDate;

export function ClientBillingCharts({
  items,
  timeFilter: _timeFilter,
  onTimeFilterChange: _onTimeFilterChange,
}: ClientBillingChartsProps) {
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');

  const chartData = useMemo(() => {
    return months.map((month, index) => {
      const monthItems = items.filter((item) => {
        const date = getItemDate(item);
        if (!date) return false;
        return new Date(date).getMonth() === index;
      });

      const amountBilled = monthItems.reduce((sum, item) => sum + item.amount, 0);
      const amountPaid = monthItems
        .filter((item) => item.bucket === 'paid')
        .reduce((sum, item) => sum + (item.amountPaid > 0 ? item.amountPaid : item.amount), 0);

      return {
        month,
        amountBilled,
        amountPaid,
      };
    });
  }, [items]);

  const series = [
    { dataKey: 'amountBilled', name: 'Amount Billed', color: '#f59e0b' },
    { dataKey: 'amountPaid', name: 'Amount Paid', color: '#10b981' },
  ];

  const renderChart = () => {
    if (chartType === 'area') {
      return (
        <AreaChart
          data={chartData}
          index="month"
          categories={series.map((item) => item.dataKey)}
          colors={series.map((item) => item.color)}
          valueFormatter={(value) => `$${value.toLocaleString()}`}
        />
      );
    }

    if (chartType === 'bar') {
      return (
        <BarChart
          data={chartData}
          index="month"
          categories={series.map((item) => item.dataKey)}
          colors={series.map((item) => item.color)}
          valueFormatter={(value) => `$${value.toLocaleString()}`}
        />
      );
    }

    return (
      <LineChart
        data={chartData}
        index="month"
        categories={series.map((item) => item.dataKey)}
        colors={series.map((item) => item.color)}
        valueFormatter={(value) => `$${value.toLocaleString()}`}
      />
    );
  };

  return (
    <Card className="border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Spending Overview
            </CardTitle>
            <CardDescription className="mt-1">
              Track billed amounts and completed payments from the shared client billing feed.
            </CardDescription>
          </div>
          <ToggleGroup
            type="single"
            value={chartType}
            onValueChange={(value) => value && setChartType(value as 'area' | 'bar' | 'line')}
            className="rounded-md border"
          >
            <ToggleGroupItem value="area" aria-label="Area chart" className="px-3 py-1">
              <BarChart3 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="bar" aria-label="Bar chart" className="px-3 py-1">
              <PieChart className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="line" aria-label="Line chart" className="px-3 py-1">
              <LineChartIcon className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">{renderChart()}</div>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {series.map((item) => (
            <div key={item.dataKey} className="flex items-center gap-2">
              <div className={cn('h-3 w-3 rounded-full')} style={{ backgroundColor: item.color }} />
              <span className="text-sm text-muted-foreground">{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
