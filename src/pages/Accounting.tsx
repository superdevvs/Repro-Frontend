
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AccountingHeader, type AccountingTab } from '@/components/accounting/AccountingHeader';
import { OverviewCards } from '@/components/accounting/OverviewCards';
import { RoleBasedOverviewCards } from '@/components/accounting/RoleBasedOverviewCards';
import { RevenueCharts } from '@/components/accounting/RevenueCharts';
import { RoleBasedCharts } from '@/components/accounting/RoleBasedCharts';
import { InvoiceList } from '@/components/accounting/InvoiceList';
import { ClientBillingOverviewCards } from '@/components/accounting/ClientBillingOverviewCards';
import { ClientBillingCharts } from '@/components/accounting/ClientBillingCharts';
import { ClientBillingSidePanel } from '@/components/accounting/ClientBillingSidePanel';
import { ClientBillingList } from '@/components/accounting/ClientBillingList';
import { PhotographerShootsTable } from '@/components/accounting/PhotographerShootsTable';
import { EditorJob } from '@/components/accounting/EditorJobsTable';
import { PaymentsSummary } from '@/components/accounting/PaymentsSummary';
import { RoleBasedSidePanel } from '@/components/accounting/RoleBasedSidePanel';
import { EditorRateSettings } from '@/components/accounting/EditorRateSettings';
import { ShootData } from '@/types/shoots';
import { UpcomingPayments } from '@/components/accounting/UpcomingPayments';
import { CreateInvoiceDialog } from '@/components/invoices/CreateInvoiceDialog';
import { InvoiceViewDialog } from '@/components/invoices/InvoiceViewDialog';
import { PaymentDialog, type InvoicePaymentCompletePayload } from '@/components/invoices/PaymentDialog';
import { BatchInvoiceDialog } from '@/components/accounting/BatchInvoiceDialog';
import { InvoiceData } from '@/utils/invoiceUtils';
import { useToast } from '@/hooks/use-toast';
import { EditInvoiceDialog } from '@/components/invoices/EditInvoiceDialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermission } from '@/hooks/usePermission';
import { getAccountingMode, accountingConfigs } from '@/config/accountingConfig';
import { fetchInvoices, markInvoiceAsPaid } from '@/services/invoiceService';
import { registerInvoicesRefresh } from '@/realtime/realtimeRefreshBus';
import { useClientBilling } from '@/hooks/useClientBilling';
import { useEditorRates } from '@/hooks/useEditorRates';
import {
  emptyClientBillingSummary,
  toClientBillingInvoiceViewData,
  type ClientBillingInvoiceViewData,
} from '@/services/clientBillingService';
import type { ClientBillingItem } from '@/types/clientBilling';
import { useShoots } from '@/context/ShootsContext';
import { WeeklyInvoiceReview } from '@/components/invoices/WeeklyInvoiceReview';
import { PhotographerInvoiceReviewWorkspace } from '@/components/accounting/PhotographerInvoiceReviewWorkspace';
import { SalesRepInvoiceReviewWorkspace } from '@/components/accounting/SalesRepInvoiceReviewWorkspace';
import { EditorEarningsWorkspace } from '@/components/accounting/EditorEarningsWorkspace';
import { EditingManagerVerificationView } from '@/components/accounting/EditingManagerVerificationView';
import { SalesRepSummarySection } from '@/components/accounting/sales/SalesRepSummarySection';
import { ShootDetailsModalWrapper } from '@/components/dashboard/v2/ShootDetailsModalWrapper';
import type { DashboardShootSummary } from '@/types/dashboard';
import { shootDataToSummary } from '@/utils/dashboardDerivedUtils';
import { useServices } from '@/hooks/useServices';
import { useSalesRepSummary } from '@/hooks/useSalesRepSummary';
import {
  extractPhotoCountFromServiceName,
  findMatchingEditorRate,
  getEditorServiceId,
  getEditorServiceName,
  getEditorServiceQuantity,
  getExplicitEditorPhotoCount,
  isPhotoServiceName,
  normalizeEditorServiceName,
} from '@/utils/editorRates';

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const parseAccountingInvoiceDate = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatAccountingApiDate = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const buildSalesRepSummaryWindow = (daysWindow: number) => {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (daysWindow - 1));

  return {
    startDate: formatAccountingApiDate(startDate),
    endDate: formatAccountingApiDate(endDate),
  };
};

