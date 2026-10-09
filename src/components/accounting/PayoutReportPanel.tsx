import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Send } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  PayoutReport,
  fetchPayoutReport,
  downloadPayoutReport,
  sendPayoutReport,
} from '@/services/invoiceService';
import { normalizeReportingWeekRange } from '@/utils/reportingWeek';
import { getPayoutReportRows } from './payoutReportDisplay';
import { PayoutReportResults } from './PayoutReportResults';
import { formatBillingPeriod } from './invoiceReviewWorkspaceUtils';
import type { AccountingDateRange } from './accountingDateRange';
import { exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import './admin-review-workspace.css';

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

interface PayoutReportPanelProps {
  reportingRange?: AccountingDateRange;
  role?: 'all' | 'photographer' | 'salesRep' | 'editor';
  title?: string;
  description?: string;
  hideHeaderButtons?: boolean;
  onRefresh?: () => void;
  onDownload?: () => void;
  registerActions?: (actions: { refresh: () => void; download: () => Promise<void>; send: () => Promise<void>; loading: boolean; downloading: boolean; sending: boolean }) => void;
}

export const PayoutReportPanel: React.FC<PayoutReportPanelProps> = ({
  role = 'all',
  title = 'Payout Report',
  description,
  hideHeaderButtons = false,
  registerActions,
  reportingRange,
}) => {
  const { toast } = useToast();
  const [report, setReport] = useState<PayoutReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [localStartDate, setStartDate] = useState('');
  const [localEndDate, setEndDate] = useState('');
  const startDate = reportingRange?.startDate ?? localStartDate;
  const endDate = reportingRange?.endDate ?? localEndDate;
  const reportingStart = reportingRange?.startDate;
  const reportingEnd = reportingRange?.endDate;
  const requestId = useRef(0);

  const loadReport = useCallback(async (start?: string, end?: string) => {
    const currentRequest = ++requestId.current;
    try {
      setLoading(true);
      const params: { start?: string; end?: string; role?: 'all' | 'photographer' | 'salesRep' | 'editor'; exact_range?: boolean } = { role, exact_range: reportingStart !== undefined && reportingEnd !== undefined };
      if (start) params.start = start;
      if (end) params.end = end;
      const data = await fetchPayoutReport(params);
      if (currentRequest !== requestId.current) return;
      setReport(data);
    } catch (error: unknown) {
      if (currentRequest !== requestId.current) return;
      setReport(null);
      toast({
        title: 'Failed to load payout report',
        description: getErrorMessage(error, 'Unable to load the payout report.'),
        variant: 'destructive',
      });
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [role, toast, reportingStart, reportingEnd]);

  useEffect(() => {
    loadReport(reportingStart, reportingEnd);
    return () => { requestId.current += 1; };
  }, [loadReport, reportingStart, reportingEnd]);

  const normalizeSelectedRange = useCallback(() => {
    if (reportingStart !== undefined && reportingEnd !== undefined) return { startDate: reportingStart, endDate: reportingEnd };
    const normalized = normalizeReportingWeekRange({ startDate, endDate });
    if (normalized.startDate !== startDate) setStartDate(normalized.startDate);
    if (normalized.endDate !== endDate) setEndDate(normalized.endDate);
    return normalized;
  }, [endDate, startDate, reportingStart, reportingEnd]);

  const handleDownload = useCallback(async () => {
    try {
      setDownloading(true);
      const normalized = { startDate: reportingStart ?? report?.period.start ?? '', endDate: reportingEnd ?? report?.period.end ?? '' };
      const params: { start?: string; end?: string; role?: 'all' | 'photographer' | 'salesRep' | 'editor'; exact_range?: boolean } = { role, exact_range: Boolean(reportingRange) };
      if (normalized.startDate) params.start = normalized.startDate;
      if (normalized.endDate) params.end = normalized.endDate;
      await downloadPayoutReport(params);
      toast({ title: 'Report downloaded' });
    } catch (error: unknown) {
      toast({
        title: 'Download failed',
        description: getErrorMessage(error, 'Unable to download the payout report.'),
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  }, [report?.period.start, report?.period.end, reportingStart, reportingEnd, reportingRange, role, toast]);

  const handleSend = useCallback(async () => {
    try {
      setSending(true);
      const normalized = { startDate: reportingStart ?? report?.period.start ?? '', endDate: reportingEnd ?? report?.period.end ?? '' };
      await sendPayoutReport({
        role,
        start: normalized.startDate || undefined,
        end: normalized.endDate || undefined,
        exact_range: Boolean(reportingRange),
      });
      toast({ title: 'Report sent', description: 'Accounting payout emails were queued successfully.' });
    } catch (error: unknown) {
      toast({
        title: 'Send failed',
        description: getErrorMessage(error, 'Unable to send the payout report.'),
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  }, [report?.period.start, report?.period.end, reportingStart, reportingEnd, reportingRange, role, toast]);

  const handleFilter = useCallback(() => {
    const normalized = normalizeSelectedRange();
    void loadReport(normalized.startDate || undefined, normalized.endDate || undefined);
  }, [loadReport, normalizeSelectedRange]);

  useEffect(() => {
    if (registerActions) {
      registerActions({
        refresh: handleFilter,
        download: handleDownload,
        send: handleSend,
        loading,
        downloading,
        sending,
      });
    }
  }, [registerActions, loading, downloading, sending, handleFilter, handleDownload, handleSend]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    loadReport();
  };

  const rows = getPayoutReportRows(report, role);
  const handleLocalExport = async (format: 'excel' | 'pdf') => {
    setDownloading(true);
    try {
      const columns = [
        { key: 'name', label: 'Payee' }, { key: 'email', label: 'Email' }, { key: 'group', label: 'Role' },
        { key: 'shoot_count', label: 'Shoots' }, { key: 'service_count', label: 'Services' },
        { key: 'gross_total', label: 'Gross total' }, { key: 'commission_rate', label: 'Commission rate (%)' },
        { key: 'payout', label: 'Payout (USD)' },
      ] as const;
      const filename = `payout-report-${report?.period.start || 'current'}-${report?.period.end || 'week'}`;
      const heading = `${title} · ${formatBillingPeriod(report?.period.start, report?.period.end)}`;
      const exportRows = rows.map((row) => ({ ...row }));
      if (format === 'excel') await exportRowsAsExcel(filename, 'Payout report', columns, exportRows);
      else await exportRowsAsPdf(filename, heading, columns, exportRows);
    } catch (error) {
      toast({ title: 'Export failed', description: getErrorMessage(error, 'Unable to export the payout report.'), variant: 'destructive' });
    } finally { setDownloading(false); }
  };

  return <div className="ar-workspace space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{report ? formatBillingPeriod(report.period.start, report.period.end) : description}</p></div>
      {!hideHeaderButtons && <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={loading} onClick={handleFilter}><RefreshCw className="mr-2 size-3.5" />Refresh</Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={loading || downloading || !report}><Download className="mr-2 size-3.5" />{downloading ? 'Exporting…' : 'Export'}</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void handleDownload()}>CSV</DropdownMenuItem><DropdownMenuItem onClick={() => void handleLocalExport('excel')}>Excel</DropdownMenuItem><DropdownMenuItem onClick={() => void handleLocalExport('pdf')}>PDF</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
        <Button size="sm" disabled={loading || sending || !report} onClick={() => void handleSend()}><Send className="mr-2 size-3.5" />{sending ? 'Sending…' : 'Send report'}</Button>
      </div>}
    </div>
    {!reportingRange && <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1 sm:max-w-sm"><DateRangePicker value={{ startDate, endDate }} onChange={({ startDate: start, endDate: end }) => { setStartDate(start); setEndDate(end); }} /></div>
      <Button variant="outline" size="sm" disabled={loading} onClick={handleFilter}>Apply weeks</Button>
      {(startDate || endDate) && <Button variant="ghost" size="sm" onClick={clearFilters} disabled={loading}>Clear</Button>}
    </div>}
    <p className="text-xs text-muted-foreground">{reportingRange ? `Earning period · ${formatBillingPeriod(reportingStart, reportingEnd)}.` : 'Sunday–Saturday billing weeks.'} Exports and email include every payee in the displayed report; table search only narrows the view.</p>
    {loading ? <div className="flex min-h-60 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4" />Loading payout report…</div>
      : report ? <PayoutReportResults key={`${role}-${report.period.start}-${report.period.end}`} rows={rows} />
      : <p className="ar-empty">The report could not be loaded. Refresh to try again.</p>}
  </div>;
};
