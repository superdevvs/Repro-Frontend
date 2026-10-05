import { useQuery } from '@tanstack/react-query';
import { fetchInvoiceSummary, type FetchInvoicesParams } from '@/services/invoiceService';
import { getImpersonatedUserId } from '@/services/api';
import { usePageLoading } from '@/hooks/use-page-loading';

import React, { lazy, Suspense, useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AccountingHeader, type AccountingTab } from '@/components/accounting/AccountingHeader';
import { OverviewCards } from '@/components/accounting/OverviewCards';
import { AccountingDateRangeControl } from '@/components/accounting/AccountingDateRangeControl';
import { accountingRangeForPeriod, accountingRangeDays, type AccountingPeriod } from '@/components/accounting/accountingDateRange';
import { PhotographerEarningsOverview } from '@/components/accounting/PhotographerEarningsOverview';
import { InvoiceList } from '@/components/accounting/InvoiceList';
import { ClientBillingOverviewCards } from '@/components/accounting/ClientBillingOverviewCards';
import { ClientBillingSidePanel } from '@/components/accounting/ClientBillingSidePanel';
import { ClientBillingList } from '@/components/accounting/ClientBillingList';
import { PhotographerShootsTable } from '@/components/accounting/PhotographerShootsTable';
import { PaymentsSummary } from '@/components/accounting/PaymentsSummary';
import { ShootData } from '@/types/shoots';
import type { InvoicePaymentCompletePayload } from '@/components/invoices/PaymentDialog';
import type { InvoiceData } from '@/types/invoice';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermission } from '@/hooks/usePermission';
import { getAccountingMode, accountingConfigs } from '@/config/accountingConfig';
import { downloadInvoiceCsv, fetchInvoices, markInvoiceAsPaid, sendInvoicePaymentReminder } from '@/services/invoiceService';
import { registerInvoicesRefresh } from '@/realtime/realtimeRefreshBus';
import { useClientBilling } from '@/hooks/useClientBilling';
import {
  emptyClientBillingSummary,
  toClientBillingInvoiceViewData,
} from '@/services/clientBillingService';
import type { ClientBillingItem } from '@/types/clientBilling';
import { downloadInvoicePdf, downloadInvoicesPdf } from '@/utils/invoiceDownloads';
import { useShoots } from '@/context/shootsContextState';
import { WeeklyInvoiceReview } from '@/components/invoices/WeeklyInvoiceReview';
import type { DashboardShootSummary } from '@/types/dashboard';
import { shootDataToSummary } from '@/utils/dashboardDerivedUtils';
import { useSalesRepSummary } from '@/hooks/useSalesRepSummary';
import { cn } from '@/lib/utils';
import {
  isInvoiceInDaysWindow,
  toInvoiceViewDialogInvoice,
  type ViewableInvoice,
} from './accountingPageUtils';

const LazyRevenueCharts = lazy(() =>
  import('@/components/accounting/RevenueCharts').then((module) => ({ default: module.RevenueCharts })),
);
const LazyClientBillingCharts = lazy(() =>
  import('@/components/accounting/ClientBillingCharts').then((module) => ({ default: module.ClientBillingCharts })),
);
const LazyEditorRateSettings = lazy(() =>
  import('@/components/accounting/EditorRateSettings').then((module) => ({ default: module.EditorRateSettings })),
);
const LazyCreateInvoiceDialog = lazy(() =>
  import('@/components/invoices/CreateInvoiceDialog').then((module) => ({ default: module.CreateInvoiceDialog })),
);
const LazyInvoiceViewDialog = lazy(() =>
  import('@/components/invoices/InvoiceViewDialog').then((module) => ({ default: module.InvoiceViewDialog })),
);
const LazyPaymentDialog = lazy(() =>
  import('@/components/invoices/PaymentDialog').then((module) => ({ default: module.PaymentDialog })),
);
const LazyBatchInvoiceDialog = lazy(() =>
  import('@/components/accounting/BatchInvoiceDialog').then((module) => ({ default: module.BatchInvoiceDialog })),
);
const LazyEditInvoiceDialog = lazy(() =>
  import('@/components/invoices/EditInvoiceDialog').then((module) => ({ default: module.EditInvoiceDialog })),
);
const LazyPhotographerInvoiceReviewWorkspace = lazy(() =>
  import('@/components/accounting/PhotographerInvoiceReviewWorkspace').then((module) => ({
    default: module.PhotographerInvoiceReviewWorkspace,
  })),
);
const LazyPhotographerEquipmentWorkspace = lazy(() =>
  import('@/components/accounting/PhotographerEquipmentWorkspace').then((module) => ({
    default: module.PhotographerEquipmentWorkspace,
  })),
);
const LazySalesRepInvoiceReviewWorkspace = lazy(() =>
  import('@/components/accounting/SalesRepInvoiceReviewWorkspace').then((module) => ({
    default: module.SalesRepInvoiceReviewWorkspace,
  })),
);
const LazyEditorEarningsWorkspace = lazy(() =>
  import('@/components/accounting/EditorEarningsWorkspace').then((module) => ({
    default: module.EditorEarningsWorkspace,
  })),
);
const LazyEditingManagerVerificationView = lazy(() =>
  import('@/components/accounting/EditingManagerVerificationView').then((module) => ({
    default: module.EditingManagerVerificationView,
  })),
);
const LazySalesRepSummarySection = lazy(() =>
  import('@/components/accounting/sales/SalesRepSummarySection').then((module) => ({
    default: module.SalesRepSummarySection,
  })),
);
const LazyShootDetailsModalWrapper = lazy(() =>
  import('@/components/dashboard/v2/ShootDetailsModalWrapper').then((module) => ({
    default: module.ShootDetailsModalWrapper,
  })),
);

const AccountingPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { role, user } = useAuth(); // Use the correct AuthProvider
  const { can } = usePermission();
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<ViewableInvoice | null>(null);
  const [selectedPhotographerShoot, setSelectedPhotographerShoot] = useState<DashboardShootSummary | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountingTab>('home');
  const [daysWindow, setDaysWindow] = useState<number>(30);
  const { shoots: contextShoots, isInitialLoading: shootsLoading } = useShoots();
  const [reportingPeriod, setReportingPeriod] = useState<AccountingPeriod>('30');
  const [reportingRange, setReportingRange] = useState(() => accountingRangeForPeriod('30'));

  // Get accounting mode based on role
  const accountingMode = useMemo(() => getAccountingMode(role), [role]);
  const config = accountingConfigs[accountingMode];
  const {
    data: clientBillingData,
    loading: clientBillingLoading,
    error: clientBillingError,
  } = useClientBilling();

  usePageLoading(loading || shootsLoading || (accountingMode === 'client' && clientBillingLoading));

  const commitLoadedInvoices = useCallback((nextInvoices: InvoiceData[]) => {
    setInvoices(nextInvoices);
    // Keep an already-open invoice synchronized with realtime/background list
    // refreshes. Otherwise its row can show the new total while the dialog keeps
    // an older set of line items until it is closed and reopened.
    setSelectedInvoice((current) => {
      if (!current) return current;
      return nextInvoices.find((candidate) => String(candidate.id) === String(current.id)) ?? current;
    });
  }, []);

  const [invoiceParams, setInvoiceParams] = useState<FetchInvoicesParams>({ page: 1, per_page: 25, sort: 'date_desc' });
  const invoiceAccessScope = `${user?.id ?? ''}:${role}:${getImpersonatedUserId() ?? ''}`;
  const invoiceQuery = useQuery({
    queryKey: ['accounting-performance', invoiceAccessScope, 'list', invoiceParams],
    enabled: Boolean(user?.id) && accountingMode !== 'client' && accountingMode !== 'editor',
    queryFn: ({ signal }) => fetchInvoices(invoiceParams, signal), staleTime: 30_000, gcTime: 300_000,
  });
  const summaryParams = { status: invoiceParams.status, start: invoiceParams.start, end: invoiceParams.end };
  const invoiceSummaryQuery = useQuery({
    queryKey: ['accounting-performance', invoiceAccessScope, 'summary', summaryParams],
    enabled: Boolean(user?.id) && accountingMode === 'admin',
    queryFn: ({ signal }) => fetchInvoiceSummary(summaryParams, signal), staleTime: 30_000, gcTime: 300_000,
  });
  useEffect(() => { commitLoadedInvoices(invoiceQuery.data?.data ?? []); }, [invoiceQuery.data, commitLoadedInvoices, invoiceAccessScope]);
  useEffect(() => { setLoading(invoiceQuery.isLoading); }, [invoiceQuery.isLoading]);
  useEffect(() => {
    if (invoiceQuery.error) toast({ title: 'Unable to load invoices', description: invoiceQuery.error.message, variant: 'destructive' });
  }, [invoiceQuery.error, toast]);
  const { refetch: refetchInvoices } = invoiceQuery;
  const { refetch: refetchInvoiceSummary } = invoiceSummaryQuery;
  const loadInvoices = useCallback(async () => {
    if (accountingMode === 'client' || accountingMode === 'editor') return;
    await refetchInvoices();
    if (accountingMode === 'admin') await refetchInvoiceSummary();
  }, [accountingMode, refetchInvoices, refetchInvoiceSummary]);
  useEffect(() => registerInvoicesRefresh(loadInvoices), [loadInvoices]);
  const serverInvoices = {
    page: invoiceParams.page ?? 1, perPage: invoiceParams.per_page ?? 25,
    total: invoiceQuery.data?.total ?? 0, onChange: setInvoiceParams, params: invoiceParams,
  };

  // Filter invoices based on role (backend already filters, but this is a safety check)
  const filteredInvoices = useMemo(() => {
    // Backend already applies role-based filtering, but we do a client-side safety check
    if (accountingMode === 'admin' || accountingMode === 'rep') {
      return invoices; // Admin and rep see all (filtered by backend)
    }
    if (accountingMode === 'client') {
      return [];
    }
    if (accountingMode === 'photographer') {
      return invoices.filter(i => String(i.photographer_id ?? '') === String(user?.id ?? ''));
    }
    // For editor, invoices might not be the primary data
    return invoices;
  }, [invoices, accountingMode, user]);

  const selectedInvoiceForView = useMemo(
    () => (selectedInvoice ? toInvoiceViewDialogInvoice(selectedInvoice) : null),
    [selectedInvoice],
  );

  const clientBillingSummary = clientBillingData?.summary ?? emptyClientBillingSummary;
  const clientBillingItems = clientBillingData?.items ?? [];
  const salesRepSummary = useSalesRepSummary({
    startDate: reportingRange.startDate,
    endDate: reportingRange.endDate,
    enabled: accountingMode === 'rep',
  });

  useEffect(() => {
    if (!clientBillingError || accountingMode !== 'client') {
      return;
    }

    toast({
      title: 'Failed to load billing',
      description: clientBillingError,
      variant: 'destructive',
    });
  }, [accountingMode, clientBillingError, toast]);

  const adminWindowInvoices = useMemo(() => {
    if (accountingMode !== 'admin') {
      return filteredInvoices;
    }

    return (invoiceSummaryQuery.data ?? []).filter((invoice) => isInvoiceInDaysWindow(invoice, daysWindow));
  }, [filteredInvoices, accountingMode, daysWindow, invoiceSummaryQuery.data]);

  // Fetch shoots and editing jobs based on role
  // TODO: Replace with actual API calls
  // Example for photographer:
  // const shoots = useShootsForPhotographer(user?.id);
  // Example for editor:
  // const editingJobs = useEditingJobsForEditor(user?.id);
  const shoots = useMemo(() => {
    if (accountingMode === 'photographer' || accountingMode === 'editor' || accountingMode === 'rep') {
      return contextShoots;
    }
    return [] as ShootData[];
  }, [accountingMode, contextShoots]);

  // Use permission system to check if user has admin capabilities
  const canCreateInvoice = can('invoices', 'create');
  const canEditInvoice = can('invoices', 'update');
  const canMarkAsPaid = can('payments', 'mark-paid');
  const isAdmin = ['admin', 'superadmin'].includes(role || '');
  const isSuperAdmin = role === 'superadmin'; // Only Super Admin can see payment status
  const isEditingManagerAccounting = role === 'editing_manager';

  const handleDownloadInvoice = async (invoice: InvoiceData, format: 'pdf' | 'csv') => {
    if (format === 'csv') {
      await downloadInvoiceCsv(invoice.id);
      return;
    }
    await downloadInvoicePdf(invoice);
  };

  const handleDownloadInvoices = async (selectedInvoices: InvoiceData[]) => {
    await downloadInvoicesPdf(selectedInvoices);
  };

  const handleDownloadClientBillingItem = async (
    item: ClientBillingItem,
    format: 'pdf' | 'csv',
  ) => {
    if (format === 'csv') {
      if (item.invoiceId == null) {
        throw new Error('CSV detail is available only for issued invoices.');
      }
      await downloadInvoiceCsv(item.invoiceId);
      return;
    }
    await downloadInvoicePdf(toClientBillingInvoiceViewData(item));
  };

  const handleDownloadClientBillingItems = async (items: ClientBillingItem[]) => {
    await downloadInvoicesPdf(items.map(toClientBillingInvoiceViewData), {
      fileName: 'billing-statements.pdf',
    });
  };

  const handleViewInvoice = (invoice: InvoiceData) => {
    setSelectedInvoice(invoice);
    setViewDialogOpen(true);
  };

  const handleViewClientBillingItem = (item: ClientBillingItem) => {
    setSelectedInvoice(toClientBillingInvoiceViewData(item));
    setViewDialogOpen(true);
  };

  /**
   * Take the client to payment for a billing row.
   *
   * Routes to the shoot, which already owns the client payment flow (balance,
   * partial amounts, Stripe checkout), rather than introducing a second
   * checkout implementation on this page.
   */
  const handlePayClientBillingItem = (item: ClientBillingItem) => {
    if (item.shootId) {
      navigate(`/shoots/${item.shootId}`);
      return;
    }

    toast({
      title: 'Payment unavailable here',
      description: 'This billing item is not linked to a shoot. Please contact support to pay it.',
      variant: 'destructive',
    });
  };

  const handleViewPhotographerShoot = (shoot: ShootData) => {
    setSelectedPhotographerShoot(shootDataToSummary(shoot));
  };

  const handlePayInvoice = (invoice: InvoiceData) => {
    if (!canMarkAsPaid) return; // Use permission check
    setSelectedInvoice(invoice);
    setPaymentDialogOpen(true);
  };

  const handleEditInvoice = (invoice: InvoiceData) => {
    if (!canEditInvoice) return; // Use permission check
    setSelectedInvoice(invoice);
    setEditDialogOpen(true);
  };

  const closeViewDialog = () => {
    setViewDialogOpen(false);
  };

  const closePaymentDialog = () => {
    setPaymentDialogOpen(false);
  };

  const handlePaymentComplete = async (payload: InvoicePaymentCompletePayload) => {
    const { invoiceId, paymentMethod, paymentDetails, paymentDate, amount } = payload;
    try {
      const markPaidPayload = {
        ...(amount !== undefined ? { amount_paid: amount } : {}),
        ...(paymentDate ? { paid_at: paymentDate } : {}),
        payment_method: paymentMethod,
        payment_details: paymentDetails ?? null,
      };
      const updatedInvoice = await markInvoiceAsPaid(invoiceId, markPaidPayload);
      const normalizedInvoice: InvoiceData = {
        ...updatedInvoice,
        paymentMethod: updatedInvoice.paymentMethod || paymentMethod,
        paymentDetails: updatedInvoice.paymentDetails ?? paymentDetails ?? undefined,
        paidAt: updatedInvoice.paidAt || paymentDate || updatedInvoice.paidAt,
      };
      
      setInvoices(currentInvoices =>
        currentInvoices.map(invoice =>
          invoice.id === invoiceId
            ? {
              ...normalizedInvoice,
            }
            : invoice
        )
      );
      if (selectedInvoice && String(selectedInvoice.id) === String(invoiceId)) {
        setSelectedInvoice(normalizedInvoice);
      }

      toast({
        title: "Payment Successful",
        description: `Invoice ${invoiceId} has been marked as paid.`,
        variant: "default",
      });
      setPaymentDialogOpen(false);
      void loadInvoices();
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error);
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : 'Failed to mark invoice as paid',
        variant: "destructive",
      });
    }
  };

  const handleCreateInvoice = (newInvoice: InvoiceData) => {
    setInvoices(prevInvoices => [newInvoice, ...prevInvoices]);
    toast({
      title: "Invoice Created",
      description: `Invoice ${newInvoice.id} has been created successfully.`,
      variant: "default",
    });
  };

  const handleCreateBatchInvoices = (newInvoices: InvoiceData[]) => {
    setInvoices(prevInvoices => [...newInvoices, ...prevInvoices]);
    toast({
      title: "Batch Invoices Created",
      description: `${newInvoices.length} invoices have been created successfully.`,
      variant: "default",
    });
  };

  const [reminderInvoiceId, setReminderInvoiceId] = useState<string | number | null>(null);

  /**
   * Send a payment reminder for real.
   *
   * This used to raise a success toast without calling anything, so a chased
   * client never received the reminder the operator believed they had sent.
   */
  const handleSendReminder = async (invoice: InvoiceData) => {
    setReminderInvoiceId(invoice.id);
    try {
      const result = await sendInvoicePaymentReminder(invoice.id, {
        asSalesRep: accountingMode === 'rep',
      });
      toast({
        title: 'Reminder sent',
        description: result.message || `Payment reminder sent to ${invoice.client}.`,
      });
    } catch (error) {
      toast({
        title: 'Reminder not sent',
        description: error instanceof Error ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setReminderInvoiceId(null);
    }
  };

  const handleInvoiceEdit = (updatedInvoice: InvoiceData) => {
    setInvoices(prev =>
      prev.map(inv =>
        inv.id === updatedInvoice.id ? { ...inv, ...updatedInvoice } : inv
      )
    );
    setEditDialogOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="accounting-page min-w-0 space-y-5 px-3 pb-5 pt-2 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-0">
          {(() => {
            const adminTabTitles: Record<AccountingTab, { title: string; description: string }> = {
              home: {
                title: config.pageTitle,
                description: 'Manage your finances, invoices, and payments',
              },
              photographers: {
                title: 'Photographer Accounting',
                description: 'Review weekly photographer invoices, payout totals, exports, and reports.',
              },
              editors: {
                title: 'Editor Accounting',
                description: 'Track snapshot-based editor earnings, payout batches, exports, and reports.',
              },
              equipments: {
                title: 'Photographer Equipments',
                description: 'Manage assigned equipment, verification status, and reminder emails.',
              },
              'sales-reps': {
                title: 'Sales Rep Accounting',
                description: 'Review commission invoices, payout totals, exports, and weekly reports.',
              },
            };

            const activeAdminCopy = adminTabTitles[activeTab];

            return (
          <AccountingHeader
            onCreateInvoice={() => canCreateInvoice && setCreateDialogOpen(true)}
            onCreateBatch={() => canCreateInvoice && setBatchDialogOpen(true)}
            title={isEditingManagerAccounting ? 'Editing Accounting' : accountingMode === 'admin' ? activeAdminCopy.title : config.pageTitle}
            description={
              isEditingManagerAccounting ? 'Verify editor work against linked invoices' :
              accountingMode === 'admin' ? activeAdminCopy.description :
              accountingMode === 'photographer' ? 'View your earnings and payout status' :
              accountingMode === 'editor' ? 'Track your editing jobs and pay' :
              accountingMode === 'client' ? 'View your invoices and payment history' :
              accountingMode === 'rep' ? 'Revenue, clients, and commissions in one place.' :
              'Manage your finances, invoices, and payments'
            }
            badge={config.sidebarLabel}
            showCreateButton={!isEditingManagerAccounting && canCreateInvoice && accountingMode === 'admin' && activeTab === 'home'}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            showTabs={!isEditingManagerAccounting && accountingMode === 'admin'}
            daysWindow={isEditingManagerAccounting ? undefined : daysWindow}
            onDaysWindowChange={isEditingManagerAccounting ? undefined : setDaysWindow}
            reportingControl={!isEditingManagerAccounting && accountingMode !== 'admin' ? <AccountingDateRangeControl value={reportingRange} period={reportingPeriod} label={accountingMode === 'client' ? 'Paid reporting period' : 'Reporting period'} onChange={(range, period) => { setReportingRange(range); setReportingPeriod(period); }} /> : undefined}
            payoutActions={null}
          />
            );
          })()}

          {isEditingManagerAccounting ? (
            <Suspense fallback={null}>
              <LazyEditingManagerVerificationView
                shoots={contextShoots}
                invoices={filteredInvoices}
                loading={loading}
                onViewInvoice={handleViewInvoice}
              />
            </Suspense>
          ) : (
            <>
              {/* Home Tab Content */}
              {(activeTab === 'home' || accountingMode !== 'admin') && (
                accountingMode === 'rep' ? (
                  <div className="min-w-0 space-y-5">
                    <nav aria-label="Sales page sections" className="flex gap-1 overflow-x-auto border-b pb-2 text-xs text-muted-foreground">{[['sales-overview', 'Overview'], ['sales-clients', 'Clients'], ['weekly-review', 'Reviews'], ['invoice-activity', 'Invoices']].map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-md px-3 py-2 hover:bg-muted hover:text-foreground">{label}</a>)}</nav>
                    <Suspense fallback={null}>
                      <LazySalesRepSummarySection
                        data={salesRepSummary.data}
                        loading={salesRepSummary.loading}
                        error={salesRepSummary.error}
                        daysWindow={accountingRangeDays(reportingRange)}
                        onRetry={salesRepSummary.refresh}
                      />
                    </Suspense>

                    <section id="weekly-review" className="min-w-0 scroll-mt-6 space-y-3">
                      <h2 className="text-base font-semibold tracking-tight">Commission reviews</h2>
                      <WeeklyInvoiceReview />
                    </section>

                    {config.showInvoiceTable && (
                      <section id="invoice-activity" className="min-w-0 scroll-mt-6 space-y-3">
                        <h2 className="text-base font-semibold tracking-tight">Client invoices</h2>
                        <InvoiceList
                          server={serverInvoices}
                          data={{ invoices: filteredInvoices }}
                          onView={handleViewInvoice}
                          onEdit={handleEditInvoice}
                          onDownload={handleDownloadInvoice}
                          onDownloadMultiple={handleDownloadInvoices}
                          onPay={handlePayInvoice}
                          onSendReminder={handleSendReminder}
                          isAdmin={isAdmin}
                          isSuperAdmin={isSuperAdmin}
                          role={role || ''}
                          loading={loading}
                        />
                      </section>
                    )}
                  </div>
                ) : (
                  <>
                    {accountingMode === 'photographer' && <PhotographerEarningsOverview shoots={shoots} dateRange={reportingRange} />}
                    {accountingMode === 'editor' && <>
                      <Suspense fallback={null}><LazyEditorEarningsWorkspace mode="self" startDate={reportingRange.startDate} endDate={reportingRange.endDate} /></Suspense>
                      <Suspense fallback={null}><LazyEditorRateSettings className="min-h-0 max-h-[min(72vh,38rem)]" /></Suspense>
                    </>}
                    {accountingMode === 'admin' && invoiceSummaryQuery.isLoading && <p role="status">Loading financial summary…</p>}
                    {accountingMode === 'admin' && invoiceSummaryQuery.isError && <p role="alert">Financial summary could not load. <button onClick={() => void invoiceSummaryQuery.refetch()}>Retry</button></p>}
                    {config.showOverviewCards && accountingMode === 'admin' && invoiceSummaryQuery.data && <OverviewCards invoices={adminWindowInvoices} timeFilter={timeFilter} daysWindow={daysWindow} />}
                    {accountingMode === 'client' && <>
                      {config.showOverviewCards && <ClientBillingOverviewCards summary={clientBillingSummary} items={clientBillingItems} daysWindow={daysWindow} paidDateRange={reportingRange} />}
                      {config.showInvoiceTable && <ClientBillingList items={clientBillingItems} loading={clientBillingLoading} onView={handleViewClientBillingItem} onPay={handlePayClientBillingItem} onDownload={handleDownloadClientBillingItem} onDownloadMultiple={handleDownloadClientBillingItems} />}
                    </>}
                    {config.showRevenueChart && ((accountingMode === 'admin' && Boolean(invoiceSummaryQuery.data)) || accountingMode === 'client') && (
                      <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
                        <div className="min-w-0 lg:col-span-2"><Suspense fallback={null}>
                          {accountingMode === 'admin' ? <LazyRevenueCharts invoices={adminWindowInvoices} timeFilter={timeFilter} onTimeFilterChange={setTimeFilter} role={role} /> : <LazyClientBillingCharts items={clientBillingItems} timeFilter={timeFilter} onTimeFilterChange={setTimeFilter} />}
                        </Suspense></div>
                        {(config.showPaymentsSummary || config.showLatestTransactions) && <div className={cn('flex min-h-0 min-w-0 flex-col gap-3 lg:col-span-1', accountingMode === 'admin' && 'lg:h-[max(54.875rem,calc(100vh-11.125rem))] lg:max-h-[max(54.875rem,calc(100vh-11.125rem))]')}>
                          {accountingMode === 'admin' ? <PaymentsSummary invoices={adminWindowInvoices} className="min-h-0" /> : <ClientBillingSidePanel items={clientBillingItems} summary={clientBillingSummary} onView={handleViewClientBillingItem} />}
                        </div>}
                      </div>
                    )}

                    {/* Weekly Invoice Review for Photographers */}
                    {accountingMode === 'photographer' && <section className="min-w-0 space-y-3"><h2 className="text-base font-semibold">Weekly invoice reviews</h2><WeeklyInvoiceReview /></section>}

                    {/* For non-client: show invoice table in original position (after charts) */}
                    {accountingMode !== 'client' && config.showInvoiceTable && (
                      <>
                        {accountingMode === 'photographer' ? (
                          <PhotographerShootsTable
                            shoots={shoots}
                            onViewShoot={handleViewPhotographerShoot}
                          />
                        ) : (
                          accountingMode === 'editor' ? null : (
                            <InvoiceList
                          server={serverInvoices}
                              data={{ invoices: filteredInvoices }}
                              onView={handleViewInvoice}
                              onEdit={handleEditInvoice}
                              onDownload={handleDownloadInvoice}
                              onDownloadMultiple={handleDownloadInvoices}
                              onPay={handlePayInvoice}
                              onSendReminder={handleSendReminder}
                              isAdmin={isAdmin}
                              isSuperAdmin={isSuperAdmin}
                              role={role || ''}
                              loading={loading}
                            />
                          )
                        )}
                      </>
                    )}
                  </>
                )
              )}

              {/* Photographers Tab Content */}
              {activeTab === 'photographers' && accountingMode === 'admin' && (
                <div className="flex flex-col gap-4 sm:gap-6">
                  <Suspense fallback={null}>
                    <LazyPhotographerInvoiceReviewWorkspace />
                  </Suspense>
                </div>
              )}

              {activeTab === 'editors' && accountingMode === 'admin' && (
                <div className="flex flex-col gap-4 sm:gap-6">
                  <Suspense fallback={null}>
                    <LazyEditorEarningsWorkspace mode="admin" />
                  </Suspense>
                </div>
              )}

              {activeTab === 'equipments' && accountingMode === 'admin' && (
                <div className="flex flex-col gap-4 sm:gap-6">
                  <Suspense fallback={null}>
                    <LazyPhotographerEquipmentWorkspace />
                  </Suspense>
                </div>
              )}

              {activeTab === 'sales-reps' && accountingMode === 'admin' && (
                <div className="flex flex-col gap-4 sm:gap-6">
                  <Suspense fallback={null}>
                    <LazySalesRepInvoiceReviewWorkspace />
                  </Suspense>
                </div>
              )}
            </>
          )}
        </div>

      {viewDialogOpen && selectedInvoiceForView && (
        <Suspense fallback={null}>
          <LazyInvoiceViewDialog
            isOpen={viewDialogOpen}
            onClose={closeViewDialog}
            invoice={selectedInvoiceForView}
          />
        </Suspense>
      )}

      {!isEditingManagerAccounting && paymentDialogOpen && selectedInvoice && canMarkAsPaid && (
        <Suspense fallback={null}>
          <LazyPaymentDialog
            isOpen={paymentDialogOpen}
            onClose={closePaymentDialog}
            invoice={selectedInvoice as InvoiceData}
            onPaymentComplete={handlePaymentComplete}
          />
        </Suspense>
      )}

      {!isEditingManagerAccounting && canCreateInvoice && (
        createDialogOpen && (
          <Suspense fallback={null}>
            <LazyCreateInvoiceDialog
              isOpen={createDialogOpen}
              onClose={() => setCreateDialogOpen(false)}
              onInvoiceCreate={handleCreateInvoice}
            />
          </Suspense>
        )
      )}

      {!isEditingManagerAccounting && canCreateInvoice && (
        batchDialogOpen && (
          <Suspense fallback={null}>
            <LazyBatchInvoiceDialog
              isOpen={batchDialogOpen}
              onClose={() => setBatchDialogOpen(false)}
              onCreateBatch={handleCreateBatchInvoices}
            />
          </Suspense>
        )
      )}

      {!isEditingManagerAccounting && selectedInvoice && canEditInvoice && (
        editDialogOpen && (
          <Suspense fallback={null}>
            <LazyEditInvoiceDialog
              isOpen={editDialogOpen}
              onClose={() => setEditDialogOpen(false)}
              invoice={selectedInvoice as InvoiceData}
              onInvoiceEdit={handleInvoiceEdit}
            />
          </Suspense>
        )
      )}

      {selectedPhotographerShoot && (
        <Suspense fallback={null}>
          <LazyShootDetailsModalWrapper
            shoot={selectedPhotographerShoot}
            onClose={() => setSelectedPhotographerShoot(null)}
          />
        </Suspense>
      )}
    </DashboardLayout>
  );
};

export default AccountingPage;


