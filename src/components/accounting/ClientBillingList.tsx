import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar as CalendarIcon, CreditCard, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import type { ClientBillingItem } from '@/types/clientBilling';
import { InvoiceDateFilterToolbar, type InvoiceExportFormat } from './InvoiceDateFilterToolbar';
import {
  DEFAULT_INVOICE_DATE_FILTER,
  filterInvoiceItemsByDate,
  parseInvoiceDateInput,
  type InvoiceDateFilter,
} from '@/utils/invoiceDateFilters';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';

interface ClientBillingListProps {
  items: ClientBillingItem[];
  loading?: boolean;
  onView: (item: ClientBillingItem) => void;
  /**
   * Start payment for a billing row. Optional so the table still renders in
   * contexts that cannot take payment.
   */
  onPay?: (item: ClientBillingItem) => void;
  onDownload?: (item: ClientBillingItem, format: 'pdf' | 'csv') => void | Promise<void>;
  onDownloadMultiple?: (items: ClientBillingItem[]) => void | Promise<void>;
}

/** A row is payable when money is actually outstanding on it. */
const isPayable = (item: ClientBillingItem) =>
  item.paymentRequired !== false
  && item.bucket !== 'paid'
  && item.bucket !== 'no_payment_required'
  && item.balance > 0.01;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = parseInvoiceDateInput(value);
  if (!parsed) return '—';
  return format(parsed, 'MMM d, yyyy');
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'no_payment_required':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200';
    case 'overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  }
};

const getStatusLabel = (status: ClientBillingItem['status']) => {
  if (status === 'no_payment_required') return 'No payment required';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
};

const getBucketLabel = (bucket: ClientBillingItem['bucket']) => {
  switch (bucket) {
    case 'due_now':
      return 'Due now';
    case 'upcoming':
      return 'Upcoming';
    case 'no_payment_required':
      return 'No payment required';
    default:
      return 'Paid';
  }
};

const getSourceLabel = (item: ClientBillingItem) =>
  item.documentType === 'complimentary_receipt' ? 'Complimentary receipt' : item.sourceLabel;

