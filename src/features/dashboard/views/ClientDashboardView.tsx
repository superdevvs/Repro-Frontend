import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { format } from "date-fns";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { RescheduleDialog } from "@/components/dashboard/RescheduleDialog";
import { StripePaymentDialog } from "@/components/payments/StripePaymentDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientEmailHealthNotice } from "@/components/email/ClientEmailHealthNotice";
import { RoleMetricTilesCard } from "@/components/dashboard/v2/RoleMetricTilesCard";
import type { DashboardClientRequest, DashboardShootSummary } from "@/types/dashboard";
import type { ShootData } from "@/types/shoots";
import type { useToast } from "@/hooks/use-toast";
import { normalizeEmailHealth } from "@/utils/emailHealth";
import {
  CLIENT_VISIBLE_DELIVERED_STATUS_KEYWORDS,
  type ClientShootRecord,
} from "@/utils/dashboardDerivedUtils";
import { API_BASE_URL } from "@/config/env";
import { usePermission } from "@/hooks/usePermission";
import { useClientBilling } from "@/hooks/useClientBilling";
import { emptyClientBillingSummary } from "@/services/clientBillingService";
import { getShootServiceItems } from "@/utils/shootServiceItems";
import {
  CLIENT_DASHBOARD_ONBOARDING_REPLAY_EVENT,
  emitClientDashboardOnboardingState,
} from "@/lib/clientDashboardOnboardingEvents";

import { ClientDashboardOnboarding } from "../components/ClientDashboardOnboarding";
import { ClientInvoicesCard } from "../components/ClientInvoicesCard";
import { ClientMyShoots } from "../components/ClientMyShoots";
import { DASHBOARD_DESCRIPTION } from "../constants";
import { useClientDashboardOnboarding } from "../hooks/useClientDashboardOnboarding";
import { useClientDashboardMetrics } from "../hooks/useDashboardMetrics";
import type { MobileClientDashboardTab } from "../types";

type ToastFn = ReturnType<typeof useToast>["toast"];

interface ClientDashboardViewProps {
  clientRequests: DashboardClientRequest[];
  clientRequestsLoading: boolean;
  clientCompletedRecords: ClientShootRecord[];
  clientDesktopLeftColumnRef: React.RefObject<HTMLDivElement | null>;
  clientDesktopShootsContainerRef: React.RefObject<HTMLDivElement | null>;
  clientDesktopShootsHeight: number | null;
  clientEmailActionPending: boolean;
  clientOnHoldRecords: ClientShootRecord[];
  clientShoots: ShootData[];
  clientUpcomingRecords: ClientShootRecord[];
  greetingTitle: React.ReactNode;
  isMobile: boolean;
  mobileClientTab: MobileClientDashboardTab;
  refresh: () => void | Promise<void>;
  shootDetailsModal: React.ReactNode;
  toast: ToastFn;
  user: any;
  onManageClientEmail: () => void;
  onOpenSupportEmail: (subject: string, body?: string) => void;
  onResendClientVerification: () => void | Promise<void>;
  onOpenClientRequests: () => void;
  onSetMobileClientTab: (tab: MobileClientDashboardTab) => void;
  onSetOpenDownloadOnSelect: (open: boolean) => void;
  onSetSelectedShoot: (shoot: DashboardShootSummary | null) => void;
}

