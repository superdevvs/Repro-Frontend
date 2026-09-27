import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, Download, LayoutGrid, List } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import type { ClientBillingItem } from '@/types/clientBilling';
import { DEFAULT_INVOICE_DATE_FILTER, EMPTY_INVOICE_CUSTOM_RANGE, filterInvoiceItemsByDate, parseInvoiceDateInput, type InvoiceDateFilter } from '@/utils/invoiceDateFilters';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';
import { clientBillingCurrency } from './clientBillingPresentation';

interface ClientBillingListProps {
  items: ClientBillingItem[];
  loading?: boolean;
  onView: (item: ClientBillingItem) => void;
  onPay?: (item: ClientBillingItem) => void;
  onDownload?: (item: ClientBillingItem, format: 'pdf' | 'csv') => void | Promise<void>;
  onDownloadMultiple?: (items: ClientBillingItem[]) => void | Promise<void>;
}

const isPayable = (item: ClientBillingItem) => item.paymentRequired !== false && item.bucket !== 'paid' && item.bucket !== 'no_payment_required' && item.balance > 0.01;
const formatDate = (value?: string | null) => {
  const date = parseInvoiceDateInput(value);
  return date ? format(date, 'MMM d, yyyy') : '—';
};
const statusLabel = (item: ClientBillingItem) => item.status === 'no_payment_required' ? 'No payment required' : item.status.charAt(0).toUpperCase() + item.status.slice(1).replace(/_/g, ' ');
const sourceLabel = (item: ClientBillingItem) => item.documentType === 'complimentary_receipt' ? 'Complimentary receipt' : item.sourceLabel;
const sourceAndBucket = (item: ClientBillingItem) => <><span>{sourceLabel(item)}</span>{(item.bucket === 'due_now' || item.bucket === 'upcoming') && <> · <span>{item.bucket === 'due_now' ? 'Due now' : 'Upcoming'}</span></>}</>;
const referenceLabel = (item: ClientBillingItem) => item.number ? `#${item.number}` : item.shootId != null ? `Shoot #${item.shootId}` : item.id;
const selectionLabel = (item: ClientBillingItem) => item.number ? `invoice ${item.number}` : `billing item ${item.id}`;
const statusColor = (status: ClientBillingItem['status']) => ({
  paid: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  pending: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  overdue: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  no_payment_required: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
}[status]);
const buckets = [
  ['all', 'All billing'], ['due_now', 'Due now'], ['upcoming', 'Upcoming'], ['paid', 'Paid'], ['no_payment_required', 'No payment required'],
] as const;

