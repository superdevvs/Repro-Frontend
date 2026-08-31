
import React, { useEffect, useMemo, useState } from 'react';
import { 
  Calendar as CalendarIcon,
  Download,
  MoreVertical,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { InvoiceData } from '@/utils/invoiceUtils';
import { InvoiceDateFilterToolbar, type InvoiceExportFormat } from '@/components/accounting/InvoiceDateFilterToolbar';
import {
  DEFAULT_INVOICE_DATE_FILTER,
  filterInvoiceItemsByDate,
  parseInvoiceDateInput,
  type InvoiceDateFilter,
} from '@/utils/invoiceDateFilters';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf } from '@/utils/accountingExports';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const usdCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatInvoiceDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = parseInvoiceDateInput(value);
  if (!parsed) return '—';
  return format(parsed, 'MMM d, yyyy');
};

const getInvoiceOverpayment = (invoice: InvoiceData): number => Math.max(
  Number(invoice.overpaymentAmount ?? invoice.overpayment_amount ?? ((invoice.amountPaid ?? 0) - invoice.amount)) || 0,
  0,
);

/**
 * Whether an invoice is worth chasing.
 *
 * Gating on `pending`/`overdue` alone missed the most common case: the backend
 * marks an issued invoice `sent`, and a part-paid one `partial`, so a reminder
 * was unreachable for exactly the invoices that need one. A settled, draft or
 * cancelled invoice is excluded instead, and a zero balance short-circuits it.
 */
// Exported for focused rule tests alongside the component.
// eslint-disable-next-line react-refresh/only-export-components
export const isChaseableInvoice = (invoice: Pick<InvoiceData, 'status' | 'balance' | 'amount'>): boolean => {
  const status = String(invoice.status || '').trim().toLowerCase();

  if (['paid', 'draft', 'cancelled', 'canceled', 'void', 'refunded'].includes(status)) {
    return false;
  }

  const balance = typeof invoice.balance === 'number' && Number.isFinite(invoice.balance)
    ? invoice.balance
    : invoice.amount;

  return typeof balance !== 'number' || !Number.isFinite(balance) || balance > 0.005;
};

interface InvoiceListProps {
  data: {
    invoices: InvoiceData[];
  };
  onView: (invoice: InvoiceData) => void;
  onEdit: (invoice: InvoiceData) => void;
  onDownload: (invoice: InvoiceData, format: 'pdf' | 'csv') => void | Promise<void>;
  onDownloadMultiple?: (invoices: InvoiceData[]) => void | Promise<void>;
  onPay: (invoice: InvoiceData) => void;
  onSendReminder: (invoice: InvoiceData) => void | Promise<void>;
  isAdmin?: boolean; // Prop to determine if user is admin
  isSuperAdmin?: boolean; // Prop to determine if user is super admin (for payment visibility)
  role?: string; // User role
  loading?: boolean;
}