export const ClientDashboardView = ({
  clientRequests,
  clientRequestsLoading,
  clientCompletedRecords,
  clientDesktopLeftColumnRef,
  clientDesktopShootsContainerRef,
  clientDesktopShootsHeight,
  clientEmailActionPending,
  clientOnHoldRecords,
  clientShoots,
  clientUpcomingRecords,
  greetingTitle,
  isMobile,
  mobileClientTab,
  refresh,
  shootDetailsModal,
  toast,
  user,
  onManageClientEmail,
  onOpenSupportEmail,
  onResendClientVerification,
  onOpenClientRequests,
  onSetMobileClientTab,
  onSetOpenDownloadOnSelect,
  onSetSelectedShoot,
}: ClientDashboardViewProps) => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canViewClientBillingWidget = can("dashboard-client-billing", "view");
  const { data: clientBillingData } = useClientBilling();
  const clientBillingSummary = canViewClientBillingWidget
    ? clientBillingData?.summary ?? emptyClientBillingSummary
    : emptyClientBillingSummary;
  const clientMetricTiles = useClientDashboardMetrics({
    clientBillingSummary,
    clientCompletedRecords,
    clientOnHoldRecords,
    clientShoots,
    navigate,
  });
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [shootToReschedule, setShootToReschedule] = useState<ShootData | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [shootToPay, setShootToPay] = useState<ClientShootRecord | null>(null);
  const [stripePaymentOpen, setStripePaymentOpen] = useState(false);
  const [paymentSelectionOpen, setPaymentSelectionOpen] = useState(false);
  const [selectedShootsForPayment, setSelectedShootsForPayment] = useState<ClientShootRecord[]>([]);
  const [multiPaymentOpen, setMultiPaymentOpen] = useState(false);
  const clientOnboarding = useClientDashboardOnboarding(user);
  const shootToPayServiceItems = shootToPay
    ? getShootServiceItems(shootToPay.data).filter((item) => item.balanceDue > 0.01)
    : [];
  const shootToPayBalanceDue =
    (shootToPay?.data.payment?.totalQuote ?? 0) - (shootToPay?.data.payment?.totalPaid ?? 0);
  const activeClientRequestCount = clientRequests.filter((request) =>
    request.status === "open" || request.status === "in-progress" || request.status === "in_progress",
  ).length;

  useEffect(() => {
    const visible = Boolean(
      clientOnboarding.onboardingState.eligible &&
      !clientOnboarding.onboardingState.completedAt,
    );

    emitClientDashboardOnboardingState({ visible });

    return () => emitClientDashboardOnboardingState({ visible: false });
  }, [
    clientOnboarding.onboardingState.completedAt,
    clientOnboarding.onboardingState.eligible,
  ]);

  useEffect(() => {
    const handleReplayRequest = () => clientOnboarding.replay();
    window.addEventListener(CLIENT_DASHBOARD_ONBOARDING_REPLAY_EVENT, handleReplayRequest);
    return () => window.removeEventListener(CLIENT_DASHBOARD_ONBOARDING_REPLAY_EVENT, handleReplayRequest);
  }, [clientOnboarding]);

  useEffect(() => {
    if (mobileClientTab === "requests") {
      onSetMobileClientTab("shoots");
    }
  }, [mobileClientTab, onSetMobileClientTab]);

  const handleReschedule = (record: ClientShootRecord) => {
    setShootToReschedule(record.data);
    setRescheduleDialogOpen(true);
  };
  const handleCancelShoot = async (record: ClientShootRecord) => {
    try {
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      const normalizedStatus = (record.summary.workflowStatus || record.summary.status || "").toLowerCase();
      const isRequestedShoot = normalizedStatus === "requested";
      if (!isRequestedShoot) {
        toast({
          title: "Cancellation unavailable",
          description: "Only requested shoots can be cancelled from the client dashboard.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/shoots/${record.data.id}/withdraw-request`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          reason: "Client withdrew requested shoot",
        }),
      });

      if (response.ok) {
        toast({
          title: "Shoot cancelled",
          description: `Your requested shoot for ${record.summary.addressLine} has been cancelled.`,
        });
        refresh();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to request cancellation",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request cancellation. Please try again.",
        variant: "destructive",
      });
    }
  };
  const handleContactSupport = () => onOpenSupportEmail("Client dashboard support");
  const handleDownloadShoot = (record: ClientShootRecord) => {
    onSetOpenDownloadOnSelect(true);
    onSetSelectedShoot(record.summary);
  };
  const handleRebookShoot = (record: ClientShootRecord) =>
    navigate(`/book-shoot?template=${record.data.id}`);
  const handleRequestRevision = (record: ClientShootRecord) =>
    onOpenSupportEmail(
      `Revision request for shoot #${record.data.id}`,
      `Please assist with revisions for shoot #${record.data.id}.`,
    );
  const handleHoldAction = (record: ClientShootRecord) => {
    const status = (record.summary.workflowStatus || record.summary.status || "").toLowerCase();
    if (status.includes("payment")) {
      navigate("/invoices");
      return;
    }
    onOpenSupportEmail("Shoot assistance needed");
  };
  const clientEmailNotice = (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <ClientEmailHealthNotice
        email={user?.email}
        emailHealth={normalizeEmailHealth(user?.email_health)}
        onManageEmail={onManageClientEmail}
        onResendVerification={onResendClientVerification}
        resendPending={clientEmailActionPending}
        variant="banner"
      />
      <ClientDashboardOnboarding
        welcomeOpen={clientOnboarding.welcomeOpen}
        tourOpen={clientOnboarding.tourOpen}
        isMobile={isMobile}
        currentMobileTab={mobileClientTab}
        lastStep={clientOnboarding.onboardingState.lastStep}
        showReplay={false}
        onStart={clientOnboarding.startTour}
        onDismiss={clientOnboarding.dismiss}
        onComplete={(lastStep) => clientOnboarding.complete({ lastStep })}
        onProgress={clientOnboarding.saveProgress}
        onReplay={clientOnboarding.replay}
        onSetMobileTab={onSetMobileClientTab}
      />
    </div>
  );

  const clientShootsContent = (
    <div data-onboarding-target="client-dashboard-shoots" className="flex min-h-0 flex-1 flex-col">
      <ClientMyShoots
        upcoming={clientUpcomingRecords}
        completed={clientCompletedRecords}
        onHold={clientOnHoldRecords}
        currentUserId={user?.id ?? null}
        onSelect={(record) => onSetSelectedShoot(record.summary)}
        onReschedule={handleReschedule}
        onCancel={handleCancelShoot}
        onContactSupport={() => handleContactSupport()}
        onDownload={handleDownloadShoot}
        onRebook={handleRebookShoot}
        onRequestRevision={handleRequestRevision}
        onHoldAction={handleHoldAction}
        onPayment={(record) => {
          setShootToPay(record);
          setPaymentModalOpen(true);
        }}
        onBookNewShoot={() => navigate("/book-shoot")}
        activeRequestCount={activeClientRequestCount}
        requestsLoading={clientRequestsLoading}
        onOpenRequests={onOpenClientRequests}
      />
    </div>
  );

  const clientInvoicesContent = (
    <div data-onboarding-target="client-dashboard-invoices">
      <ClientInvoicesCard
        summary={clientBillingSummary}
        onViewAll={() => navigate("/accounting")}
        onPay={() => {
          setSelectedShootsForPayment([]);
          setPaymentSelectionOpen(true);
        }}
      />
    </div>
  );

  const clientMetricsContent = (
    <div data-onboarding-target="client-dashboard-metrics">
      <RoleMetricTilesCard tiles={clientMetricTiles} />
    </div>
  );

  const clientMobileTabs = [
    { id: "shoots" as const, label: "Shoots", content: clientShootsContent },
    { id: "invoices" as const, label: "Invoices", content: clientInvoicesContent },
  ];

  const clientMobileContent = (
    <div className="space-y-4">
      {clientMetricsContent}
      <Tabs
        value={mobileClientTab}
        onValueChange={(val) => onSetMobileClientTab(val as MobileClientDashboardTab)}
        className="space-y-2 flex-1 flex flex-col dashboard-mobile-tabs"
      >
        <div
          data-onboarding-target="client-dashboard-mobile-tabs"
          className="sticky top-[-0.25rem] z-20 pb-1 -mx-2 px-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
          <div className="overflow-x-auto hidden-scrollbar">
            <TabsList className="inline-flex gap-2 rounded-full border border-border/50 bg-muted/30 pl-1.5 pr-3 py-1.5">
              {clientMobileTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold tracking-tight transition-all duration-150 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground/80"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
        {clientMobileTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="focus-visible:outline-none flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex flex-col min-h-0 pt-1">
              {tab.content}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );

  const clientDesktopContent = (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-12 md:items-start">
      <div
        ref={clientDesktopLeftColumnRef}
        data-client-dashboard-left-column="true"
        className="md:col-span-3 flex flex-col gap-4 sm:gap-6 md:sticky md:top-6"
      >
        {clientMetricsContent}
        {clientInvoicesContent}
      </div>
      <div
        ref={clientDesktopShootsContainerRef}
        className="md:col-span-9 md:min-h-0 md:sticky md:top-6"
      >
        <div
          className="flex min-h-0 flex-col"
          style={
            clientDesktopShootsHeight
              ? {
                  height: `${clientDesktopShootsHeight}px`,
                  maxHeight: `${clientDesktopShootsHeight}px`,
                }
              : undefined
          }
        >
          {clientShootsContent}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <DashboardLayout>
        <div className="px-2 pt-3 pb-3 sm:p-6 flex flex-col gap-4 sm:gap-6">
          <PageHeader
            title={greetingTitle}
            description={DASHBOARD_DESCRIPTION}
            action={clientEmailNotice}
          />
          {isMobile ? clientMobileContent : clientDesktopContent}
        </div>
      </DashboardLayout>
      {shootDetailsModal}
      {shootToReschedule && (
        <RescheduleDialog
          shoot={shootToReschedule}
          isOpen={rescheduleDialogOpen}
          onClose={() => {
            setRescheduleDialogOpen(false);
            setShootToReschedule(null);
          }}
          onSuccess={() => {
            refresh();
          }}
        />
      )}

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Complete Payment
            </DialogTitle>
            <DialogDescription>
              Secure your booking by completing the payment now.
            </DialogDescription>
          </DialogHeader>

          {shootToPay && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Property</span>
                  <span className="font-medium">{shootToPay.summary.addressLine}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Scheduled</span>
                  <span className="font-medium">
                    {shootToPay.summary.startTime
                      ? format(new Date(shootToPay.summary.startTime), "MMM d, yyyy 'at' h:mm a")
                      : shootToPay.data.scheduledDate || "TBD"
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Balance Due</span>
                  <span className="font-bold text-lg text-green-600">
                    ${shootToPayBalanceDue.toFixed(2)}
                  </span>
                </div>
              </div>

              {shootToPayServiceItems.length > 0 && (
                <div className="rounded-lg border bg-background/70 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Pay by service</p>
                  <div className="space-y-1.5">
                    {shootToPayServiceItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium">{item.name}</span>
                        <span className="shrink-0 font-semibold text-green-600">${item.balanceDue.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground text-center">
                Use Pay Now to pay the full order or selected service items.
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setPaymentModalOpen(false)}
            >
              Pay Later
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                setPaymentModalOpen(false);
                // Open Square Payment Dialog
                setStripePaymentOpen(true);
              }}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Square Payment Dialog */}
      {shootToPay && (
        <StripePaymentDialog
          isOpen={stripePaymentOpen}
          onClose={() => {
            setStripePaymentOpen(false);
            setShootToPay(null);
          }}
          amount={(shootToPay.data.payment?.totalQuote ?? 0) - (shootToPay.data.payment?.totalPaid ?? 0)}
          shootId={shootToPay.data.id}
          shootAddress={shootToPay.summary.addressLine}
          shootServices={shootToPay.summary.services?.map((s: any) => typeof s === "string" ? s : s?.name || s?.label || String(s)).filter(Boolean) || []}
          serviceItems={shootToPayServiceItems}
          shootDate={shootToPay.data.scheduledDate}
          shootTime={shootToPay.data.time}
          clientName={user?.name}
          clientEmail={user?.email}
          totalQuote={shootToPay.data.payment?.totalQuote}
          totalPaid={shootToPay.data.payment?.totalPaid}
          onPaymentSuccess={() => {
            setStripePaymentOpen(false);
            setShootToPay(null);
            refresh();
            toast({
              title: "Payment successful",
              description: "Your payment has been processed successfully.",
            });
          }}
          clientCanSubmitOfflineIntent
          onOfflineIntentSubmitted={() => {
            setStripePaymentOpen(false);
            setShootToPay(null);
            refresh();
          }}
        />
      )}

      {/* Payment Selection Modal */}
      <Dialog open={paymentSelectionOpen} onOpenChange={setPaymentSelectionOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Select Shoots to Pay
            </DialogTitle>
            <DialogDescription>
              Choose one or more shoots to pay. You can pay multiple at once.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            // Get all unpaid shoots
            const allUnpaidShoots = [...clientUpcomingRecords, ...clientCompletedRecords, ...clientOnHoldRecords]
              .filter(record => {
                const balance = (record.data.payment?.totalQuote ?? 0) - (record.data.payment?.totalPaid ?? 0);
                return balance > 1;
              });

            const dueNowShoots = allUnpaidShoots.filter(record => {
              const status = (record.data.workflowStatus || record.data.status || "").toLowerCase();
              return CLIENT_VISIBLE_DELIVERED_STATUS_KEYWORDS.some(s => status.includes(s));
            });
            const upcomingShoots = allUnpaidShoots.filter(record => {
              const status = (record.data.workflowStatus || record.data.status || "").toLowerCase();
              return !CLIENT_VISIBLE_DELIVERED_STATUS_KEYWORDS.some(s => status.includes(s));
            });

            const isSelected = (record: ClientShootRecord) =>
              selectedShootsForPayment.some(s => s.data.id === record.data.id);

            const toggleSelection = (record: ClientShootRecord) => {
              if (isSelected(record)) {
                setSelectedShootsForPayment(prev => prev.filter(s => s.data.id !== record.data.id));
              } else {
                setSelectedShootsForPayment(prev => [...prev, record]);
              }
            };

            const totalSelected = selectedShootsForPayment.reduce((sum, record) => {
              return sum + ((record.data.payment?.totalQuote ?? 0) - (record.data.payment?.totalPaid ?? 0));
            }, 0);

            const renderShootItem = (record: ClientShootRecord) => {
              const balance = (record.data.payment?.totalQuote ?? 0) - (record.data.payment?.totalPaid ?? 0);
              return (
                <div
                  key={record.data.id}
                  onClick={() => toggleSelection(record)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected(record)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected(record)}
                    onChange={() => toggleSelection(record)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{record.summary.addressLine}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.data.scheduledDate ? format(new Date(record.data.scheduledDate), "MMM d, yyyy") : "TBD"}
                    </p>
                  </div>
                  <span className="font-bold text-green-600">${balance.toFixed(2)}</span>
                </div>
              );
            };

            return (
              <div className="space-y-4 py-2">
                {dueNowShoots.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-red-600 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Due Now ({dueNowShoots.length})
                    </h4>
                    <div className="space-y-2">
                      {dueNowShoots.map(renderShootItem)}
                    </div>
                  </div>
                )}

                {upcomingShoots.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-blue-600 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Upcoming ({upcomingShoots.length})
                    </h4>
                    <div className="space-y-2">
                      {upcomingShoots.map(renderShootItem)}
                    </div>
                  </div>
                )}

                {allUnpaidShoots.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No outstanding payments</p>
                  </div>
                )}

                {selectedShootsForPayment.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-muted-foreground">
                        {selectedShootsForPayment.length} shoot{selectedShootsForPayment.length > 1 ? "s" : ""} selected
                      </span>
                      <span className="font-bold text-lg text-green-600">
                        Total: ${totalSelected.toFixed(2)}
                      </span>
                    </div>
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setPaymentSelectionOpen(false);
                        if (selectedShootsForPayment.length === 1) {
                          setShootToPay(selectedShootsForPayment[0]);
                          setStripePaymentOpen(true);
                        } else {
                          setMultiPaymentOpen(true);
                        }
                      }}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay ${totalSelected.toFixed(2)}
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Multi-Payment Dialog */}
      {selectedShootsForPayment.length > 1 && (
        <StripePaymentDialog
          isOpen={multiPaymentOpen}
          onClose={() => {
            setMultiPaymentOpen(false);
            setSelectedShootsForPayment([]);
          }}
          amount={selectedShootsForPayment.reduce((sum, record) =>
            sum + ((record.data.payment?.totalQuote ?? 0) - (record.data.payment?.totalPaid ?? 0)), 0
          )}
          shootId={selectedShootsForPayment.map(r => r.data.id).join(",")}
          shootAddress={`${selectedShootsForPayment.length} shoots selected`}
          shootServices={[`${selectedShootsForPayment.length} shoots`]}
          clientName={user?.name}
          clientEmail={user?.email}
          totalQuote={selectedShootsForPayment.reduce((sum, r) => sum + (r.data.payment?.totalQuote ?? 0), 0)}
          totalPaid={selectedShootsForPayment.reduce((sum, r) => sum + (r.data.payment?.totalPaid ?? 0), 0)}
          onPaymentSuccess={() => {
            setMultiPaymentOpen(false);
            setSelectedShootsForPayment([]);
            refresh();
            toast({
              title: "Payment successful",
              description: `Payment for ${selectedShootsForPayment.length} shoots has been processed successfully.`,
            });
          }}
        />
      )}
    </>
  );
};
