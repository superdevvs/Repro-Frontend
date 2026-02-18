
import React, { useEffect, useMemo, useState } from 'react';
import { 
  Calendar as CalendarIcon,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { InvoiceData } from '@/utils/invoiceUtils';
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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return format(parsed, 'MMM d, yyyy');
};

interface InvoiceListProps {
  data: {
    invoices: InvoiceData[];
  };
  onView: (invoice: InvoiceData) => void;
  onEdit: (invoice: InvoiceData) => void;
  onDownload: (invoice: InvoiceData) => void;
  onPay: (invoice: InvoiceData) => void;
  onSendReminder: (invoice: InvoiceData) => void;
  isAdmin?: boolean; // Prop to determine if user is admin
  isSuperAdmin?: boolean; // Prop to determine if user is super admin (for payment visibility)
  role?: string; // User role
}

export function InvoiceList({ 
  data, 
  onView, 
  onEdit, 
  onDownload, 
  onPay, 
  onSendReminder,
  isAdmin = false, // Default to false for safety
  isSuperAdmin = false, // Default to false for safety
  role = '' // Default to empty string
}: InvoiceListProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    return window.innerWidth < 768 ? 'grid' : 'list';
  });
  const [hasExplicitViewMode, setHasExplicitViewMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredInvoices = activeTab === 'all' 
    ? data.invoices 
    : data.invoices.filter(invoice => invoice.status === activeTab);

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
  }, [activeTab, viewMode]);

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

  const handleDownloadInvoice = (invoice: InvoiceData) => {
    toast({
      title: "Invoice downloaded",
      description: `Invoice #${invoice.number} has been downloaded.`
    });
    onDownload(invoice);
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
            <Tabs value={activeTab} className="min-w-0 flex-1 sm:w-auto" onValueChange={(value) => setActiveTab(value as any)}>
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

        <div>
          {viewMode === 'list' ? (
            isMobile ? (
              <div className="space-y-2 p-3">
                {paginatedInvoices.map((invoice) => {
                  const showMarkAsPaid = isSuperAdmin && (invoice.status === 'pending' || invoice.status === 'overdue');
                  return (
                    <div key={invoice.id} className="rounded-xl border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Invoice</p>
                          <p className="text-base font-semibold">#{invoice.number}</p>
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
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => handleViewInvoice(invoice)}>
                          View
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => handleDownloadInvoice(invoice)}>
                          Download
                        </Button>
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
                        <td className="px-3 py-2 font-medium text-xs">#{invoice.number}</td>
                        <td className="px-3 py-2 text-xs">{invoice.client || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${getStatusColor(invoice.status)}`}>{invoice.status}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">{usdCurrencyFormatter.format(invoice.amount || 0)}</td>
                        <td className="px-3 py-2 text-xs">{formatInvoiceDate(invoice.date)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleViewInvoice(invoice)} 
                              aria-label="View" 
                              className="px-3 py-1 text-xs"
                            >
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDownloadInvoice(invoice)} 
                              aria-label="Download" 
                              className="px-3 py-1 text-xs"
                            >
                              Download
                            </Button>
                            {isSuperAdmin && (invoice.status === "pending" || invoice.status === "overdue") && (
                              <Button
                                variant="accent"
                                size="sm"
                                onClick={() => onPay(invoice)}
                                className="!px-3 py-1 text-xs"
                                aria-label="Mark as Paid"
                              >
                                Mark Paid
                              </Button>
                            )}
                            {isAdmin && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleEditInvoice(invoice)} 
                                aria-label="Edit" 
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
                        <td colSpan={6} className="py-4 text-center text-muted-foreground text-sm">
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

interface InvoiceCardProps {
  invoice: InvoiceData;
  onView: (invoice: InvoiceData) => void;
  onDownload: (invoice: InvoiceData) => void;
  onSend: (invoice: InvoiceData) => void;
  onPrint: (invoice: InvoiceData) => void;
  onEdit: (invoice: InvoiceData) => void;
  onDelete: (invoice: InvoiceData) => void;
  getStatusColor: (status: string) => string;
  onPay: (invoice: InvoiceData) => void;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
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
}: InvoiceCardProps) {
  const showMarkAsPaid = isSuperAdmin && (invoice.status === 'pending' || invoice.status === 'overdue');
  const amountFormatted = usdCurrencyFormatter.format(invoice.amount || 0);

  const formattedIssue = formatInvoiceDate(invoice.date);
  const formattedDue = formatInvoiceDate(invoice.dueDate);

  return (
    <div className="relative flex h-full flex-col justify-between rounded-2xl border border-border bg-gradient-to-b from-background via-background to-muted/40 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Invoice</p>
          <h3 className="text-xl font-semibold text-foreground">#{invoice.number}</h3>
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
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Button variant="secondary" size="sm" onClick={() => onView(invoice)}>
          View
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDownload(invoice)}>
          Download
        </Button>
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
            <DropdownMenuItem onClick={() => onDownload(invoice)}>Download</DropdownMenuItem>
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
