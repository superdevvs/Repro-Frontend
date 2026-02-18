import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, BarChart, LineChart } from '@/components/charts';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InvoiceData } from '@/utils/invoiceUtils';
import { AccountingMode } from '@/config/accountingConfig';
import { ShootData } from '@/types/shoots';
import { EditorJob } from './EditorJobsTable';
import { useAuth } from '@/components/auth/AuthProvider';
import { BarChart3, PieChart, LineChart as LineChartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleBasedChartsProps {
  invoices: InvoiceData[];
  mode: AccountingMode;
  timeFilter: 'day' | 'week' | 'month' | 'quarter' | 'year';
  onTimeFilterChange: (filter: 'day' | 'week' | 'month' | 'quarter' | 'year') => void;
  shoots?: ShootData[];
  editingJobs?: EditorJob[];
}

export function RoleBasedCharts({
  invoices,
  mode,
  timeFilter,
  onTimeFilterChange,
  shoots = [],
  editingJobs = [],
}: RoleBasedChartsProps) {
  const { user } = useAuth();
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');

  const isInvoiceForCurrentClient = (inv: InvoiceData) => {
    if (!user) return false;
    const invoiceClientId = (inv.client_id ?? (inv as any).clientId) as unknown;
    if (invoiceClientId != null && user.id != null) {
      return String(invoiceClientId) === String(user.id);
    }
    const invoiceClientName = (inv.client || '').trim().toLowerCase();
    const userName = String(user.name || '').trim().toLowerCase();
    return Boolean(invoiceClientName && userName && invoiceClientName === userName);
  };

  const getInvoiceDate = (inv: any): Date | null => {
    const maybe = inv.date ?? inv.issueDate ?? inv.issue_date ?? inv.createdAt ?? inv.created_at ?? inv.dueDate ?? inv.due_date;
    if (!maybe) return null;
    const d = new Date(maybe);
    return isNaN(d.getTime()) ? null : d;
  };

  const getInvoicePaidDate = (inv: any): Date | null => {
    const maybe = inv.paidAt ?? inv.paid_at ?? inv.updated_at ?? inv.updatedAt;
    if (!maybe) return null;
    const d = new Date(maybe);
    return isNaN(d.getTime()) ? null : d;
  };

  // Generate chart data based on mode
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    switch (mode) {
      case 'admin': {
        // Revenue Overview: revenue, expenses, profit
        return months.map((m) => {
          const revenue = Math.floor(Math.random() * 10000) + 1000;
          const expenses = Math.floor(Math.random() * revenue * 0.7);
          return { month: m, revenue, expenses, profit: revenue - expenses };
        });
      }

      case 'photographer': {
        // Earnings Overview: earnings, shootCount
        const myShoots = shoots.filter((s: any) => s.photographer_id === user?.id || s.photographerId === user?.id);
        return months.map((m, index) => {
          const monthShoots = myShoots.filter((s: any) => {
            const date = s.scheduledDate || s.scheduled_date || s.completedDate || s.completed_at;
            if (!date) return false;
            const d = new Date(date);
            return d.getMonth() === index;
          });
          const earnings = monthShoots.reduce((sum: number, s: any) => {
            // Use photographer pay from services (automatically calculated)
            // Fallback to 40% of total quote if not set
            const photographerPay = s.photographerPay || s.totalPhotographerPay || s.photographer_fee || s.photographerFee;
            if (photographerPay) {
              return sum + Number(photographerPay);
            }
            return sum + (Number(s.payment?.totalQuote * 0.4 || 0));
          }, 0);
          return { 
            month: m, 
            earnings: Math.round(earnings) || Math.floor(Math.random() * 5000) + 500,
            shootCount: monthShoots.length || Math.floor(Math.random() * 10) + 1
          };
        });
      }

      case 'editor': {
        // Editing Earnings Overview: earnings, jobCount
        const myJobs = editingJobs.filter((j: any) => j.editor_id === user?.id || j.editorId === user?.id);
        return months.map((m, index) => {
          const monthJobs = myJobs.filter((j: any) => {
            const date = j.assignedDate || j.assigned_date;
            if (!date) return false;
            const d = new Date(date);
            return d.getMonth() === index;
          });
          const earnings = monthJobs.reduce((sum: number, j: any) => {
            return sum + (Number(j.pay || j.payAmount || 0));
          }, 0);
          return { 
            month: m, 
            earnings: Math.round(earnings) || Math.floor(Math.random() * 3000) + 300,
            jobCount: monthJobs.length || Math.floor(Math.random() * 15) + 2
          };
        });
      }

      case 'client': {
        // Spending Overview: amountBilled, amountPaid
        const myInvoices = invoices.filter(isInvoiceForCurrentClient);
        return months.map((m, index) => {
          const monthInvoices = myInvoices.filter((i) => {
            const d = getInvoiceDate(i);
            if (!d) return false;
            return d.getMonth() === index;
          });
          const amountBilled = monthInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);
          const amountPaid = monthInvoices
            .filter(i => i.status === 'paid')
            .reduce((sum, i) => sum + Number(i.amountPaid ?? i.amount ?? 0), 0);
          return { 
            month: m, 
            amountBilled,
            amountPaid,
          };
        });
      }

      case 'rep': {
        // Sales Overview: revenue, commission
        const myClientInvoices = invoices; // Would filter by rep_id in production
        return months.map((m, index) => {
          const monthInvoices = myClientInvoices.filter((i) => {
            const date = i.date || i.dueDate;
            if (!date) return false;
            const d = new Date(date);
            return d.getMonth() === index;
          });
          const revenue = monthInvoices
            .filter(i => i.status === 'paid')
            .reduce((sum, i) => sum + Number(i.amount || 0), 0);
          const commission = revenue * 0.1; // 10% placeholder
          return { 
            month: m, 
            revenue: revenue || Math.floor(Math.random() * 8000) + 800,
            commission: Math.round(commission) || Math.floor(Math.random() * 800) + 80
          };
        });
      }

      default:
        return months.map((m) => ({ month: m, value: 0 }));
    }
  }, [mode, invoices, shoots, editingJobs, user]);

  const chartConfig = useMemo(() => {
    switch (mode) {
      case 'admin':
        return {
          title: 'Revenue Overview',
          description: 'Track revenue, expenses, and profit over time',
          dataKey: 'month',
          series: [
            { dataKey: 'revenue', name: 'Revenue', color: '#3b82f6' },
            { dataKey: 'expenses', name: 'Expenses', color: '#ef4444' },
            { dataKey: 'profit', name: 'Profit', color: '#10b981' },
          ],
        };
      case 'photographer':
        return {
          title: 'Earnings Overview',
          description: 'Track your earnings and shoot count over time',
          dataKey: 'month',
          series: [
            { dataKey: 'earnings', name: 'Earnings', color: '#3b82f6' },
            { dataKey: 'shootCount', name: 'Shoot Count', color: '#8b5cf6', type: 'bar' as const },
          ],
        };
      case 'editor':
        return {
          title: 'Editing Earnings Overview',
          description: 'Track your editing earnings and job count over time',
          dataKey: 'month',
          series: [
            { dataKey: 'earnings', name: 'Earnings', color: '#3b82f6' },
            { dataKey: 'jobCount', name: 'Job Count', color: '#8b5cf6', type: 'bar' as const },
          ],
        };
      case 'client':
        return {
          title: 'Spending Overview',
          description: 'Track your billed amounts and payments over time',
          dataKey: 'month',
          series: [
            { dataKey: 'amountBilled', name: 'Amount Billed', color: '#f59e0b' },
            { dataKey: 'amountPaid', name: 'Amount Paid', color: '#10b981' },
          ],
        };
      case 'rep':
        return {
          title: 'Sales Overview',
          description: 'Track revenue from your clients and commission earned',
          dataKey: 'month',
          series: [
            { dataKey: 'revenue', name: 'Revenue', color: '#3b82f6' },
            { dataKey: 'commission', name: 'Commission', color: '#10b981' },
          ],
        };
      default:
        return {
          title: 'Overview',
          description: '',
          dataKey: 'month',
          series: [],
        };
    }
  }, [mode]);

  const renderChart = () => {
    const { series, dataKey } = chartConfig;
    
    if (chartType === 'area') {
      return (
        <AreaChart
          data={chartData}
          index={dataKey}
          categories={series.map(s => s.dataKey)}
          colors={series.map(s => s.color)}
          valueFormatter={(value) => `$${value.toLocaleString()}`}
        />
      );
    }
    
    if (chartType === 'bar') {
      return (
        <BarChart
          data={chartData}
          index={dataKey}
          categories={series.map(s => s.dataKey)}
          colors={series.map(s => s.color)}
          valueFormatter={(value) => `$${value.toLocaleString()}`}
        />
      );
    }
    
    return (
      <LineChart
        data={chartData}
        index={dataKey}
        categories={series.map(s => s.dataKey)}
        colors={series.map(s => s.color)}
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
              {chartConfig.title}
            </CardTitle>
            <CardDescription className="mt-1">
              {chartConfig.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={chartType}
              onValueChange={(value) => value && setChartType(value as 'area' | 'bar' | 'line')}
              className="border rounded-md"
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          {renderChart()}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 justify-center">
          {chartConfig.series.map((s) => (
            <div key={s.dataKey} className="flex items-center gap-2">
              <div className={cn("h-3 w-3 rounded-full")} style={{ backgroundColor: s.color }} />
              <span className="text-sm text-muted-foreground">{s.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