const getInvoiceWindowDate = (invoice: InvoiceData) => {
  const legacyInvoice = invoice as InvoiceData & Record<string, unknown>;
  const candidates =
    invoice.status === 'paid'
      ? [
          invoice.paidAt,
          legacyInvoice.paid_at,
          legacyInvoice.updated_at,
          legacyInvoice.updatedAt,
          invoice.issueDate,
          invoice.date,
          invoice.createdAt,
          legacyInvoice.created_at,
        ]
      : [
          invoice.dueDate,
          invoice.issueDate,
          invoice.date,
          invoice.createdAt,
          legacyInvoice.created_at,
        ];

  for (const candidate of candidates) {
    const parsed = parseAccountingInvoiceDate(candidate);
    if (parsed) return parsed;
  }

  return null;
};

const isInvoiceInDaysWindow = (invoice: InvoiceData, daysWindow: number) => {
  const invoiceDate = getInvoiceWindowDate(invoice);
  if (!invoiceDate) return true;

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (daysWindow - 1));

  return invoiceDate >= start && invoiceDate <= end;
};

type ViewableInvoice = InvoiceData | ClientBillingInvoiceViewData;
type InvoiceViewDialogInvoice = React.ComponentProps<typeof InvoiceViewDialog>['invoice'];
type ShootWithLegacyEditorFields = ShootData & {
  editor_id?: string | number | null;
  editorId?: string | number | null;
};

const toInvoiceViewDialogInvoice = (invoice: ViewableInvoice): InvoiceViewDialogInvoice => {
  if (!('amountPaid' in invoice)) {
    return invoice;
  }

  const mapShoot = (shoot: ClientBillingInvoiceViewData['shoot']) =>
    shoot
      ? {
          id: shoot.id,
          client_id: shoot.client_id ?? undefined,
          photographer_id: shoot.photographer_id ?? undefined,
          address: shoot.address ?? undefined,
          city: shoot.city ?? undefined,
          state: shoot.state ?? undefined,
          zip: shoot.zip ?? undefined,
          location: shoot.location
            ? {
                address: shoot.location.address ?? undefined,
                city: shoot.location.city ?? undefined,
                state: shoot.location.state ?? undefined,
                zip: shoot.location.zip ?? undefined,
                fullAddress: shoot.location.fullAddress ?? undefined,
              }
            : null,
          client: shoot.client
            ? {
                id: shoot.client.id,
                name: shoot.client.name,
                email: shoot.client.email,
              }
            : null,
          photographer: shoot.photographer
            ? {
                id: shoot.photographer.id,
                name: shoot.photographer.name,
              }
            : null,
        }
      : null;

  return {
    ...invoice,
    items: invoice.items?.map((item) => ({
      ...item,
      meta: item.meta ? { ...item.meta } : null,
    })),
    shoot: mapShoot(invoice.shoot),
    shoots: invoice.shoots?.map(mapShoot).filter(Boolean) as InvoiceViewDialogInvoice['shoots'],
  };
};