export function ClientBillingList({
  items,
  loading = false,
  onView,
  onPay,
  onDownload,
  onDownloadMultiple,
}: ClientBillingListProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | 'due_now' | 'upcoming' | 'paid' | 'no_payment_required'>('all');
  const [dateFilter, setDateFilter] = useState<InvoiceDateFilter>(DEFAULT_INVOICE_DATE_FILTER);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const filteredItems = useMemo(() => {
    const dateFiltered = filterInvoiceItemsByDate(
      items,
      dateFilter,
      (item) => item.issueDate || item.dueDate,
    );
    if (activeTab === 'all') return dateFiltered;
    return dateFiltered.filter((item) => item.bucket === activeTab);
  }, [activeTab, dateFilter, items]);

  const selectedItems = useMemo(
    () => filteredItems.filter((item) => selectedIds.has(item.id)),
    [filteredItems, selectedIds],
  );
  const exportItems = selectedItems.length > 0 ? selectedItems : filteredItems;
  const allFilteredSelected = filteredItems.length > 0 && selectedItems.length === filteredItems.length;
  const someFilteredSelected = selectedItems.length > 0 && !allFilteredSelected;

  useEffect(() => {
    const visibleIds = new Set(filteredItems.map((item) => item.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      if (next.size === current.size && [...next].every((id) => current.has(id))) return current;
      return next;
    });
  }, [filteredItems]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredItems.forEach((item) => next.delete(item.id));
      else filteredItems.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const handleExport = async (exportFormat: InvoiceExportFormat) => {
    const rows = exportItems.map((item) => ({
      reference: item.number || (item.shootId != null ? `Shoot ${item.shootId}` : item.id),
      source: getSourceLabel(item),
      property: item.property || '',
      status: getStatusLabel(item.status),
      amount: item.amount,
      paid: item.amountPaid,
      balance: item.balance,
      issueDate: formatDate(item.issueDate),
      dueDate: formatDate(item.dueDate),
    }));
    const columns = [
      { key: 'reference', label: 'Reference' },
      { key: 'source', label: 'Source' },
      { key: 'property', label: 'Property' },
      { key: 'status', label: 'Status' },
      { key: 'amount', label: 'Amount' },
      { key: 'paid', label: 'Paid' },
      { key: 'balance', label: 'Balance' },
      { key: 'issueDate', label: 'Issue Date' },
      { key: 'dueDate', label: 'Due Date' },
    ] as const;
    const fileName = `billing-${format(new Date(), 'yyyy-MM-dd')}`;
    setExporting(true);
    try {
      if (exportFormat === 'csv') exportRowsAsCsv(fileName, columns, rows);
      else if (exportFormat === 'excel') await exportRowsAsExcel(fileName, 'Billing', columns, rows);
      else await exportRowsAsPdf(fileName, 'Billing Report', columns, rows);
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unable to export these billing items.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = async (item: ClientBillingItem, downloadFormat: 'pdf' | 'csv') => {
    if (!onDownload) return;
    try {
      await onDownload(item, downloadFormat);
      toast({
        title: 'Billing file downloaded',
        description: `${item.number ? `Invoice #${item.number}` : item.sourceLabel} was downloaded as ${downloadFormat.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Unable to download this billing item.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkPdf = async () => {
    if (!onDownloadMultiple || selectedItems.length === 0) return;
    try {
      await onDownloadMultiple(selectedItems);
      toast({
        title: 'Billing statements downloaded',
        description: `${selectedItems.length} statements were combined into one PDF.`,
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Unable to download the selected billing statements.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="w-full">
      <Card className="mb-6">
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={activeTab}
            className="min-w-0 flex-1"
            onValueChange={(value) => setActiveTab(value as 'all' | 'due_now' | 'upcoming' | 'paid' | 'no_payment_required')}
          >
            <div className="overflow-x-auto pb-1 sm:pb-0">
              <TabsList className="inline-flex min-w-max">
                <TabsTrigger value="all" className="py-1 text-sm">All billing</TabsTrigger>
                <TabsTrigger value="due_now" className="py-1 text-sm">Due now</TabsTrigger>
                <TabsTrigger value="upcoming" className="py-1 text-sm">Upcoming</TabsTrigger>
                <TabsTrigger value="paid" className="py-1 text-sm">Paid</TabsTrigger>
                <TabsTrigger value="no_payment_required" className="py-1 text-sm">No payment required</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>

          <InvoiceDateFilterToolbar
            filter={dateFilter}
            onFilterChange={setDateFilter}
            resultCount={filteredItems.length}
            selectedCount={selectedItems.length}
            onClearSelection={() => setSelectedIds(new Set())}
            onExport={handleExport}
            onBulkPdf={onDownloadMultiple ? handleBulkPdf : undefined}
            bulkPdfLabel="Selected billing statements"
            resultNoun="billing item"
            className="rounded-none border-0 bg-transparent p-0 lg:w-auto lg:flex-none"
            exportDisabled={loading}
            exporting={exporting}
          />
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading billing data…</div>
        ) : isMobile ? (
          <div className="space-y-3 p-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelected(item.id)}
                      aria-label={`Select ${item.number ? `invoice ${item.number}` : `billing item ${item.id}`}`}
                      className="mt-1"
                    />
                    <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {getSourceLabel(item)}
                    </p>
                    <p className="text-base font-semibold">
                      {item.number ? `#${item.number}` : `Shoot #${item.shootId}`}
                    </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(item.status)}>{getStatusLabel(item.status)}</Badge>
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Property</p>
                    <p className="font-medium">{item.property || '—'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="font-semibold">{currencyFormatter.format(item.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Open balance</p>
                      <p className="font-semibold">{currencyFormatter.format(item.balance)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="font-medium">{formatDate(item.issueDate || item.dueDate)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{getBucketLabel(item.bucket)}</Badge>
                    {item.paymentRequiredToRelease && (
                      <Badge variant="destructive">Release blocked</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {/* An overdue balance needs a way to pay it; View alone was the
                      only action on this table. */}
                  {onPay && isPayable(item) && (
                    <Button
                      size="sm"
                      className="h-8 bg-red-600 px-3 text-xs text-white hover:bg-red-700"
                      onClick={() => onPay(item)}
                    >
                      <CreditCard className="mr-1 h-3.5 w-3.5" />
                      Pay {currencyFormatter.format(item.balance)}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => onView(item)}>
                    View
                  </Button>
                  {onDownload && (
                    <BillingDownloadMenu item={item} onDownload={handleDownload} />
                  )}
                </div>
              </div>
            ))}

            {!filteredItems.length && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No billing items found
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="w-10 px-3 py-2 text-left">
                    <Checkbox
                      checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleAllFiltered}
                      aria-label="Select all filtered billing items"
                    />
                  </th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-left">Property</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Balance</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b transition hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelected(item.id)}
                        aria-label={`Select ${item.number ? `invoice ${item.number}` : `billing item ${item.id}`}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-semibold">{getSourceLabel(item)}</p>
                          <p className="text-[11px] text-muted-foreground">{getBucketLabel(item.bucket)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-medium">
                      {item.number ? `#${item.number}` : `Shoot #${item.shootId}`}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        {item.paymentRequiredToRelease && (
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-500" />
                        )}
                        <div>
                          <p className="text-xs font-medium">{item.property || '—'}</p>
                          {item.paymentRequiredToRelease && (
                            <p className="text-[11px] text-rose-500">Payment required to release delivery</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(item.issueDate || item.dueDate)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold">
                      <div>{currencyFormatter.format(item.balance)}</div>
                      <div className="text-[11px] font-normal text-muted-foreground">
                        Total {currencyFormatter.format(item.amount)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getStatusColor(item.status)}>{getStatusLabel(item.status)}</Badge>
                        {item.paymentRequiredToRelease && (
                          <Badge variant="destructive">Release blocked</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {onPay && isPayable(item) && (
                          <Button
                            size="sm"
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={() => onPay(item)}
                          >
                            <CreditCard className="mr-1 h-3.5 w-3.5" />
                            Pay {currencyFormatter.format(item.balance)}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => onView(item)}>
                          View
                        </Button>
                        {onDownload && (
                          <BillingDownloadMenu item={item} onDownload={handleDownload} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredItems.length && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                      No billing items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function BillingDownloadMenu({
  item,
  onDownload,
}: {
  item: ClientBillingItem;
  onDownload: (item: ClientBillingItem, format: 'pdf' | 'csv') => void | Promise<void>;
}) {
  const reference = item.number ? `invoice ${item.number}` : `billing item ${item.id}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
          aria-label={`Download ${reference}`}
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Download</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void onDownload(item, 'pdf')}>
          PDF statement
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={item.invoiceId == null}
          onClick={() => void onDownload(item, 'csv')}
        >
          CSV detail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
