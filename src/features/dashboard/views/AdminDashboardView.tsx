import React from "react";
import { Camera, CheckCircle2, KanbanSquare, MessageCircle, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { UploadStatusWidget } from "@/components/dashboard/UploadStatusWidget";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleMetricTilesCard, type DashboardMetricTile } from "@/components/dashboard/v2/RoleMetricTilesCard";
import type { DashboardOverview } from "@/types/dashboard";

import { DASHBOARD_DESCRIPTION } from "../constants";
import type { MobileDashboardTab } from "../types";

interface AdminDashboardViewProps {
  adminMetricTiles: DashboardMetricTile[];
  cancellationRequestCount: number;
  data: DashboardOverview | null;
  error: string | null;
  greetingTitle: React.ReactNode;
  isMobile: boolean;
  mobileDashboardTab: MobileDashboardTab;
  refresh: () => void | Promise<void>;
  renderAssignPhotographersCard: () => React.ReactNode;
  renderCompletedShootsCard: (options?: { stretch?: boolean }) => React.ReactNode;
  renderPendingReviewsCard: () => React.ReactNode;
  renderPipelineSection: () => React.ReactNode;
  renderShootsTabsCard: () => React.ReactNode;
  setCancellationDialogOpen: (open: boolean) => void;
  setMobileDashboardTab: (tab: MobileDashboardTab) => void;
}

export const AdminDashboardView = ({
  adminMetricTiles,
  cancellationRequestCount,
  data,
  error,
  greetingTitle,
  isMobile,
  mobileDashboardTab,
  refresh,
  renderAssignPhotographersCard,
  renderCompletedShootsCard,
  renderPendingReviewsCard,
  renderPipelineSection,
  renderShootsTabsCard,
  setCancellationDialogOpen,
  setMobileDashboardTab,
}: AdminDashboardViewProps) => {
  const mobileTabs = [
    {
      id: "shoots",
      label: "Shoots",
      icon: Camera,
      content: renderShootsTabsCard(),
    },
    {
      id: "completed",
      label: "Completed",
      icon: CheckCircle2,
      content: renderCompletedShootsCard(),
    },
    {
      id: "assign",
      label: "Assign",
      icon: Users,
      content: renderAssignPhotographersCard(),
    },
    {
      id: "requests",
      label: "Requests",
      icon: MessageCircle,
      content: renderPendingReviewsCard(),
    },
    {
      id: "pipeline",
      label: "Pipeline",
      icon: KanbanSquare,
      content: renderPipelineSection(),
    },
  ] as const;

  const adminDesktopContent = (
    <>
      {/* Requested shoots section at top, then Upcoming Shoots below */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-start">
        <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6 md:sticky md:top-6 h-full order-1 md:order-none">
          <div className="order-1 md:order-none">
            <RoleMetricTilesCard tiles={adminMetricTiles} />
          </div>
          <div id="assign-card" className="flex-1 min-h-0 flex flex-col hidden md:flex order-3 md:order-none">
            {renderAssignPhotographersCard()}
          </div>
        </div>

        <div className="md:col-span-6 flex flex-col gap-4 sm:gap-6 h-full order-2 md:order-none">
          {/* Combined Shoots Card with Upcoming/Requested tabs */}
          {renderShootsTabsCard()}
        </div>

        <div className="lg:hidden order-3">{renderAssignPhotographersCard()}</div>

        <div className="md:col-span-3 flex flex-col gap-4 sm:gap-6 md:sticky md:top-6 h-full order-4 md:order-none">
          {renderPendingReviewsCard()}
          {renderCompletedShootsCard({ stretch: true })}
        </div>
      </div>

      {renderPipelineSection()}
    </>
  );

  const adminMobileContent = (
    <div className="space-y-4">
      <RoleMetricTilesCard tiles={adminMetricTiles} />
      <Tabs
        value={mobileDashboardTab}
        onValueChange={(val) => setMobileDashboardTab(val as MobileDashboardTab)}
        className="space-y-2 flex-1 flex flex-col dashboard-mobile-tabs"
      >
        <div className="sticky top-[-0.75rem] z-20 pb-1 -mx-2 px-2 sm:-mx-3 sm:px-4" style={{ marginLeft: "-15px" }}>
          <div className="overflow-x-auto hidden-scrollbar">
            <TabsList className="inline-flex gap-2 rounded-full border border-border/50 bg-background/80 pl-1.5 pr-3 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/70">
              {mobileTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold tracking-tight transition-all duration-150 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground/80"
                >
                  <tab.icon className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
        {mobileTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="focus-visible:outline-none flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex flex-col min-h-0 pt-1">
              {tab.content}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );

  return (
    <div className="px-2 pt-3 pb-3 sm:p-6 flex flex-col min-h-full gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <PageHeader title={greetingTitle} description={DASHBOARD_DESCRIPTION} />
        </div>
        <div className="flex items-center gap-2 empty:hidden">
          <UploadStatusWidget />
          {cancellationRequestCount > 0 && (
            <button
              onClick={() => setCancellationDialogOpen(true)}
              className="flex-shrink-0 rounded-2xl border border-rose-200/80 dark:border-rose-800/40 bg-white dark:bg-card shadow-sm px-4 py-3 flex items-center gap-3 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-center h-9 w-9 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30">
                <span className="text-base font-bold text-rose-600 dark:text-rose-400">{cancellationRequestCount}</span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground leading-tight text-left">Cancellation{cancellationRequestCount !== 1 ? "s" : ""}<br />pending</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50 rounded-2xl text-sm text-rose-700 dark:text-rose-300">
          <p className="font-semibold mb-1">Error loading dashboard:</p>
          <p>{error}</p>
          <button
            onClick={() => refresh()}
            className="mt-2 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
      {!error && data && (!data.workflow || !Array.isArray(data.workflow.columns)) && (
        <div className="p-4 border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 rounded-2xl text-sm text-amber-700 dark:text-amber-300">
          <p>Workflow data is missing. <button onClick={() => refresh()} className="underline font-semibold">Refresh</button></p>
        </div>
      )}

      {isMobile ? adminMobileContent : adminDesktopContent}
    </div>
  );
};