export function InvoiceList({ 
  data, 
  onView, 
  onEdit, 
  onDownload, 
  onDownloadMultiple,
  onPay, 
  onSendReminder,
  isAdmin = false, // Default to false for safety
  isSuperAdmin = false, // Default to false for safety
  role = '', // Default to empty string
  loading = false,
}: InvoiceListProps) {
  /**
   * Who may chase a payment: admins, superadmins, sales reps and editing
   * managers. Photographers, editors and clients must not see this.
   */
  const normalizedRole = String(role || '').trim().toLowerCase();
  const canSendReminder =
    isAdmin ||
    isSuperAdmin ||
    ['salesrep', 'sales_rep', 'sales-rep', 'rep', 'editing_manager'].includes(normalizedRole);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    return window.innerWidth < 768 ? 'grid' : 'list';
  });
  const [hasExplicitViewMode, setHasExplicitViewMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<InvoiceDateFilter>(DEFAULT_INVOICE_DATE_FILTER);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const dateFilteredInvoices = useMemo(
    () => filterInvoiceItemsByDate(data.invoices, dateFilter, (invoice) => (
      invoice.billingPeriodStart || invoice.billingPeriodEnd
        ? {
            startDate: invoice.billingPeriodStart || invoice.billingPeriodEnd,
            endDate: invoice.billingPeriodEnd || invoice.billingPeriodStart,
          }
        : invoice.date
    )),
    [data.invoices, dateFilter],
  );
  const filteredInvoices = useMemo(
    () => {
      if (activeTab === 'all') return dateFilteredInvoices;
      if (activeTab === 'pending') {
        return dateFilteredInvoices.filter((invoice) => (
          ['pending', 'sent', 'partial', 'unpaid'].includes(String(invoice.status).toLowerCase())
        ));
      }
      return dateFilteredInvoices.filter((invoice) => invoice.status === activeTab);
    },
    [activeTab, dateFilteredInvoices],
  );

  const itemsPerPage = viewMode === 'list' ? 15 : 10;
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + itemsPerPage);

  const { showingFrom, showingTo } = useMemo(() => {
    if (filteredInvoices.length === 0) {
      return { showingFrom: 0, showingTo: 0 };
    }
    const start = startIndex + 1;
    const end = Math.min(startIndex + paginatedInvoices.length, filteredInvoices.length);
    return { showingFrom: start, showingTo: end };
  }, [filteredInvoices.length, paginatedInvoices.length, startIndex]);

  useEffect(() => {
    // Reset pagination whenever tab or view mode changes
    setCurrentPage(1);
  }, [activeTab, dateFilter, viewMode]);

  useEffect(() => {
    const visibleIds = new Set(filteredInvoices.map((invoice) => String(invoice.id)));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      if (next.size === current.size && [...next].every((id) => current.has(id))) return current;
      return next;
    });
  }, [filteredInvoices]);

  useEffect(() => {
    if (hasExplicitViewMode) return;
    setViewMode(isMobile ? 'grid' : 'list');
  }, [hasExplicitViewMode, isMobile]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleViewModeChange = (mode: 'list' | 'grid') => {
    setHasExplicitViewMode(true);
    setViewMode(mode);
  };

  const handleViewInvoice = (invoice: InvoiceData) => {
    onView(invoice);
  };

  const handleDownloadInvoice = async (invoice: InvoiceData, downloadFormat: 'pdf' | 'csv') => {
    try {
      await onDownload(invoice, downloadFormat);
      toast({
        title: 'Invoice downloaded',
        description: `Invoice #${invoice.number} was downloaded as ${downloadFormat.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Unable to download this invoice.',
        variant: 'destructive',
      });
    }
  };

  const toggleSelected = (invoiceId: string | number) => {
    const id = String(invoiceId);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedInvoices = useMemo(
    () => filteredInvoices.filter((invoice) => selectedIds.has(String(invoice.id))),
    [filteredInvoices, selectedIds],
  );
  const exportInvoices = selectedInvoices.length > 0 ? selectedInvoices : filteredInvoices;
  const currentPageIds = paginatedInvoices.map((invoice) => String(invoice.id));
  const selectedOnPage = currentPageIds.filter((id) => selectedIds.has(id)).length;
  const allOnPageSelected = currentPageIds.length > 0 && selectedOnPage === currentPageIds.length;
  const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected;

  const toggleCurrentPage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allOnPageSelected) currentPageIds.forEach((id) => next.delete(id));
      else currentPageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleExport = async (exportFormat: InvoiceExportFormat) => {
    const rows = exportInvoices.map((invoice) => {
      const normalizedInvoiceRole = String(invoice.role || '').toLowerCase().replace(/[\s_-]+/g, '');
      const isPayout = ['photographer', 'salesrep', 'salesrepresentative'].includes(normalizedInvoiceRole);
      const party = isPayout
        ? invoice.payee?.name || (normalizedInvoiceRole === 'salesrep' ? invoice.salesRep : invoice.photographer) || ''
        : invoice.client || '';

      return {
      invoice: invoice.number,
      type: isPayout ? (normalizedInvoiceRole === 'salesrep' ? 'Sales rep payout' : 'Photographer payout') : 'Client invoice',
      party,
      status: invoice.status,
      amount: Number(invoice.amount || 0),
      balance: Number(invoice.balance ?? invoice.amount ?? 0),
      issueDate: formatInvoiceDate(invoice.date),
      dueDate: formatInvoiceDate(invoice.dueDate),
      property: invoice.property || '',
      };
    });
    const columns = [
      { key: 'invoice', label: 'Invoice #' },
      { key: 'type', label: 'Invoice Type' },
      { key: 'party', label: 'Client / Payee' },
      { key: 'status', label: 'Status' },
      { key: 'amount', label: 'Amount' },
      { key: 'balance', label: 'Balance' },
      { key: 'issueDate', label: 'Issue Date' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'property', label: 'Property' },
    ] as const;
    const fileName = `invoices-${format(new Date(), 'yyyy-MM-dd')}`;

    setExporting(true);
    try {
      if (exportFormat === 'csv') exportRowsAsCsv(fileName, columns, rows);
      else if (exportFormat === 'excel') await exportRowsAsExcel(fileName, 'Invoices', columns, rows);
      else await exportRowsAsPdf(fileName, 'Invoice Report', columns, rows);
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unable to export these invoices.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleBulkPdf = async () => {
    if (!onDownloadMultiple || selectedInvoices.length === 0) return;
    try {
      await onDownloadMultiple(selectedInvoices);
      toast({
        title: 'Invoices downloaded',
        description: `${selectedInvoices.length} invoices were combined into one PDF.`,
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Unable to download the selected invoices.',
        variant: 'destructive',
      });
    }
  };

  const handleSendInvoice = (invoice: InvoiceData) => {
    if (!isAdmin) return;
    toast({
      title: "Invoice sent",
      description: `Invoice #${invoice.number} has been sent to ${invoice.client}.`
    });
  };

  const handlePrintInvoice = (invoice: InvoiceData) => {
    toast({
      title: "Printing invoice",
      description: `Invoice #${invoice.number} sent to printer.`
    });
  };

  const handleEditInvoice = (invoice: InvoiceData) => {
    if (!isAdmin) return;
    toast({
      title: "Edit invoice",
      description: `Edit mode for invoice #${invoice.number}.`
    });
    onEdit(invoice);
  };

  const handleDeleteInvoice = (invoice: InvoiceData) => {
    if (!isAdmin) return;
    toast({
      title: "Invoice deleted",
      description: `Invoice #${invoice.number} has been deleted.`,
      variant: "destructive"
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  return (
    <div className="w-full">
      <Card className="mb-6">
        <div className="border-b p-3">
          <div className="flex items-start gap-2 sm:items-center sm:justify-between">
            <Tabs
              value={activeTab}
              className="min-w-0 flex-1 sm:w-auto"
              onValueChange={(value) => setActiveTab(value as typeof activeTab)}
            >
              <div className="overflow-x-auto pb-1 sm:pb-0">
                <TabsList className="inline-flex min-w-max">
                  <TabsTrigger value="all" className="py-1 text-sm">All Invoices</TabsTrigger>
                  <TabsTrigger value="pending" className="py-1 text-sm">Pending</TabsTrigger>
                  <TabsTrigger value="paid" className="py-1 text-sm">Paid</TabsTrigger>
                  <TabsTrigger value="overdue" className="py-1 text-sm">Overdue</TabsTrigger>
                </TabsList>
              </div>
            </Tabs>

            <div className="flex items-center gap-1 text-xs">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 sm:hidden"
                    aria-label="View options"
                    title="View options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 sm:hidden">
                  <DropdownMenuLabel>View Mode</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleViewModeChange('list')}>
                    <span>List view</span>
                    {viewMode === 'list' && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleViewModeChange('grid')}>
                    <span>Grid view</span>
                    {viewMode === 'grid' && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="hidden sm:flex items-center gap-1">
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-label="List view"
                  className="h-8 px-2.5"
                  onClick={() => handleViewModeChange('list')}
                >
                  List
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-label="Grid view"
                  className="h-8 px-2.5"
                  onClick={() => handleViewModeChange('grid')}
                >
                  Grid
                </Button>
              </div>
            </div>
          </div>
        </div>

        <InvoiceDateFilterToolbar
          filter={dateFilter}
          onFilterChange={setDateFilter}
          resultCount={filteredInvoices.length}
          selectedCount={selectedInvoices.length}
          onClearSelection={() => setSelectedIds(new Set())}
          onExport={handleExport}
          onBulkPdf={onDownloadMultiple ? handleBulkPdf : undefined}
          resultNoun="invoice"
          className="rounded-none border-x-0 border-t-0"
          exportDisabled={loading}
          exporting={exporting}
        />

        <div>
          {viewMode === 'list' ? (
            isMobile ? (
              <div className="space-y-2 p-3">
                {paginatedInvoices.map((invoice) => {
                  const showMarkAsPaid = isSuperAdmin && (invoice.status === 'pending' || invoice.status === 'overdue');
                  const overpaymentAmount = getInvoiceOverpayment(invoice);
                  return (
                    <div key={invoice.id} className="rounded-xl border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-3">
                          <Checkbox
                            checked={selectedIds.has(String(invoice.id))}
                            onCheckedChange={() => toggleSelected(invoice.id)}
                            aria-label={`Select invoice ${invoice.number}`}
                            className="mt-1"
                          />
                          <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Invoice</p>
                          <p className="text-base font-semibold">#{invoice.number}</p>
                          </div>
                        </div>
                        <Badge className={`${getStatusColor(invoice.status)} capitalize`}>{invoice.status}</Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Client</p>
                          <p className="font-medium" title={invoice.client}>{invoice.client || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="font-semibold">{usdCurrencyFormatter.format(invoice.amount || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Date</p>
                          <p className="font-medium">{formatInvoiceDate(invoice.date)}</p>
                        </div>
                        {overpaymentAmount > 0 && (
                          <div className="col-span-2 rounded-md bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            <p className="text-xs">Refund/credit due</p>
                            <p className="font-semibold">{usdCurrencyFormatter.format(overpaymentAmount)}</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => handleViewInvoice(invoice)}>
                          View
                        </Button>
                        <InvoiceDownloadMenu invoice={invoice} onDownload={handleDownloadInvoice} />
                        {showMarkAsPaid && (
                          <Button
                            variant="accent"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => onPay(invoice)}
                          >
                            Mark Paid
                          </Button>
                        )}
                        {canSendReminder && isChaseableInvoice(invoice) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => onSendReminder(invoice)}
                            aria-label="Send payment reminder"
                          >
                            Send reminder
                          </Button>
                        )}
                        {isAdmin && (
                          <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => handleEditInvoice(invoice)}>
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {paginatedInvoices.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No invoices found
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
                          checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                          onCheckedChange={toggleCurrentPage}
                          aria-label="Select all invoices on this page"
                        />
                      </th>
                      <th className="px-3 py-2 text-left">Invoice #</th>
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b hover:bg-muted/30 transition">
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={selectedIds.has(String(invoice.id))}
                            onCheckedChange={() => toggleSelected(invoice.id)}
                            aria-label={`Select invoice ${invoice.number}`}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-xs">#{invoice.number}</td>
                        <td className="px-3 py-2 text-xs">{invoice.client || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${getStatusColor(invoice.status)}`}>{invoice.status}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div>{usdCurrencyFormatter.format(invoice.amount || 0)}</div>
                          {getInvoiceOverpayment(invoice) > 0 && (
                            <div className="mt-0.5 font-medium text-amber-700 dark:text-amber-300">
                              Refund/credit {usdCurrencyFormatter.format(getInvoiceOverpayment(invoice))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">{formatInvoiceDate(invoice.date)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleViewInvoice(invoice)} 
                              aria-label={`View invoice ${invoice.number}`}
                              className="px-3 py-1 text-xs"
                            >
                              View
                            </Button>
                            <InvoiceDownloadMenu invoice={invoice} onDownload={handleDownloadInvoice} />
                            {isSuperAdmin && (invoice.status === "pending" || invoice.status === "overdue") && (
                              <Button
                                variant="accent"
                                size="sm"
                                onClick={() => onPay(invoice)}
                                className="!px-3 py-1 text-xs"
                                aria-label={`Mark invoice ${invoice.number} as paid`}
                              >
                                Mark Paid
                              </Button>
                            )}
                            {/* An unsettled invoice needs a chase action. The
                                `onSendReminder` prop existed but was never bound
                                to anything, so this was unreachable. */}
                            {canSendReminder && isChaseableInvoice(invoice) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onSendReminder(invoice)}
                                className="px-3 py-1 text-xs"
                                aria-label={`Send payment reminder for invoice ${invoice.number}`}
                              >
                                Send reminder
                              </Button>
                            )}
                            {isAdmin && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleEditInvoice(invoice)} 
                                aria-label={`Edit invoice ${invoice.number}`}
                                className="px-3 py-1 text-xs"
                              >
                                Edit
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedInvoices.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-muted-foreground text-sm">
                          No invoices found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="p-4">
              {paginatedInvoices.length > 0 ? (
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {paginatedInvoices.map((invoice) => (
                    <InvoiceGridCard
                      key={invoice.id}
                      invoice={invoice}
                      onView={handleViewInvoice}
                      onDownload={handleDownloadInvoice}
                      selected={selectedIds.has(String(invoice.id))}
                      onSelectedChange={() => toggleSelected(invoice.id)}
                      onSend={handleSendInvoice}
                      onPrint={handlePrintInvoice}
                      onEdit={handleEditInvoice}
                      onDelete={handleDeleteInvoice}
                      getStatusColor={getStatusColor}
                      onPay={onPay}
                      isAdmin={isAdmin}
                      isSuperAdmin={isSuperAdmin}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No invoices found
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {filteredInvoices.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs sm:text-sm">
            Showing {showingFrom}-{showingTo} of {filteredInvoices.length} invoices
          </p>
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    className={safePage === 1 ? 'pointer-events-none opacity-40' : ''}
                    onClick={(event) => {
                      event.preventDefault();
                      handlePageChange(safePage - 1);
                    }}
                  />
                </PaginationItem>

                {generatePageNumbers(safePage, totalPages).map((item, index) => (
                  item === 'ellipsis' ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === safePage}
                        onClick={(event) => {
                          event.preventDefault();
                          handlePageChange(item as number);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  )
                ))}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    className={safePage === totalPages ? 'pointer-events-none opacity-40' : ''}
                    onClick={(event) => {
                      event.preventDefault();
                      handlePageChange(safePage + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  );
}

function InvoiceDownloadMenu({
  invoice,
  onDownload,
}: {
  invoice: InvoiceData;
  onDownload: (invoice: InvoiceData, format: 'pdf' | 'csv') => void | Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
          aria-label={`Download invoice ${invoice.number}`}
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Download invoice</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void onDownload(invoice, 'pdf')}>
          PDF invoice
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void onDownload(invoice, 'csv')}>
          CSV detail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface InvoiceCardProps {
  invoice: InvoiceData;
  onView: (invoice: InvoiceData) => void;
  onDownload: (invoice: InvoiceData, format: 'pdf' | 'csv') => void | Promise<void>;
  onSend: (invoice: InvoiceData) => void;
  onPrint: (invoice: InvoiceData) => void;
  onEdit: (invoice: InvoiceData) => void;
  onDelete: (invoice: InvoiceData) => void;
  getStatusColor: (status: string) => string;
  onPay: (invoice: InvoiceData) => void;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  selected: boolean;
  onSelectedChange: () => void;
}

function InvoiceGridCard({
  invoice,
  onView,
  onDownload,
  onSend,
  onPrint,
  onEdit,
  onDelete,
  getStatusColor,
  onPay,
  isAdmin = false,
  isSuperAdmin = false,
  selected,
  onSelectedChange,
}: InvoiceCardProps) {
  const showMarkAsPaid = isSuperAdmin && (invoice.status === 'pending' || invoice.status === 'overdue');
  const amountFormatted = usdCurrencyFormatter.format(invoice.amount || 0);
  const overpaymentAmount = getInvoiceOverpayment(invoice);

  const formattedIssue = formatInvoiceDate(invoice.date);
  const formattedDue = formatInvoiceDate(invoice.dueDate);

  return (
    <div className="relative flex h-full flex-col justify-between rounded-2xl border border-border bg-gradient-to-b from-background via-background to-muted/40 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={onSelectedChange}
            aria-label={`Select invoice ${invoice.number}`}
            className="mt-1"
          />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Invoice</p>
            <h3 className="text-xl font-semibold text-foreground">#{invoice.number}</h3>
          </div>
        </div>
        <Badge className={`${getStatusColor(invoice.status)} capitalize`}>{invoice.status}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Client</p>
          <p className="font-medium text-foreground" title={invoice.client}>{invoice.client}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="text-lg font-semibold text-foreground">{amountFormatted}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Issued</p>
          <p className="font-medium text-foreground flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5" /> {formattedIssue}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Due</p>
          <p className={`font-medium ${invoice.status === 'overdue' ? 'text-destructive' : 'text-foreground'}`}>{formattedDue}</p>
        </div>
        {invoice.property && (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Property</p>
            <p className="truncate text-sm text-foreground" title={invoice.property}>{invoice.property}</p>
          </div>
        )}
        {overpaymentAmount > 0 && (
          <div className="col-span-2 rounded-md bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <p className="text-xs">Refund/credit due</p>
            <p className="font-semibold">{usdCurrencyFormatter.format(overpaymentAmount)}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Button variant="secondary" size="sm" onClick={() => onView(invoice)}>
          View
        </Button>
        <InvoiceDownloadMenu invoice={invoice} onDownload={onDownload} />
        {showMarkAsPaid && (
          <Button variant="accent" size="sm" onClick={() => onPay(invoice)}>
            Mark Paid
          </Button>
        )}
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => onEdit(invoice)}>
            Edit
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="px-2">
              More
              <span className="sr-only">More invoice actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-sm">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onView(invoice)}>View</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(invoice, 'pdf')}>Download PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(invoice, 'csv')}>Download CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPrint(invoice)}>Print</DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuItem onClick={() => onSend(invoice)}>Send</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(invoice)} className="text-red-500">
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function generatePageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
  const pages: Array<number | 'ellipsis'> = [];

  for (let page = 1; page <= total; page++) {
    if (page === 1 || page === total || (page >= current - 1 && page <= current + 1)) {
      pages.push(page);
    } else if (page === 2 && current > 3) {
      pages.push('ellipsis');
    } else if (page === total - 1 && current < total - 2) {
      pages.push('ellipsis');
    }
  }

  // Remove consecutive ellipsis duplicates
  return pages.filter((item, index, arr) => item !== 'ellipsis' || arr[index - 1] !== 'ellipsis');
}
