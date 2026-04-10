import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Wallet,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  fetchAdminEditorEarnings,
  fetchAdminEditorEarningsDetail,
  fetchSelfEditorEarnings,
  markAdminEditorPayoutsPaid,
  sendAdminEditorReport,
  sendSelfEditorReport,
  type EditorEarningsAdminResponse,
  type EditorEarningsDetail,
} from '@/services/invoiceService';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';

const formatCurrency = (amount: number | string | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount || 0));

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
};

interface EditorEarningsWorkspaceProps {
  mode?: 'admin' | 'self';
}

export function EditorEarningsWorkspace({ mode = 'admin' }: EditorEarningsWorkspaceProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isAdmin = mode === 'admin';
  const [status, setStatus] = useState<'paid' | 'unpaid' | ''>('unpaid');
  const [search, setSearch] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [summaryResponse, setSummaryResponse] = useState<EditorEarningsAdminResponse | null>(null);
  const [selectedEditorId, setSelectedEditorId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EditorEarningsDetail | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());

  const loadSummary = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetchAdminEditorEarnings({
        status: status || undefined,
        search: deferredSearch || undefined,
        start: startDate || undefined,
        end: endDate || undefined,
        service_type: serviceType || undefined,
      });
      setSummaryResponse(response);
      setSelectedEditorId((current) => {
        if (!response.data.length) return null;
        return current && response.data.some((item) => item.editor.id === current)
          ? current
          : response.data[0].editor.id;
      });
    } catch (error) {
      toast({
        title: 'Failed to load editor earnings',
        description: error instanceof Error ? error.message : 'Unable to load editor earnings.',
        variant: 'destructive',
      });
      setSummaryResponse(null);
      setSelectedEditorId(null);
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, endDate, isAdmin, serviceType, startDate, status, toast]);

  const loadDetail = useCallback(async () => {
    setDetailLoading(true);

    try {
      const nextDetail = isAdmin
        ? selectedEditorId == null
          ? null
          : await fetchAdminEditorEarningsDetail(selectedEditorId, {
              status: status || undefined,
              start: startDate || undefined,
              end: endDate || undefined,
              service_type: serviceType || undefined,
            })
        : await fetchSelfEditorEarnings({
            status: status || undefined,
            start: startDate || undefined,
            end: endDate || undefined,
            service_type: serviceType || undefined,
          });

      setDetail(nextDetail);
    } catch (error) {
      toast({
        title: 'Failed to load editor detail',
        description: error instanceof Error ? error.message : 'Unable to load editor earnings detail.',
        variant: 'destructive',
      });
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [endDate, isAdmin, selectedEditorId, serviceType, startDate, status, toast]);

  useEffect(() => {
    if (isAdmin) {
      void loadSummary();
      return;
    }

    void loadDetail();
  }, [isAdmin, loadDetail, loadSummary]);

  useEffect(() => {
    if (!isAdmin || selectedEditorId == null) {
      return;
    }

    void loadDetail();
  }, [isAdmin, loadDetail, selectedEditorId]);

  const selectedSummary = useMemo(
    () => summaryResponse?.data.find((item) => item.editor.id === selectedEditorId) || null,
    [selectedEditorId, summaryResponse?.data],
  );

  const summaryCards = isAdmin
    ? {
        count: summaryResponse?.summary.editor_count || 0,
        total: summaryResponse?.summary.total_earned || 0,
        unpaid: summaryResponse?.summary.unpaid_amount || 0,
        services: summaryResponse?.summary.service_count || 0,
      }
    : {
        count: detail?.summary.shoot_count || 0,
        total: detail?.summary.total_earned || 0,
        unpaid: detail?.summary.unpaid_amount || 0,
        services: detail?.summary.service_count || 0,
      };

  const unpaidLineItems = (detail?.line_items || []).filter((item) => !item.is_paid);

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const rows = (detail?.line_items || []).map((item) => ({
      service: item.service_name,
      shoot: item.shoot_id,
      client: item.client?.name || 'Unknown client',
      quantity: item.quantity_snapshot,
      rate: formatCurrency(item.rate_snapshot),
      payout: formatCurrency(item.payout_amount),
      status: item.is_paid ? 'Paid' : 'Unpaid',
      completed: formatTimestamp(item.completed_at),
    }));

    const columns = [
      { key: 'service', label: 'Service' },
      { key: 'shoot', label: 'Shoot' },
      { key: 'client', label: 'Client' },
      { key: 'quantity', label: 'Qty' },
      { key: 'rate', label: 'Rate' },
      { key: 'payout', label: 'Payout' },
      { key: 'status', label: 'Status' },
      { key: 'completed', label: 'Completed' },
    ] as const;

    const fileName = isAdmin
      ? `editor-earnings-${detail?.editor?.name?.toLowerCase().replace(/\s+/g, '-') || 'report'}`
      : 'my-editor-earnings';

    if (format === 'csv') {
      exportRowsAsCsv(fileName, columns, rows);
      return;
    }

    if (format === 'excel') {
      exportRowsAsExcel(fileName, 'Editor Earnings', columns, rows);
      return;
    }

    exportRowsAsPdf(fileName, 'Editor Earnings Report', columns, rows);
  };

  const handleSendReport = async () => {
    try {
      setSendLoading(true);
      if (isAdmin) {
        await sendAdminEditorReport({
          start: startDate || undefined,
          end: endDate || undefined,
        });
      } else {
        await sendSelfEditorReport({
          start: startDate || undefined,
          end: endDate || undefined,
        });
      }

      toast({
        title: 'Report sent',
        description: isAdmin ? 'Editor payout reports were queued.' : 'Your earnings report was emailed.',
      });
    } catch (error) {
      toast({
        title: 'Send failed',
        description: error instanceof Error ? error.message : 'Unable to send the report.',
        variant: 'destructive',
      });
    } finally {
      setSendLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!unpaidLineItems.length) return;

    try {
      setMarkingPaid(true);
      await markAdminEditorPayoutsPaid(unpaidLineItems.map((item) => item.id));
      toast({
        title: 'Editor earnings marked paid',
        description: 'The selected earnings were recorded in the payout ledger.',
      });
      setMarkPaidDialogOpen(false);
      await Promise.all([loadSummary(), loadDetail()]);
    } catch (error) {
      toast({
        title: 'Mark paid failed',
        description: error instanceof Error ? error.message : 'Unable to mark editor earnings paid.',
        variant: 'destructive',
      });
    } finally {
      setMarkingPaid(false);
    }
  };

  const detailPanel = (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle>{detail?.editor?.name || 'Editor Earnings'}</CardTitle>
            <CardDescription>{detail?.editor?.email || 'Select an editor to review the payout ledger.'}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleSendReport} disabled={sendLoading}>
              {sendLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Report
            </Button>
            {isAdmin ? (
              <Button size="sm" onClick={() => setMarkPaidDialogOpen(true)} disabled={!unpaidLineItems.length}>
                <Wallet className="mr-2 h-4 w-4" />
                Mark Unpaid Earnings Paid
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Shoots</div>
            <div className="mt-1 text-lg font-semibold">{detail?.summary.shoot_count || 0}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Services</div>
            <div className="mt-1 text-lg font-semibold">{detail?.summary.service_count || 0}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total Earned</div>
            <div className="mt-1 text-lg font-semibold">{formatCurrency(detail?.summary.total_earned)}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Unpaid</div>
            <div className="mt-1 text-lg font-semibold">{formatCurrency(detail?.summary.unpaid_amount)}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-6">
        <section className="grid gap-3 xl:grid-cols-2">
          {detail?.current_rates?.service_rates?.length ? (
            detail.current_rates.service_rates.map((rate) => (
              <div key={`${rate.service_id || rate.service_name}`} className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="text-sm font-medium">{rate.service_name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{formatCurrency(rate.rate)} per unit</div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
              No explicit service rates are configured for this editor yet.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Completed Work Ledger</h3>
              <p className="text-sm text-muted-foreground">Snapshot-based payout rows that stay stable even when rates change later.</p>
            </div>
            {detailLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>

          {(detail?.line_items || []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
              No editor earnings were found for the selected period.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {detail?.line_items.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/70 bg-background px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.service_name}</span>
                        <Badge variant="outline" className={cn(item.is_paid ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-amber-500/20 bg-amber-500/10 text-amber-600')}>
                          {item.is_paid ? 'Paid' : 'Unpaid'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Shoot #{item.shoot_id} · {item.client?.name || 'Unknown client'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.shoot?.address || 'Address unavailable'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-[18rem]">
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Qty</div>
                        <div className="mt-1 font-semibold">{item.quantity_snapshot}</div>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Rate</div>
                        <div className="mt-1 font-semibold">{formatCurrency(item.rate_snapshot)}</div>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Payout</div>
                        <div className="mt-1 font-semibold">{formatCurrency(item.payout_amount)}</div>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Completed</div>
                        <div className="mt-1 font-semibold">{formatTimestamp(item.completed_at)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-border/70 bg-card/80">
          <CardContent className="px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{isAdmin ? 'Editors' : 'Shoots'}</div>
            <div className="mt-1 text-2xl font-semibold">{summaryCards.count}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80">
          <CardContent className="px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Services</div>
            <div className="mt-1 text-2xl font-semibold">{summaryCards.services}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80">
          <CardContent className="px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total Earned</div>
            <div className="mt-1 text-2xl font-semibold">{formatCurrency(summaryCards.total)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80">
          <CardContent className="px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Unpaid</div>
            <div className="mt-1 text-2xl font-semibold">{formatCurrency(summaryCards.unpaid)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{isAdmin ? 'Editor Earnings Filters' : 'My Earnings Filters'}</CardTitle>
          <CardDescription>
            Narrow the ledger by payout status, service type, and completion date.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_repeat(2,minmax(0,0.6fr))_minmax(0,1fr)_auto]">
          {isAdmin ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search editor name or email"
                className="pl-9"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Export your ledger, email yourself a report, or review payout history.
            </div>
          )}
          <select
            className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as 'paid' | 'unpaid' | '')}
          >
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </select>
          <select
            className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm"
            value={serviceType}
            onChange={(event) => setServiceType(event.target.value)}
          >
            <option value="">All services</option>
            <option value="photo">Photo</option>
            <option value="video">Video</option>
            <option value="virtual_staging">Virtual Staging</option>
            <option value="floorplan">Floorplan</option>
          </select>
          <DateRangePicker
            value={{ startDate, endDate }}
            onChange={({ startDate: nextStartDate, endDate: nextEndDate }) => {
              setStartDate(nextStartDate);
              setEndDate(nextEndDate);
            }}
          />
          <Button variant="outline" onClick={() => (isAdmin ? loadSummary() : loadDetail())} disabled={loading || detailLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {isAdmin ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(22rem,25rem)_minmax(0,1fr)]">
          <Card className="border-border/70 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Editors Queue</CardTitle>
              <CardDescription>{summaryResponse?.data.length || 0} editors in this filtered payout view</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {(summaryResponse?.data || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                  No editor earnings were found for the current filters.
                </div>
              ) : (
                summaryResponse?.data.map((item) => (
                  <button
                    key={item.editor.id}
                    type="button"
                    onClick={() => {
                      setSelectedEditorId(item.editor.id);
                      if (isMobile) {
                        setMobileDetailOpen(true);
                      }
                    }}
                    className={cn(
                      'rounded-xl border px-4 py-4 text-left transition-colors',
                      item.editor.id === selectedEditorId
                        ? 'border-primary/35 bg-primary/5'
                        : 'border-border/70 bg-card hover:border-border',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{item.editor.name}</div>
                        <div className="text-sm text-muted-foreground">{item.editor.email}</div>
                      </div>
                      <Badge variant="outline" className={item.status === 'unpaid' ? 'border-amber-500/20 bg-amber-500/10 text-amber-600' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'}>
                        {item.status === 'unpaid' ? 'Unpaid' : 'Paid'}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Shoots</div>
                        <div className="mt-1 font-semibold">{item.shoot_count}</div>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Unpaid</div>
                        <div className="mt-1 font-semibold">{formatCurrency(item.unpaid_amount)}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {isMobile ? (
            <>
              <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
                <SheetContent side="right" className="w-full sm:max-w-3xl">
                  <SheetHeader className="border-b border-border/70 pb-4">
                    <SheetTitle>Editor Earnings Detail</SheetTitle>
                    <SheetDescription>Review rates, completed work, and payout status.</SheetDescription>
                  </SheetHeader>
                  <div className="mt-4">{detailPanel}</div>
                </SheetContent>
              </Sheet>
              <Card className="border-border/70 bg-card/80">
                <CardContent className="flex min-h-[16rem] flex-col items-center justify-center text-center text-sm text-muted-foreground">
                  Tap any editor to open their earnings detail.
                </CardContent>
              </Card>
            </>
          ) : (
            detailPanel
          )}
        </div>
      ) : (
        detailPanel
      )}

      <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Editor Earnings Paid</DialogTitle>
            <DialogDescription>
              This will snapshot the current unpaid line items into a payout batch and mark them as paid.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">{detail?.editor?.name}</div>
            <div className="mt-1">{unpaidLineItems.length} unpaid line items selected</div>
            <div className="mt-1 text-foreground">{formatCurrency(detail?.summary.unpaid_amount)}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} disabled={markingPaid || !unpaidLineItems.length}>
              {markingPaid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Mark Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