const AccountingPage = () => {
  const { toast } = useToast();
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
  const { shoots: contextShoots } = useShoots();
  const { data: services = [] } = useServices();

  // Get accounting mode based on role
  const accountingMode = useMemo(() => getAccountingMode(role), [role]);
  const config = accountingConfigs[accountingMode];
  const {
    data: clientBillingData,
    loading: clientBillingLoading,
    error: clientBillingError,
  } = useClientBilling();

  const loadInvoices = useCallback(async (): Promise<void> => {
    if (accountingMode === 'client' || accountingMode === 'editor') {
      setInvoices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch first page only for fast initial load
      const response = await fetchInvoices({
        page: 1,
        per_page: 100,
      });
      
      const firstPageData = response.data;
      const lastPage = response.last_page || 1;
      
      // If there are more pages, fetch them in parallel (background)
      if (lastPage > 1) {
        setInvoices(firstPageData); // Show first page immediately
        
        // Fetch remaining pages in parallel
        const pagePromises = [];
        for (let page = 2; page <= lastPage; page++) {
          pagePromises.push(fetchInvoices({ page, per_page: 100 }));
        }
        
        const remainingResponses = await Promise.all(pagePromises);
        const allData = [
          ...firstPageData,
          ...remainingResponses.flatMap(r => r.data)
        ];
        setInvoices(allData);
      } else {
        setInvoices(firstPageData);
      }
    } catch (error) {
      console.error('Failed to load invoices:', error);
      toast({
        title: 'Failed to load invoices',
        description: error instanceof Error ? error.message : 'An error occurred while loading invoices',
        variant: 'destructive',
      });
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [accountingMode, toast]);

  // Fetch invoices from API
  useEffect(() => {
    if (accountingMode === 'client' || accountingMode === 'editor') {
      setLoading(false);
      return;
    }

    loadInvoices();
  }, [accountingMode, loadInvoices]);

  useEffect(() => {
    if (accountingMode === 'client' || accountingMode === 'editor') {
      return;
    }

    return registerInvoicesRefresh(loadInvoices);
  }, [accountingMode, loadInvoices]);

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
  const salesRepSummaryWindow = useMemo(
    () => buildSalesRepSummaryWindow(daysWindow),
    [daysWindow],
  );
  const salesRepSummary = useSalesRepSummary({
    startDate: salesRepSummaryWindow.startDate,
    endDate: salesRepSummaryWindow.endDate,
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

    return filteredInvoices.filter((invoice) => isInvoiceInDaysWindow(invoice, daysWindow));
  }, [filteredInvoices, accountingMode, daysWindow]);

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

  const activeServices = useMemo(
    () => services.filter((service) => service.active !== false),
    [services],
  );

  const { rates: editorRates } = useEditorRates(user?.id, {
    enabled: accountingMode === 'editor' && Boolean(user?.id),
    services: activeServices,
  });

  const editingJobs = useMemo(() => {
    if (accountingMode !== 'editor') {
      return [] as EditorJob[];
    }

    const editorId = user?.id ? String(user.id) : null;
    const jobs: EditorJob[] = [];

    shoots.forEach((shoot) => {
      const legacyShoot = shoot as ShootWithLegacyEditorFields;
      const shootEditorId =
        (shoot.editor?.id ? String(shoot.editor.id) : null) ||
        (legacyShoot.editor_id ? String(legacyShoot.editor_id) : null) ||
        (legacyShoot.editorId ? String(legacyShoot.editorId) : null);

      if (editorId && shootEditorId && editorId !== shootEditorId) {
        return;
      }

      const shootServices = Array.isArray(shoot.services) ? shoot.services : [];

      const statusValue = (() => {
        const workflowStatus = shoot.workflowStatus?.toLowerCase();
        const shootStatus = shoot.status?.toLowerCase();
        if (shoot.completedDate || workflowStatus === 'delivered' || shootStatus === 'delivered') {
          return 'delivered' as const;
        }
        if (workflowStatus === 'editing' || shootStatus === 'editing') {
          return 'in_progress' as const;
        }
        return 'pending' as const;
      })();

      const assignedDate = shoot.scheduledDate || shoot.completedDate || new Date().toISOString();
      const completedDate = shoot.completedDate || undefined;

      shootServices.forEach((service, index) => {
        const matchedRate = findMatchingEditorRate(service, editorRates);
        if (!matchedRate || matchedRate.rate <= 0) {
          return;
        }

        const rawServiceName = getEditorServiceName(service) || matchedRate.serviceName;
        const quantity = getEditorServiceQuantity(service);
        const explicitPhotoCount = getExplicitEditorPhotoCount(service);
        const derivedPhotoCount =
          explicitPhotoCount ||
          extractPhotoCountFromServiceName(rawServiceName) ||
          toNumber(shoot.editedPhotoCount) ||
          toNumber(shoot.expectedFinalCount);
        const count = isPhotoServiceName(rawServiceName)
          ? derivedPhotoCount || quantity
          : quantity;

        if (!count) {
          return;
        }

        const typeKey =
          getEditorServiceId(service) ||
          matchedRate.serviceId ||
          normalizeEditorServiceName(matchedRate.serviceName || rawServiceName);
        const pay = Number((count * matchedRate.rate).toFixed(2));

        jobs.push({
          id: `${shoot.id}-${typeKey}-${index}`,
          shootId: String(shoot.id),
          client: shoot.client,
          type: typeKey,
          typeLabel: matchedRate.serviceName || rawServiceName,
          status: statusValue,
          pay,
          payAmount: pay,
          assignedDate,
          completedDate,
          payoutStatus: statusValue === 'delivered' ? 'pending' : 'unpaid',
          editorId: shootEditorId ?? undefined,
          editor_id: shootEditorId ?? undefined,
        } as EditorJob & { editor_id?: string });
      });
    });

    return jobs;
  }, [accountingMode, editorRates, shoots, user?.id]);

  // Use permission system to check if user has admin capabilities
  const canCreateInvoice = can('invoices', 'create');
  const canEditInvoice = can('invoices', 'update');
  const canMarkAsPaid = can('payments', 'mark-paid'); // Only Super Admin can mark as paid
  const isAdmin = ['admin', 'superadmin'].includes(role || '');
  const isSuperAdmin = role === 'superadmin'; // Only Super Admin can see payment status
  const isEditingManagerAccounting = role === 'editing_manager';

  const handleDownloadInvoice = (invoice: InvoiceData) => {
    toast({
      title: "Invoice Generated",
      description: `Invoice ${invoice.id} has been downloaded successfully.`,
      variant: "default",
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

  const handleSendReminder = (invoice: InvoiceData) => {
    toast({
      title: "Reminder Sent",
      description: `Payment reminder sent to ${invoice.client} for invoice ${invoice.id}.`,
      variant: "default",
    });
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
      <div className="space-y-4 px-2 pt-3 pb-3 sm:space-y-6 sm:p-6">
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
              accountingMode === 'rep' ? 'Track client growth, paid revenue, and commission performance across your accounts' :
              'Manage your finances, invoices, and payments'
            }
            badge={config.sidebarLabel}
            showCreateButton={!isEditingManagerAccounting && canCreateInvoice && accountingMode === 'admin' && activeTab === 'home'}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            showTabs={!isEditingManagerAccounting && accountingMode === 'admin'}
            daysWindow={isEditingManagerAccounting ? undefined : daysWindow}
            onDaysWindowChange={isEditingManagerAccounting ? undefined : setDaysWindow}
            payoutActions={null}
          />
            );
          })()}

          {isEditingManagerAccounting ? (
            <EditingManagerVerificationView
              shoots={contextShoots}
              invoices={filteredInvoices}
              loading={loading}
              onViewInvoice={handleViewInvoice}
            />
          ) : (
            <>
              {/* Home Tab Content */}
              {(activeTab === 'home' || accountingMode !== 'admin') && (
                accountingMode === 'rep' ? (
                  <div className="space-y-6">
                    <SalesRepSummarySection
                      data={salesRepSummary.data}
                      loading={salesRepSummary.loading}
                      error={salesRepSummary.error}
                      daysWindow={daysWindow}
                      onRetry={salesRepSummary.refresh}
                    />

                    <section className="space-y-3">
                      <div className="space-y-1">
                        <h2 className="text-lg font-semibold tracking-tight">Weekly commission review</h2>
                        <p className="text-sm text-muted-foreground">
                          Review each weekly commission packet before it moves further through the payout workflow.
                        </p>
                      </div>
                      <WeeklyInvoiceReview />
                    </section>

                    {config.showInvoiceTable && (
                      <section className="space-y-3">
                        <div className="space-y-1">
                          <h2 className="text-lg font-semibold tracking-tight">Client invoice activity</h2>
                          <p className="text-sm text-muted-foreground">
                            Stay on top of balances, reminders, and recent payments across the accounts you manage.
                          </p>
                        </div>
                        <InvoiceList
                          data={{ invoices: filteredInvoices }}
                          onView={handleViewInvoice}
                          onEdit={handleEditInvoice}
                          onDownload={handleDownloadInvoice}
                          onPay={handlePayInvoice}
                          onSendReminder={handleSendReminder}
                          isAdmin={isAdmin}
                          isSuperAdmin={isSuperAdmin}
                          role={role || ''}
                        />
                      </section>
                    )}
                  </div>
                ) : (
                  <>
                    {config.showOverviewCards && (
                      accountingMode === 'admin' ? (
                        <OverviewCards
                          invoices={adminWindowInvoices}
                          timeFilter={timeFilter}
                          daysWindow={daysWindow}
                        />
                      ) : accountingMode === 'client' ? (
                        <ClientBillingOverviewCards
                          summary={clientBillingSummary}
                          items={clientBillingItems}
                          daysWindow={daysWindow}
                        />
                      ) : (
                        <RoleBasedOverviewCards
                          invoices={filteredInvoices}
                          mode={accountingMode}
                          timeFilter={timeFilter}
                          shoots={shoots}
                          editingJobs={editingJobs}
                        />
                      )
                    )}

                    {/* For client: show invoice list BEFORE spending overview */}
                    {accountingMode === 'client' && config.showInvoiceTable && (
                      <ClientBillingList
                        items={clientBillingItems}
                        loading={clientBillingLoading}
                        onView={handleViewClientBillingItem}
                      />
                    )}

                    {config.showRevenueChart && (
                      <div className="grid grid-cols-1 gap-3 items-stretch lg:grid-cols-3">
                        <div className="lg:col-span-2">
                          {accountingMode === 'admin' ? (
                            <RevenueCharts
                              invoices={adminWindowInvoices}
                              timeFilter={timeFilter}
                              onTimeFilterChange={setTimeFilter}
                              role={role}
                            />
                          ) : accountingMode === 'client' ? (
                            <ClientBillingCharts
                              items={clientBillingItems}
                              timeFilter={timeFilter}
                              onTimeFilterChange={setTimeFilter}
                            />
                          ) : (
                            <RoleBasedCharts
                              invoices={filteredInvoices}
                              mode={accountingMode}
                              timeFilter={timeFilter}
                              onTimeFilterChange={setTimeFilter}
                              shoots={shoots}
                              editingJobs={editingJobs}
                            />
                          )}
                        </div>
                        {(config.showPaymentsSummary || config.showLatestTransactions || accountingMode === 'editor' || accountingMode === 'photographer') && (
                          <div className="flex min-h-0 flex-col gap-3 lg:col-span-1">
                            {accountingMode === 'admin' ? (
                              <PaymentsSummary invoices={adminWindowInvoices} />
                            ) : accountingMode === 'client' ? (
                              <ClientBillingSidePanel
                                items={clientBillingItems}
                                summary={clientBillingSummary}
                              />
                            ) : accountingMode === 'editor' ? (
                              <>
                                <EditorRateSettings className="min-h-0 max-h-[min(72vh,44rem)]" />
                                <RoleBasedSidePanel
                                  invoices={filteredInvoices}
                                  mode={accountingMode}
                                  shoots={shoots}
                                  editingJobs={editingJobs}
                                  timeFilter={timeFilter}
                                />
                              </>
                            ) : (
                              <RoleBasedSidePanel
                                invoices={filteredInvoices}
                                mode={accountingMode}
                                shoots={shoots}
                                editingJobs={editingJobs}
                                timeFilter={timeFilter}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Weekly Invoice Review for Photographers */}
                    {accountingMode === 'photographer' && (
                      <WeeklyInvoiceReview />
                    )}

                    {accountingMode === 'editor' && (
                      <EditorEarningsWorkspace mode="self" />
                    )}

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
                              data={{ invoices: filteredInvoices }}
                              onView={handleViewInvoice}
                              onEdit={handleEditInvoice}
                              onDownload={handleDownloadInvoice}
                              onPay={handlePayInvoice}
                              onSendReminder={handleSendReminder}
                              isAdmin={isAdmin}
                              isSuperAdmin={isSuperAdmin}
                              role={role || ''}
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
                  <PhotographerInvoiceReviewWorkspace />
                </div>
              )}

              {activeTab === 'editors' && accountingMode === 'admin' && (
                <div className="flex flex-col gap-4 sm:gap-6">
                  <EditorEarningsWorkspace mode="admin" />
                </div>
              )}

              {activeTab === 'sales-reps' && accountingMode === 'admin' && (
                <div className="flex flex-col gap-4 sm:gap-6">
                  <SalesRepInvoiceReviewWorkspace />
                </div>
              )}
            </>
          )}
        </div>

      {selectedInvoiceForView && (
        <InvoiceViewDialog
          isOpen={viewDialogOpen}
          onClose={closeViewDialog}
          invoice={selectedInvoiceForView}
        />
      )}

      {!isEditingManagerAccounting && selectedInvoice && canMarkAsPaid && (
        <PaymentDialog
          isOpen={paymentDialogOpen}
          onClose={closePaymentDialog}
          invoice={selectedInvoice as InvoiceData}
          onPaymentComplete={handlePaymentComplete}
        />
      )}

      {!isEditingManagerAccounting && canCreateInvoice && (
        <CreateInvoiceDialog
          isOpen={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onInvoiceCreate={handleCreateInvoice}
        />
      )}

      {!isEditingManagerAccounting && canCreateInvoice && (
        <BatchInvoiceDialog
          isOpen={batchDialogOpen}
          onClose={() => setBatchDialogOpen(false)}
          onCreateBatch={handleCreateBatchInvoices}
        />
      )}

      {!isEditingManagerAccounting && selectedInvoice && canEditInvoice && (
        <EditInvoiceDialog
          isOpen={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          invoice={selectedInvoice as InvoiceData}
          onInvoiceEdit={handleInvoiceEdit}
        />
      )}

      {selectedPhotographerShoot && (
        <ShootDetailsModalWrapper
          shoot={selectedPhotographerShoot}
          onClose={() => setSelectedPhotographerShoot(null)}
        />
      )}
    </DashboardLayout>
  );
};

export default AccountingPage;
