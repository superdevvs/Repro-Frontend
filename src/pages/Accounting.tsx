
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AccountingHeader, type AccountingTab } from '@/components/accounting/AccountingHeader';
import { OverviewCards } from '@/components/accounting/OverviewCards';
import { RoleBasedOverviewCards } from '@/components/accounting/RoleBasedOverviewCards';
import { RevenueCharts } from '@/components/accounting/RevenueCharts';
import { RoleBasedCharts } from '@/components/accounting/RoleBasedCharts';
import { InvoiceList } from '@/components/accounting/InvoiceList';
import { PhotographerShootsTable } from '@/components/accounting/PhotographerShootsTable';
import { EditorJobsTable, EditorJob } from '@/components/accounting/EditorJobsTable';
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
import { useShoots } from '@/context/ShootsContext';
import { WeeklyInvoiceReview } from '@/components/invoices/WeeklyInvoiceReview';
import { PayoutReportPanel } from '@/components/accounting/PayoutReportPanel';
import { PendingInvoiceApprovals } from '@/components/accounting/PendingInvoiceApprovals';

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const isPhotoServiceName = (name: string) => /photo|hdr|twilight/i.test(name);

const isVideoServiceName = (name: string) => /video/i.test(name);

const isFloorplanServiceName = (name: string) => /floor\s*plan|floorplan/i.test(name);

const extractPhotoCountFromService = (name: string) => {
  const match = name.match(/(\d+)\s*photo/i);
  return match ? Number(match[1]) : 0;
};

