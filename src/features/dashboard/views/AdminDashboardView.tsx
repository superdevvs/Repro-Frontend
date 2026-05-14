import React from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Camera, CheckCircle2, KanbanSquare, MessageCircle, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { UploadStatusWidget } from "@/components/dashboard/UploadStatusWidget";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleMetricTilesCard, type DashboardMetricTile } from "@/components/dashboard/v2/RoleMetricTilesCard";
import { cn } from "@/lib/utils";
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
  requestIndicatorCount: number;
  refresh: () => void | Promise<void>;
  renderAssignPhotographersCard: () => React.ReactNode;
  renderCompletedShootsCard: (options?: { stretch?: boolean; titleLeading?: React.ReactNode }) => React.ReactNode;
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
  requestIndicatorCount,
  refresh,
  renderAssignPhotographersCard,
  renderCompletedShootsCard,
  renderPendingReviewsCard,
  renderPipelineSection,
  renderShootsTabsCard,
  setCancellationDialogOpen,
  setMobileDashboardTab,
}: AdminDashboardViewProps) => {
  const [leftColumnHidden, setLeftColumnHidden] = React.useState(false);
  const [rightColumnHidden, setRightColumnHidden] = React.useState(false);
  const hasRequestIndicator = requestIndicatorCount > 0;

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
      <LayoutGroup>
        <motion.div
          layout
          transition={{ layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }}
          className={cn(
            "relative grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-start",
            leftColumnHidden && rightColumnHidden
              ? "xl:grid-cols-1"
              : leftColumnHidden
                ? "xl:grid-cols-[minmax(0,1fr)_320px]"
                : rightColumnHidden
                  ? "xl:grid-cols-[320px_minmax(0,1fr)]"
                  : "xl:grid-cols-[320px_minmax(0,1fr)_320px]"
          )}
        >
        <AnimatePresence initial={false}>
          {!leftColumnHidden && (
        <motion.div
          key="admin-left-column"
          layout
          initial={{ opacity: 0, x: -24, scale: 0.98, filter: "blur(6px)" }}
          animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: -14, transition: { duration: 0.18, ease: "easeOut" } }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }}
          className="md:col-span-3 xl:col-span-1 flex flex-col gap-4 sm:gap-6 md:sticky md:top-6 h-full order-1 md:order-none"
        >
          <div className="order-1 md:order-none">
            <RoleMetricTilesCard tiles={adminMetricTiles} />
          </div>
          <div id="assign-card" className="flex-1 min-h-0 flex flex-col hidden md:flex order-3 md:order-none">
            {renderAssignPhotographersCard()}
          </div>
        </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          layout
          transition={{ layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }}
          className={cn(
            "flex flex-col gap-4 sm:gap-6 h-full order-2 md:order-none min-w-0",
            leftColumnHidden && rightColumnHidden
              ? "md:col-span-12 xl:col-span-1"
              : leftColumnHidden || rightColumnHidden
                ? "md:col-span-9 xl:col-span-1"
                : "md:col-span-6 xl:col-span-1"
          )}
        >
          <div
            className={cn(
              "group/left-handle absolute bottom-0 top-0 z-10 hidden w-6 items-start justify-center pt-2 md:flex",
              leftColumnHidden ? "-left-7" : "left-[calc(25%-0.75rem)] xl:left-[320px]"
            )}
          >
            <button
              type="button"
              aria-label={leftColumnHidden ? "Show left dashboard column" : "Hide left dashboard column"}
              onClick={() => setLeftColumnHidden((hidden) => !hidden)}
              className="pointer-events-auto flex h-16 w-6 translate-y-0 items-center justify-center rounded-full border border-primary/25 bg-background/95 text-primary opacity-0 shadow-lg shadow-primary/10 backdrop-blur transition-opacity duration-150 group-hover/left-handle:opacity-100"
            >
              <span
                aria-hidden
                className={cn(
                  "h-0 w-0 border-y-[7px] border-y-transparent",
                  leftColumnHidden ? "border-l-[9px] border-l-current" : "border-r-[9px] border-r-current"
                )}
              />
            </button>
          </div>
          <div
            className={cn(
              "group/right-handle absolute bottom-0 top-0 z-10 hidden w-6 items-start justify-center pt-2 md:flex",
              rightColumnHidden ? "-right-7" : "right-[calc(25%-0.75rem)] xl:right-[320px]"
            )}
          >
            {hasRequestIndicator && (
              <span className="pointer-events-none absolute left-1/2 top-5 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-primary-foreground shadow-lg shadow-primary/30 opacity-0 transition-opacity duration-150 group-hover/right-handle:opacity-100">
                {requestIndicatorCount > 9 ? '9+' : requestIndicatorCount}
              </span>
            )}
            <button
              type="button"
              aria-label={rightColumnHidden ? "Show right dashboard column" : "Hide right dashboard column"}
              onClick={() => setRightColumnHidden((hidden) => !hidden)}
              className="pointer-events-auto mt-9 flex h-16 w-6 items-center justify-center rounded-full border border-primary/25 bg-background/95 text-primary opacity-0 shadow-lg shadow-primary/10 backdrop-blur transition-opacity duration-150 group-hover/right-handle:opacity-100"
            >
              <span
                aria-hidden
                className={cn(
                  "h-0 w-0 border-y-[7px] border-y-transparent",
                  rightColumnHidden ? "border-r-[9px] border-r-current" : "border-l-[9px] border-l-current"
                )}
              />
            </button>
          </div>
          {/* Combined Shoots Card with Upcoming/Requested tabs */}
          {renderShootsTabsCard()}
        </motion.div>

        <div className="lg:hidden order-3">{renderAssignPhotographersCard()}</div>

        <AnimatePresence initial={false}>
          {!rightColumnHidden && (
        <motion.div
          key="admin-right-column"
          layout
          initial={{ opacity: 0, x: 24, scale: 0.98, filter: "blur(6px)" }}
          animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: 14, transition: { duration: 0.18, ease: "easeOut" } }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }}
          className="md:col-span-3 xl:col-span-1 flex flex-col gap-4 sm:gap-6 md:sticky md:top-6 h-full order-4 md:order-none"
        >
          {renderPendingReviewsCard()}
          {renderCompletedShootsCard({ stretch: true })}
        </motion.div>
          )}
        </AnimatePresence>
        </motion.div>
      </LayoutGroup>

      {renderPipelineSection()}
    </>
  );

  const adminMobileContent = (
    <div className="space-y-2 sm:space-y-4">
      <RoleMetricTilesCard tiles={adminMetricTiles} />
      <Tabs
        value={mobileDashboardTab}
        onValueChange={(val) => setMobileDashboardTab(val as MobileDashboardTab)}
        className="space-y-2 flex-1 flex flex-col dashboard-mobile-tabs"
      >
        <div className="sticky top-[-0.75rem] z-20 pb-1 -mx-2 px-2 sm:-mx-3 sm:px-4">
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
    <div className="px-2 pt-1.5 pb-3 sm:px-6 sm:pb-6 sm:pt-0 flex flex-col min-h-full gap-2.5 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
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
