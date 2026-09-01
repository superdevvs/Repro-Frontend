import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAuth } from '@/components/auth/AuthProvider';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildPeriodRows,
  buildPhotographerRows,
  buildReportCsv,
  buildServiceRows,
  fetchReportInvoices,
  fetchReportShoots,
  getReportRange,
  type ReportServiceRow,
  type ReportTimeframe,
  type ReportType,
} from '@/features/reports/reporting';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number): string => currencyFormatter.format(value);

const getTimeframeDescription = (timeframe: ReportTimeframe, rangeLabel: string): string => {
  if (timeframe === 'monthly') return `Monthly breakdown for ${rangeLabel}`;
  if (timeframe === 'quarterly') return `Quarterly breakdown for ${rangeLabel}`;
  return `Annual breakdown for ${rangeLabel}`;
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const collapseServiceRows = (rows: ReportServiceRow[]): ReportServiceRow[] => {
  if (rows.length <= 8) return rows;

  const visible = rows.slice(0, 7);
  const remainder = rows.slice(7).reduce(
    (total, row) => ({
      name: 'Other',
      shoots: total.shoots + row.shoots,
      revenue: total.revenue + row.revenue,
    }),
    { name: 'Other', shoots: 0, revenue: 0 },
  );

  return [...visible, remainder];
};

const downloadCsv = (csv: string, filename: string) => {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

interface ReportStateProps {
  state: 'loading' | 'error' | 'empty';
  title?: string;
  description?: string;
  onRetry?: () => void;
}

function ReportState({ state, title, description, onRetry }: ReportStateProps) {
  if (state === 'loading') {
    return (
      <div className="flex h-full items-end gap-3 px-2 pb-3" aria-label="Loading report data">
        {[44, 68, 52, 84, 62, 74, 48, 70].map((height, index) => (
          <Skeleton key={`${height}-${index}`} className="flex-1 rounded-t-md" style={{ height: `${height}%` }} />
        ))}
      </div>
    );
  }

  const isError = state === 'error';
  const Icon = isError ? AlertCircle : BarChart3;
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className={`mb-3 rounded-full p-3 ${isError ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {isError && onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

export default function Reports() {
  const [timeframe, setTimeframe] = useState<ReportTimeframe>('monthly');
  const [reportType, setReportType] = useState<ReportType>('summary');
  const { role } = useAuth();
  const { can } = usePermission();
  const { toast } = useToast();
  const canViewReports = can('reports', 'view');
  const isSuperAdmin = role === 'superadmin';
  const canLoadReports = canViewReports && isSuperAdmin;
  const range = useMemo(() => getReportRange(timeframe), [timeframe]);

  const invoiceQuery = useQuery({
    queryKey: ['reports', 'invoices', range.start, range.end],
    queryFn: ({ signal }) => fetchReportInvoices(range, signal),
    enabled: canLoadReports,
    staleTime: 60_000,
    retry: 1,
  });
  const shootQuery = useQuery({
    queryKey: ['reports', 'shoots', range.start, range.end],
    queryFn: ({ signal }) => fetchReportShoots(range, signal),
    enabled: canLoadReports,
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (role && !canLoadReports) {
      toast({
        title: 'Access denied',
        description: 'Only Super Admin can access Reports.',
        variant: 'destructive',
      });
    }
  }, [canLoadReports, role, toast]);

  const invoices = useMemo(() => invoiceQuery.data ?? [], [invoiceQuery.data]);
  const shoots = useMemo(() => shootQuery.data ?? [], [shootQuery.data]);
  const periodRows = useMemo(
    () => buildPeriodRows(invoices, shoots, timeframe),
    [invoices, shoots, timeframe],
  );
  const photographerRows = useMemo(() => buildPhotographerRows(shoots), [shoots]);
  const serviceRows = useMemo(() => buildServiceRows(shoots), [shoots]);
  const photographerChartRows = useMemo(() => photographerRows.slice(0, 10), [photographerRows]);
  const serviceChartRows = useMemo(() => collapseServiceRows(serviceRows), [serviceRows]);
  const hasRevenue = periodRows.some((row) => row.revenue > 0);
  const hasShoots = periodRows.some((row) => row.shoots > 0);
  const timeframeDescription = getTimeframeDescription(timeframe, range.label);

  const selectedIsLoading = reportType === 'summary'
    ? invoiceQuery.isPending || shootQuery.isPending
    : shootQuery.isPending;
  const selectedHasError = reportType === 'summary'
    ? invoiceQuery.isError || shootQuery.isError
    : shootQuery.isError;
  const selectedHasData = reportType === 'summary'
    ? hasRevenue || hasShoots
    : reportType === 'photographer'
      ? photographerRows.length > 0
      : serviceRows.length > 0;

  const handleExport = () => {
    if (!selectedHasData || selectedHasError) {
      toast({
        title: 'Nothing to export',
        description: 'Load a report with live data before exporting it.',
        variant: 'destructive',
      });
      return;
    }

    const csv = buildReportCsv(reportType, periodRows, photographerRows, serviceRows);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `report-${reportType}-${timeframe}-${stamp}.csv`);
    toast({
      title: 'Report exported',
      description: `The ${reportType} report for ${range.label} was downloaded as CSV.`,
    });
  };

  if (!canLoadReports) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <PageHeader
          badge="Reports"
          title="Reports"
          description={`Live business analytics for ${range.label}`}
          action={(
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary</SelectItem>
                  <SelectItem value="photographer">By Photographer</SelectItem>
                  <SelectItem value="service">By Service</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeframe} onValueChange={(value) => setTimeframe(value as ReportTimeframe)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleExport}
                disabled={selectedIsLoading || selectedHasError || !selectedHasData}
                aria-label="Export selected report as CSV"
              >
                {selectedIsLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export Report
              </Button>
            </div>
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            Live data
          </Badge>
          <span className="text-sm text-muted-foreground">Selected period: {range.label}</span>
        </div>

        {reportType === 'summary' && (
          <Tabs defaultValue="revenue" className="w-full">
            <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="shoots">Shoots</TabsTrigger>
            </TabsList>

            <TabsContent value="revenue">
              <Card>
                <CardHeader>
                  <CardTitle>Collected Revenue</CardTitle>
                  <CardDescription>{timeframeDescription}, with collected client payments grouped by invoice issue date</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {invoiceQuery.isPending ? (
                    <ReportState state="loading" />
                  ) : invoiceQuery.isError ? (
                    <ReportState
                      state="error"
                      title="Revenue data could not be loaded"
                      description={getErrorMessage(invoiceQuery.error, 'Please try again.')}
                      onRetry={() => void invoiceQuery.refetch()}
                    />
                  ) : !hasRevenue ? (
                    <ReportState
                      state="empty"
                      title="No collected revenue in this period"
                      description="Paid client invoices will appear here as soon as they are recorded."
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={periodRows} margin={{ top: 12, right: 12, left: 8, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="period" tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={(value) => formatCurrency(Number(value))} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Collected revenue']} />
                        <Legend />
                        <Bar dataKey="revenue" fill="#10b981" name="Collected revenue" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shoots">
              <Card>
                <CardHeader>
                  <CardTitle>Shoots Overview</CardTitle>
                  <CardDescription>{timeframeDescription}, based on scheduled shoot dates</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {shootQuery.isPending ? (
                    <ReportState state="loading" />
                  ) : shootQuery.isError ? (
                    <ReportState
                      state="error"
                      title="Shoot data could not be loaded"
                      description={getErrorMessage(shootQuery.error, 'Please try again.')}
                      onRetry={() => void shootQuery.refetch()}
                    />
                  ) : !hasShoots ? (
                    <ReportState
                      state="empty"
                      title="No shoots in this period"
                      description="Shoots will appear here when they are scheduled."
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={periodRows} margin={{ top: 12, right: 12, left: 8, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="period" tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Shoots']} />
                        <Legend />
                        <Line type="monotone" dataKey="shoots" stroke="#2563eb" strokeWidth={2} name="Shoots" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {reportType === 'photographer' && (
          shootQuery.isPending ? (
            <Card><CardContent className="h-80 pt-6"><ReportState state="loading" /></CardContent></Card>
          ) : shootQuery.isError ? (
            <Card>
              <CardContent className="h-80 pt-6">
                <ReportState
                  state="error"
                  title="Photographer performance could not be loaded"
                  description={getErrorMessage(shootQuery.error, 'Please try again.')}
                  onRetry={() => void shootQuery.refetch()}
                />
              </CardContent>
            </Card>
          ) : photographerRows.length === 0 ? (
            <Card>
              <CardContent className="h-80 pt-6">
                <ReportState state="empty" title="No photographer activity in this period" />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Photographer Revenue</CardTitle>
                  <CardDescription>Top 10 by collected service revenue for {range.label}</CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={photographerChartRows} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(Number(value))} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Collected revenue']} />
                      <Bar dataKey="revenue" fill="#10b981" name="Collected revenue" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Photographer Shoot Count</CardTitle>
                  <CardDescription>Unique assigned shoots for {range.label}</CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={photographerChartRows} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Shoots']} />
                      <Bar dataKey="shoots" fill="#2563eb" name="Shoots" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )
        )}

        {reportType === 'service' && (
          shootQuery.isPending ? (
            <Card><CardContent className="h-80 pt-6"><ReportState state="loading" /></CardContent></Card>
          ) : shootQuery.isError ? (
            <Card>
              <CardContent className="h-80 pt-6">
                <ReportState
                  state="error"
                  title="Service performance could not be loaded"
                  description={getErrorMessage(shootQuery.error, 'Please try again.')}
                  onRetry={() => void shootQuery.refetch()}
                />
              </CardContent>
            </Card>
          ) : serviceRows.length === 0 ? (
            <Card>
              <CardContent className="h-80 pt-6">
                <ReportState state="empty" title="No service activity in this period" />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Services Breakdown</CardTitle>
                  <CardDescription>Share of booked shoots by service for {range.label}</CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={serviceChartRows}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={105}
                        dataKey="shoots"
                      >
                        {serviceChartRows.map((row, index) => (
                          <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Shoots']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service Revenue</CardTitle>
                  <CardDescription>Collected payment allocated to each service for {range.label}</CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceRows.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(Number(value))} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Collected revenue']} />
                      <Bar dataKey="revenue" fill="#10b981" name="Collected revenue" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
