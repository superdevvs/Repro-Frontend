
import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { AccountingHeader } from '@/components/accounting/AccountingHeader';
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
import { PaymentDialog } from '@/components/invoices/PaymentDialog';
import { BatchInvoiceDialog } from '@/components/accounting/BatchInvoiceDialog';
import { InvoiceData } from '@/utils/invoiceUtils';
import { useToast } from '@/hooks/use-toast';
import { EditInvoiceDialog } from '@/components/invoices/EditInvoiceDialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermission } from '@/hooks/usePermission';
import { getAccountingMode, accountingConfigs } from '@/config/accountingConfig';

// We're reusing the existing initial invoices data for now
import { initialInvoices } from '@/components/accounting/data';

const AccountingPage = () => {
  const { toast } = useToast();
  const { role, user } = useAuth(); // Use the correct AuthProvider
  const { can } = usePermission();
  const [invoices, setInvoices] = useState<InvoiceData[]>(initialInvoices);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Get accounting mode based on role
  const accountingMode = useMemo(() => getAccountingMode(role), [role]);
  const config = accountingConfigs[accountingMode];

  // Filter invoices based on role
  const filteredInvoices = useMemo(() => {
    if (accountingMode === 'admin') {
      return invoices; // Admin sees all
    }
    if (accountingMode === 'client') {
      return invoices.filter(i => i.client === user?.name || i.client_id === user?.id);
    }
    if (accountingMode === 'rep') {
      // Filter by rep assignment - placeholder logic
      return invoices; // Would filter by rep_id in real implementation
    }
    // For photographer and editor, invoices might not be the primary data
    return invoices;
  }, [invoices, accountingMode, user]);

  // Fetch shoots and editing jobs based on role
  // TODO: Replace with actual API calls
  // Example for photographer:
  // const shoots = useShootsForPhotographer(user?.id);
  // Example for editor:
  // const editingJobs = useEditingJobsForEditor(user?.id);
  const shoots = useMemo(() => {
    if (accountingMode === 'photographer') {
      // TODO: Fetch shoots for this photographer from API
      // Filter by photographer_id === user?.id
      // Include fields: id, client, location, scheduledDate, status, payment, photographer_fee
      return [] as ShootData[];
    }
    return [] as ShootData[];
  }, [accountingMode, user]);

  const editingJobs = useMemo(() => {
    if (accountingMode === 'editor') {
      // TODO: Fetch editing jobs for this editor from API
      // Filter by editor_id === user?.id
      // Include fields: id, shootId, client, type, status, pay, assignedDate, completedDate, payoutStatus
      return [] as EditorJob[];
    }
    return [] as EditorJob[];
  }, [accountingMode, user]);

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

  const handlePaymentComplete = (invoiceId: string, paymentMethod: string) => {
    setInvoices(currentInvoices =>
      currentInvoices.map(invoice =>
        invoice.id === invoiceId
          ? {
            ...invoice,
            status: 'paid',
            paymentMethod: paymentMethod
          }
          : invoice
      )
    );

    toast({
      title: "Payment Successful",
      description: `Invoice ${invoiceId} has been marked as paid.`,
      variant: "default",
    });
    setPaymentDialogOpen(false);
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
      <PageTransition>
        <div className="space-y-6 p-6">
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
          />

          {config.showOverviewCards && (
            accountingMode === 'admin' ? (
              <OverviewCards invoices={filteredInvoices} timeFilter={timeFilter} />
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {accountingMode === 'admin' ? (
                  <RevenueCharts
                    invoices={filteredInvoices}
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
              {(config.showPaymentsSummary || config.showLatestTransactions || accountingMode === 'editor') && (
                <div className="lg:col-span-1 flex flex-col gap-6">
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
                  isAdmin={isAdmin} // Pass down admin status
                  isSuperAdmin={isSuperAdmin} // Pass down super admin status for payment visibility
                  role={role || ''} // Pass role for payment checks
                />
              )}
            </>
          )}

          {/* <UpcomingPayments invoices={invoices} /> */}
        </div>
      </PageTransition>

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