const AccountingPage = () => {
  const { toast } = useToast();
  const { role, user } = useAuth(); // Use the correct AuthProvider
  const { can } = usePermission();
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountingTab>('home');
  const [payoutActions, setPayoutActions] = useState<{
    refresh: () => void;
    download: () => Promise<void>;
    loading: boolean;
    downloading: boolean;
  } | null>(null);
  const { shoots: contextShoots } = useShoots();

  // Get accounting mode based on role
  const accountingMode = useMemo(() => getAccountingMode(role), [role]);
  const config = accountingConfigs[accountingMode];

  const loadInvoices = useCallback(async (): Promise<void> => {
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
  }, [toast]);

  // Fetch invoices from API
  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => registerInvoicesRefresh(loadInvoices), [loadInvoices]);

  // Filter invoices based on role (backend already filters, but this is a safety check)
  const filteredInvoices = useMemo(() => {
    // Backend already applies role-based filtering, but we do a client-side safety check
    if (accountingMode === 'admin' || accountingMode === 'rep') {
      return invoices; // Admin and rep see all (filtered by backend)
    }
    if (accountingMode === 'client') {
      const userId = user?.id != null ? String(user.id) : null;
      const userName = String(user?.name || '').trim().toLowerCase();
      return invoices.filter((i) => {
        const invoiceClientId = i.client_id != null ? String(i.client_id) : null;
        if (userId && invoiceClientId) {
          return invoiceClientId === userId;
        }
        const invoiceClientName = String(i.client || '').trim().toLowerCase();
        return Boolean(userName && invoiceClientName && invoiceClientName === userName);
      });
    }
    if (accountingMode === 'photographer') {
      return invoices.filter(i => String(i.photographer_id ?? '') === String(user?.id ?? ''));
    }
    // For editor, invoices might not be the primary data
    return invoices;
  }, [invoices, accountingMode, user]);

  // Fetch shoots and editing jobs based on role
  // TODO: Replace with actual API calls
  // Example for photographer:
  // const shoots = useShootsForPhotographer(user?.id);
  // Example for editor:
  // const editingJobs = useEditingJobsForEditor(user?.id);
  const shoots = useMemo(() => {
    if (accountingMode === 'photographer' || accountingMode === 'editor') {
      return contextShoots;
    }
    return [] as ShootData[];
  }, [accountingMode, contextShoots]);

  const editorRates = useMemo(() => {
    const metadata = user?.metadata ?? {};
    return {
      photoEditRate: toNumber(metadata.photo_edit_rate ?? metadata.photoEditRate),
      videoEditRate: toNumber(metadata.video_edit_rate ?? metadata.videoEditRate),
      floorplanRate: toNumber(metadata.floorplan_rate ?? metadata.floorplanRate),
      otherRate: toNumber(metadata.other_rate ?? metadata.otherRate),
    };
  }, [user?.metadata]);

  const editingJobs = useMemo(() => {
    if (accountingMode !== 'editor') {
      return [] as EditorJob[];
    }

    const editorId = user?.id ? String(user.id) : null;
    const jobs: EditorJob[] = [];

    shoots.forEach((shoot) => {
      const shootEditorId =
        (shoot.editor?.id ? String(shoot.editor.id) : null) ||
        ((shoot as any).editor_id ? String((shoot as any).editor_id) : null) ||
        ((shoot as any).editorId ? String((shoot as any).editorId) : null);

      if (editorId && shootEditorId && editorId !== shootEditorId) {
        return;
      }

      const services = (shoot.services || []).map((service) => String(service));
      const photoCountFromServices = services.reduce(
        (sum, service) => sum + extractPhotoCountFromService(service),
        0,
      );
      const photoCount =
        toNumber(shoot.editedPhotoCount) ||
        toNumber(shoot.expectedFinalCount) ||
        photoCountFromServices ||
        0;
      const videoCount = services.filter((service) => isVideoServiceName(service)).length;
      const floorplanCount = services.filter((service) => isFloorplanServiceName(service)).length;
      const otherCount = services.filter(
        (service) =>
          !isPhotoServiceName(service) &&
          !isVideoServiceName(service) &&
          !isFloorplanServiceName(service),
      ).length;

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

      const pushJob = (type: EditorJob['type'], count: number, rate: number) => {
        if (!count || rate <= 0) return;
        const pay = Number((count * rate).toFixed(2));
        jobs.push({
          id: `${shoot.id}-${type}`,
          shootId: String(shoot.id),
          client: shoot.client,
          type,
          status: statusValue,
          pay,
          payAmount: pay,
          assignedDate,
          completedDate,
          payoutStatus: statusValue === 'delivered' ? 'pending' : 'unpaid',
          editorId: shootEditorId ?? undefined,
          editor_id: shootEditorId ?? undefined,
        } as EditorJob & { editor_id?: string });
      };

      pushJob('photo_edit', photoCount, editorRates.photoEditRate);
      pushJob('video_edit', videoCount, editorRates.videoEditRate);
      pushJob('floorplan', floorplanCount, editorRates.floorplanRate);
      pushJob('other', otherCount, editorRates.otherRate);
    });

    return jobs;
  }, [accountingMode, editorRates, shoots, user?.id]);

  // Use permission system to check if user has admin capabilities
  const canCreateInvoice = can('invoices', 'create');
  const canEditInvoice = can('invoices', 'update');
  const canMarkAsPaid = can('payments', 'mark-paid'); // Only Super Admin can mark as paid
  const isAdmin = ['admin', 'superadmin'].includes(role || '');
  const isSuperAdmin = role === 'superadmin'; // Only Super Admin can see payment status

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
          <AccountingHeader
            onCreateInvoice={() => canCreateInvoice && setCreateDialogOpen(true)}
            onCreateBatch={() => canCreateInvoice && setBatchDialogOpen(true)}
            title={config.pageTitle}
            description={
              accountingMode === 'photographer' ? 'View your earnings and payout status' :
              accountingMode === 'editor' ? 'Track your editing jobs and pay' :
              accountingMode === 'client' ? 'View your invoices and payment history' :
              accountingMode === 'rep' ? 'Track revenue from your clients' :
              'Manage your finances, invoices, and payments'
            }
            badge={config.sidebarLabel}
            showCreateButton={canCreateInvoice && accountingMode === 'admin'}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            showTabs={accountingMode === 'admin'}
            payoutActions={payoutActions}
          />

          {/* Home Tab Content */}
          {(activeTab === 'home' || accountingMode !== 'admin') && (
            <>
              {config.showOverviewCards && (
                accountingMode === 'admin' ? (
                  <OverviewCards 
                    invoices={filteredInvoices} 
                    timeFilter={timeFilter}
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

              {config.showRevenueChart && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
                  <div className="lg:col-span-2">
                    {accountingMode === 'admin' ? (
                      <RevenueCharts
                        invoices={filteredInvoices}
                        timeFilter={timeFilter}
                        onTimeFilterChange={setTimeFilter}
                        role={role}
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
                  {(config.showPaymentsSummary || config.showLatestTransactions || accountingMode === 'editor') && (
                    <div className="lg:col-span-1 flex flex-col gap-3 h-full">
                      {accountingMode === 'admin' ? (
                        <PaymentsSummary invoices={filteredInvoices} />
                      ) : accountingMode === 'editor' ? (
                        <>
                          <EditorRateSettings />
                          <RoleBasedSidePanel
                            invoices={filteredInvoices}
                            mode={accountingMode}
                            shoots={shoots}
                            editingJobs={editingJobs}
                          />
                        </>
                      ) : (
                        <RoleBasedSidePanel
                          invoices={filteredInvoices}
                          mode={accountingMode}
                          shoots={shoots}
                          editingJobs={editingJobs}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Weekly Invoice Review for Photographers and Sales Reps */}
              {(accountingMode === 'photographer' || accountingMode === 'rep') && (
                <WeeklyInvoiceReview />
              )}

              {config.showInvoiceTable && (
                <>
                  {accountingMode === 'photographer' ? (
                    <PhotographerShootsTable shoots={shoots} />
                  ) : accountingMode === 'editor' ? (
                    <EditorJobsTable jobs={editingJobs} />
                  ) : (
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
                  )}
                </>
              )}
            </>
          )}

          {/* Photographers Tab Content - Payout Report and Pending Invoice Approvals */}
          {activeTab === 'photographers' && accountingMode === 'admin' && (
            <div className="space-y-4 sm:space-y-6">
              <PayoutReportPanel 
                hideHeaderButtons={true}
                registerActions={setPayoutActions}
              />
              <PendingInvoiceApprovals />
            </div>
          )}
        </div>

      {selectedInvoice && (
        <InvoiceViewDialog
          isOpen={viewDialogOpen}
          onClose={closeViewDialog}
          invoice={selectedInvoice}
        />
      )}

      {selectedInvoice && canMarkAsPaid && (
        <PaymentDialog
          isOpen={paymentDialogOpen}
          onClose={closePaymentDialog}
          invoice={selectedInvoice}
          onPaymentComplete={handlePaymentComplete}
        />
      )}

      {canCreateInvoice && (
        <CreateInvoiceDialog
          isOpen={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onInvoiceCreate={handleCreateInvoice}
        />
      )}

      {canCreateInvoice && (
        <BatchInvoiceDialog
          isOpen={batchDialogOpen}
          onClose={() => setBatchDialogOpen(false)}
          onCreateBatch={handleCreateBatchInvoices}
        />
      )}

      {selectedInvoice && canEditInvoice && (
        <EditInvoiceDialog
          isOpen={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          invoice={selectedInvoice}
          onInvoiceEdit={handleInvoiceEdit}
        />
      )}
    </DashboardLayout>
  );
};

export default AccountingPage;
