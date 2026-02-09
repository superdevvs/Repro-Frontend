import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  CalendarDays,
  RefreshCw,
} from 'lucide-react';
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

export const PayoutReportPanel: React.FC = () => {
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

  const handleFilter = () => {
    loadReport(startDate || undefined, endDate || undefined);
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading payout report...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Payout Report
          </h2>
          {report?.period && (
            <p className="text-sm text-muted-foreground mt-1">
              Period: {formatDate(report.period.start)} – {formatDate(report.period.end)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadReport()} disabled={loading}>
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
            Download CSV
          </Button>
        </div>
      </div>

      {/* Date Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button variant="outline" onClick={handleFilter}>
              <CalendarDays className="w-3 h-3 mr-1" />
              Filter
            </Button>
            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); loadReport(); }}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