export function ClientBillingList({ items, loading = false, onView, onPay, onDownload, onDownloadMultiple }: ClientBillingListProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | ClientBillingItem['bucket']>('all');
  const [dateFilter, setDateFilter] = useState<InvoiceDateFilter>(DEFAULT_INVOICE_DATE_FILTER);
  const [view, setView] = useState<'list' | 'cards' | null>(null);
  const showCards = view ? view === 'cards' : isMobile;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const recordsRef = useRef<HTMLDivElement>(null);
  const filteredItems = useMemo(() => filterInvoiceItemsByDate(items, dateFilter, (item) => item.issueDate || item.dueDate)
    .filter((item) => activeTab === 'all' || item.bucket === activeTab), [activeTab, dateFilter, items]);
  const selectedItems = useMemo(() => filteredItems.filter((item) => selectedIds.has(item.id)), [filteredItems, selectedIds]);
  const exportItems = selectedItems.length ? selectedItems : filteredItems;
  const allSelected = filteredItems.length > 0 && selectedItems.length === filteredItems.length;
  const pages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const releaseCount = items.filter((item) => item.paymentRequiredToRelease).length;

  useEffect(() => {
    const visibleIds = new Set(filteredItems.map((item) => item.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filteredItems]);
  useEffect(() => { setPage((current) => Math.min(current, pages)); }, [pages]);
  useEffect(() => { if (recordsRef.current) recordsRef.current.scrollTop = 0; }, [currentPage, pageSize, activeTab, dateFilter, showCards]);

  const updateFilter = (next: InvoiceDateFilter) => { setDateFilter(next); setPage(1); };
  const toggleSelected = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(filteredItems.map((item) => item.id)));

  const handleExport = async (exportFormat: 'csv' | 'excel' | 'pdf') => {
    const rows = exportItems.map((item) => ({ reference: item.number || (item.shootId != null ? `Shoot ${item.shootId}` : item.id), source: sourceLabel(item), property: item.property || '', status: statusLabel(item), amount: item.amount, paid: item.amountPaid, balance: item.balance, issueDate: formatDate(item.issueDate), dueDate: formatDate(item.dueDate) }));
    const columns = [
      { key: 'reference', label: 'Reference' }, { key: 'source', label: 'Source' }, { key: 'property', label: 'Property' }, { key: 'status', label: 'Status' }, { key: 'amount', label: 'Amount' }, { key: 'paid', label: 'Paid' }, { key: 'balance', label: 'Balance' }, { key: 'issueDate', label: 'Issue Date' }, { key: 'dueDate', label: 'Due Date' },
    ] as const;
    const filename = `billing-${format(new Date(), 'yyyy-MM-dd')}`;
    setExporting(true);
    try {
      if (exportFormat === 'csv') exportRowsAsCsv(filename, columns, rows);
      else if (exportFormat === 'excel') await exportRowsAsExcel(filename, 'Billing', columns, rows);
      else await exportRowsAsPdf(filename, 'Billing Report', columns, rows);
    } catch (error) {
      toast({ title: 'Export failed', description: error instanceof Error ? error.message : 'Unable to export these billing items.', variant: 'destructive' });
    } finally { setExporting(false); }
  };
  const handleDownload = async (item: ClientBillingItem, downloadFormat: 'pdf' | 'csv') => {
    if (!onDownload) return;
    try {
      await onDownload(item, downloadFormat);
      toast({ title: 'Billing file downloaded', description: `${referenceLabel(item)} was downloaded as ${downloadFormat.toUpperCase()}.` });
    } catch (error) {
      toast({ title: 'Download failed', description: error instanceof Error ? error.message : 'Unable to download this billing item.', variant: 'destructive' });
    }
  };
  const handleBulkPdf = async () => {
    if (!onDownloadMultiple || !selectedItems.length) return;
    setDownloading(true);
    try {
      await onDownloadMultiple(selectedItems);
      toast({ title: 'Billing statements downloaded', description: `${selectedItems.length} statements were combined into one PDF.` });
    } catch (error) {
      toast({ title: 'Download failed', description: error instanceof Error ? error.message : 'Unable to download the selected billing statements.', variant: 'destructive' });
    } finally { setDownloading(false); }
  };
  const actions = (item: ClientBillingItem) => <div className="flex flex-wrap items-center gap-1.5">
    {onPay && isPayable(item) && <Button size="sm" className="h-8 gap-1 px-2.5 text-xs" onClick={() => onPay(item)}><CreditCard className="h-3.5 w-3.5" />Pay {clientBillingCurrency.format(item.balance)}</Button>}
    <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" aria-label={`View ${selectionLabel(item)}`} onClick={() => onView(item)}>View</Button>
    {onDownload && <BillingDownloadMenu item={item} onDownload={handleDownload} />}
  </div>;
  const selection = (item: ClientBillingItem) => <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelected(item.id)} aria-label={`Select ${selectionLabel(item)}`} />;
  const status = (item: ClientBillingItem) => <div className="flex flex-wrap gap-1.5"><Badge variant="outline" className={statusColor(item.status)}>{statusLabel(item)}</Badge>{item.paymentRequiredToRelease && <Badge variant="outline" className="border-rose-500/30 text-rose-600 dark:text-rose-300">Release blocked</Badge>}</div>;

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-sm font-semibold">Your billing</h2>
        {releaseCount > 0 && <span className="text-xs text-rose-600 dark:text-rose-300">{releaseCount} payment{releaseCount === 1 ? '' : 's'} required to release delivery</span>}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b px-3 pb-3" role="group" aria-label="Billing controls">
        <Tabs value={activeTab} className="min-w-0 max-w-full" onValueChange={(value) => { setActiveTab(value as typeof activeTab); setPage(1); }}>
          <TabsList className="h-auto max-w-full flex-wrap justify-start gap-0.5">
            {buckets.map(([value, label]) => <TabsTrigger key={value} value={value} className="px-2.5 py-1.5 text-xs">{label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <select className="h-8 max-w-full rounded-md border bg-background px-2 text-xs" aria-label="Filter billing items by date" value={dateFilter.preset} onChange={(event) => updateFilter({ ...dateFilter, preset: event.target.value as InvoiceDateFilter['preset'] })}>
          <option value="all">All billing dates</option><option value="day">Today</option><option value="week">This week</option><option value="month">This month</option><option value="quarter">This quarter</option><option value="year">This year</option><option value="custom">Custom dates</option>
        </select>
        {dateFilter.preset === 'custom' && <DateRangePicker value={dateFilter.customRange || EMPTY_INVOICE_CUSTOM_RANGE} onChange={(customRange) => updateFilter({ preset: 'custom', customRange })} triggerClassName="h-8 max-w-full text-xs" />}
        <div className="flex items-center gap-1 rounded-md border p-0.5" role="group" aria-label="Billing view">
          <Button variant={!showCards ? 'secondary' : 'ghost'} className="h-7 w-7 p-0" aria-label="List view" aria-pressed={!showCards} onClick={() => setView('list')}><List className="h-4 w-4" /></Button>
          <Button variant={showCards ? 'secondary' : 'ghost'} className="h-7 w-7 p-0" aria-label="Cards view" aria-pressed={showCards} onClick={() => setView('cards')}><LayoutGrid className="h-4 w-4" /></Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="ml-auto h-8 gap-1.5 text-xs" aria-label="Export billing items" disabled={loading || exporting || !filteredItems.length}><Download className="h-3.5 w-3.5" />{exporting ? 'Exporting…' : 'Export'}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuLabel>{selectedItems.length ? `${selectedItems.length} selected` : `All ${filteredItems.length} filtered items`}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onClick={() => void handleExport('csv')}>Export CSV</DropdownMenuItem><DropdownMenuItem onClick={() => void handleExport('excel')}>Export Excel</DropdownMenuItem><DropdownMenuItem onClick={() => void handleExport('pdf')}>Export PDF report</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
      {selectedItems.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2 text-xs" aria-live="polite"><span className="font-medium">{selectedItems.length} selected across all pages</span><Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>{onDownloadMultiple && <Button variant="outline" size="sm" disabled={downloading} className="ml-auto h-7 px-2 text-xs" onClick={() => void handleBulkPdf()}>{downloading ? 'Downloading…' : 'Selected billing statements'}</Button>}</div>}
      {loading ? <div className="p-8 text-center text-sm text-muted-foreground" role="status">Loading billing data…</div> : !filteredItems.length ? <div className="p-10 text-center text-sm text-muted-foreground">No billing items found</div> : showCards ? <>
        <label className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground"><Checkbox checked={allSelected ? true : selectedItems.length ? 'indeterminate' : false} onCheckedChange={toggleAll} aria-label="Select all filtered billing items" />Select all {filteredItems.length} filtered items</label>
        <div ref={recordsRef} className="grid max-h-[480px] grid-cols-1 gap-3 overflow-y-auto overscroll-auto p-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Billing cards">
          {pageItems.map((item) => <article key={item.id} className="min-w-0 rounded-lg border p-3">
            <div className="flex items-start gap-2"><span className="pt-0.5">{selection(item)}</span><div className="min-w-0"><p className="break-words text-sm font-semibold">{referenceLabel(item)}</p><p className="text-xs text-muted-foreground">{sourceAndBucket(item)}</p></div></div>
            <p className="mt-3 break-words text-sm font-medium">{item.property || 'Property unavailable'}</p>
            <div className="my-3 flex flex-wrap justify-between gap-2 text-xs"><div><p className="text-muted-foreground">Open balance</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{clientBillingCurrency.format(item.balance)}</p><p className="text-muted-foreground">Total {clientBillingCurrency.format(item.amount)}</p></div><div className="text-muted-foreground"><p>Issued {formatDate(item.issueDate || item.dueDate)}</p><p className="mt-1">Due {formatDate(item.dueDate)}</p></div></div>
            {status(item)}<div className="mt-3 border-t pt-3">{actions(item)}</div>
          </article>)}
        </div>
      </> : <div ref={recordsRef} className="max-h-[380px] overflow-auto overscroll-auto" tabIndex={0} role="region" aria-label="Billing records">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-card text-muted-foreground"><tr className="border-b"><th className="w-10 px-3 py-3"><Checkbox checked={allSelected ? true : selectedItems.length ? 'indeterminate' : false} onCheckedChange={toggleAll} aria-label="Select all filtered billing items" /></th><th className="px-3 py-3 font-medium">Reference / source</th><th className="px-3 py-3 font-medium">Property</th><th className="px-3 py-3 font-medium">Issued / due</th><th className="px-3 py-3 font-medium">Open balance</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Actions</th></tr></thead>
          <tbody>{pageItems.map((item) => <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30"><td className="px-3 py-3">{selection(item)}</td><td className="px-3 py-3"><p className="font-semibold">{referenceLabel(item)}</p><p className="mt-1 text-muted-foreground">{sourceAndBucket(item)}</p></td><td className="max-w-[240px] break-words px-3 py-3 font-medium">{item.property || '—'}</td><td className="whitespace-nowrap px-3 py-3">{formatDate(item.issueDate || item.dueDate)}<p className="mt-1 text-muted-foreground">Due {formatDate(item.dueDate)}</p></td><td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums">{clientBillingCurrency.format(item.balance)}<p className="mt-1 font-normal text-muted-foreground">Total {clientBillingCurrency.format(item.amount)}</p></td><td className="px-3 py-3">{status(item)}</td><td className="px-3 py-3">{actions(item)}</td></tr>)}</tbody>
        </table>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2.5 text-xs">
        <span className="text-muted-foreground" aria-live="polite">{filteredItems.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredItems.length)} of ${filteredItems.length} billing items` : '0 billing items'}</span>
        <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-1.5 text-muted-foreground">Rows<select aria-label="Billing items per page" className="h-8 rounded-md border bg-background px-1.5 text-foreground" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[5, 10, 20].map((size) => <option key={size}>{size}</option>)}</select></label><span>Page {currentPage} of {pages}</span><Button variant="outline" className="h-8 w-8 p-0" disabled={loading || currentPage === 1} aria-label="Previous billing page" onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" className="h-8 w-8 p-0" disabled={loading || currentPage === pages} aria-label="Next billing page" onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button></div>
      </div>
    </Card>
  );
}

function BillingDownloadMenu({ item, onDownload }: { item: ClientBillingItem; onDownload: (item: ClientBillingItem, format: 'pdf' | 'csv') => void | Promise<void> }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-xs" aria-label={`Download ${selectionLabel(item)}`}><Download className="h-3.5 w-3.5" /><span className="sr-only">Download</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Download</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onClick={() => void onDownload(item, 'pdf')}>PDF statement</DropdownMenuItem><DropdownMenuItem disabled={item.invoiceId == null} onClick={() => void onDownload(item, 'csv')}>CSV detail</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
