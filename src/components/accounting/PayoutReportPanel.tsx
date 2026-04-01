import React, { useState, useEffect, useCallback } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Download,
  DollarSign,
  Users,
  Camera,
  Briefcase,
  Loader2,
  Calendar as CalendarIcon,
  RefreshCw,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  PayoutReport,
  PayoutSummary,
  fetchPayoutReport,
  downloadPayoutReport,
} from '@/services/invoiceService';

const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const toFilterDate = (value: string) => {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
};

const toFilterValue = (date?: Date) => (date ? format(date, 'yyyy-MM-dd') : '');

const formatFilterDate = (value: string) => {
  const parsed = toFilterDate(value);
  return parsed ? format(parsed, 'dd-MM-yyyy') : 'dd-mm-yyyy';
};

const formatDateRangeLabel = (start: string, end: string) => {
  if (start && end) {
    return `${formatFilterDate(start)} - ${formatFilterDate(end)}`;
  }
  if (start) {
    return `${formatFilterDate(start)} - End date`;
  }
  return 'Choose date range';
};

interface PayoutReportPanelProps {
  hideHeaderButtons?: boolean;
  onRefresh?: () => void;
  onDownload?: () => void;
  registerActions?: (actions: { refresh: () => void; download: () => Promise<void>; loading: boolean; downloading: boolean }) => void;
}

export const PayoutReportPanel: React.FC<PayoutReportPanelProps> = ({ hideHeaderButtons = false, registerActions }) => {
  const { toast } = useToast();
  const [report, setReport] = useState<PayoutReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadReport = useCallback(async (start?: string, end?: string) => {
    try {
      setLoading(true);
      const params: { start?: string; end?: string } = {};
      if (start) params.start = start;
      if (end) params.end = end;
      const data = await fetchPayoutReport(params);
      setReport(data);
    } catch (error: any) {
      console.error('Failed to load payout report:', error);
      toast({ title: 'Failed to load payout report', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const params: { start?: string; end?: string } = {};
      if (startDate) params.start = startDate;
      if (endDate) params.end = endDate;
      await downloadPayoutReport(params);
      toast({ title: 'Report downloaded' });
    } catch (error: any) {
      toast({ title: 'Download failed', description: error.message, variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const handleFilter = () => {
    loadReport(startDate || undefined, endDate || undefined);
  };

  useEffect(() => {
    if (registerActions) {
      registerActions({
        refresh: () => loadReport(),
        download: handleDownload,
        loading,
        downloading,
      });
    }
  }, [registerActions, loading, downloading, loadReport]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    loadReport();
  };

  const selectedRange: DateRange | undefined = startDate
    ? {
        from: toFilterDate(startDate),
        to: toFilterDate(endDate) ?? toFilterDate(startDate),
      }
    : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading payout report...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Date Filters - Combined */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Payout Report
          </h2>
          {report?.period && (
            <span className="text-sm text-muted-foreground">
              {formatDate(report.period.start)} – {formatDate(report.period.end)}
            </span>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 xl:w-auto">
          <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-[minmax(0,1fr)_auto] xl:min-w-[32rem]">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{formatDateRangeLabel(startDate, endDate)}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="z-[90] w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  numberOfMonths={1}
                  selected={selectedRange}
                  onSelect={(range) => {
                    setStartDate(toFilterValue(range?.from));
                    setEndDate(toFilterValue(range?.to ?? range?.from));
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" className="h-10 gap-2" onClick={handleFilter}>
              <CalendarIcon className="h-4 w-4" />
              Filter
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="px-2">
                Clear
              </Button>
            )}
            {!hideHeaderButtons && (
              <>
                <Button variant="outline" size="sm" onClick={() => loadReport()} disabled={loading}>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
                <Button size="sm" onClick={handleDownload} disabled={downloading}>
                  {downloading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                  Download CSV
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Camera className="w-4 h-4" />
                Photographers
              </div>
              <p className="text-2xl font-bold mt-1">{report.totals.photographer_count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                Photographer Payouts
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(report.totals.photographer_total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="w-4 h-4" />
                Sales Reps
              </div>
              <p className="text-2xl font-bold mt-1">{report.totals.sales_rep_count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                Sales Rep Commissions
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(report.totals.sales_rep_commission_total)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Photographers Table */}
      {report && report.photographers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Photographers to Pay
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3 md:hidden">
              {report.photographers.map((p) => (
                <div key={p.id} className="rounded-xl border border-border/70 bg-card/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-muted-foreground break-all">{p.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p>
                      <p className="font-bold">{formatCurrency(p.gross_total)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-muted-foreground">Shoots</p>
                      <p className="mt-1 font-semibold">{p.shoot_count}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-muted-foreground">Avg. Per Shoot</p>
                      <p className="mt-1 font-semibold">{formatCurrency(p.average_value)}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Total</p>
                    <p className="text-sm text-muted-foreground">
                      {report.photographers.reduce((s, p) => s + p.shoot_count, 0)} shoots
                    </p>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(report.totals.photographer_total)}</p>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Shoots</TableHead>
                    <TableHead className="text-right">Avg. Per Shoot</TableHead>
                    <TableHead className="text-right">Amount to Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.photographers.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                      <TableCell className="text-center">{p.shoot_count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.average_value)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(p.gross_total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-center">{report.photographers.reduce((s, p) => s + p.shoot_count, 0)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totals.photographer_total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Reps Table */}
      {report && report.sales_reps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Sales Representatives – Commission Payouts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3 md:hidden">
              {report.sales_reps.map((r) => (
                <div key={r.id} className="rounded-xl border border-border/70 bg-card/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-sm text-muted-foreground break-all">{r.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Commission</p>
                      <p className="font-bold">{formatCurrency(r.commission_total || 0)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-muted-foreground">Shoots</p>
                      <p className="mt-1 font-semibold">{r.shoot_count}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-muted-foreground">Gross Total</p>
                      <p className="mt-1 font-semibold">{formatCurrency(r.gross_total)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-muted-foreground">Commission Rate</p>
                      <p className="mt-1 font-semibold">
                        {r.commission_rate ? `${r.commission_rate}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-muted-foreground">Payout</p>
                      <p className="mt-1 font-semibold">{formatCurrency(r.commission_total || 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Total</p>
                    <p className="text-sm text-muted-foreground">
                      {report.sales_reps.reduce((s, r) => s + r.shoot_count, 0)} shoots
                    </p>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(report.totals.sales_rep_commission_total)}</p>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Shoots</TableHead>
                    <TableHead className="text-right">Gross Total</TableHead>
                    <TableHead className="text-center">Commission Rate</TableHead>
                    <TableHead className="text-right">Commission Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.sales_reps.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                      <TableCell className="text-center">{r.shoot_count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.gross_total)}</TableCell>
                      <TableCell className="text-center">
                        {r.commission_rate ? `${r.commission_rate}%` : <span className="text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(r.commission_total || 0)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.sales_reps.reduce((s, r) => s + r.gross_total, 0))}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totals.sales_rep_commission_total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {report && report.photographers.length === 0 && report.sales_reps.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Payouts for This Period</h3>
            <p className="text-muted-foreground text-sm mt-1">
              No completed shoots found for the selected period.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
