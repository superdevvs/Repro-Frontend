import React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/auth";
import { cn } from "@/lib/utils";

import { DashboardOnboarding } from "../components/DashboardOnboarding";
import { CollapsibleColumnHandle } from "../components/CollapsibleColumnHandle";
import { dashboardOnboardingConfig } from "../config/dashboardOnboardingConfig";
import { useDashboardOnboarding } from "../hooks/useDashboardOnboarding";
import { useCollapsibleDashboardColumns } from "../hooks/useCollapsibleDashboardColumns";
import type { MobileEditingManagerTab } from "../types";

interface EditingManagerDashboardViewProps {
  isMobile: boolean;
  mobileEditingManagerTab: MobileEditingManagerTab;
  renderEditingManagerReadyToDeliverCard: () => React.ReactNode;
  renderEditingManagerShootsTabsCard: () => React.ReactNode;
  renderPendingReviewsCard: () => React.ReactNode;
  renderPipelineSection: () => React.ReactNode;
  setMobileEditingManagerTab: (tab: MobileEditingManagerTab) => void;
}

// The editing manager layout only goes side-by-side at the xl breakpoint, so
// the collapsible side column should only activate from that width up.
const EDITING_MANAGER_DESKTOP_MIN_WIDTH = 1280;

export const EditingManagerDashboardView = ({
  isMobile,
  mobileEditingManagerTab,
  renderEditingManagerReadyToDeliverCard,
  renderEditingManagerShootsTabsCard,
  renderPendingReviewsCard,
  renderPipelineSection,
  setMobileEditingManagerTab,
}: EditingManagerDashboardViewProps) => {
  const { user } = useAuth();
  const onboarding = useDashboardOnboarding(user, "editing_manager");
  const {
    isDesktopGrid,
    desktopGridTemplateColumns,
    effectiveRightColumnHidden,
    rightHandleSettling,
    toggleRightColumn,
  } = useCollapsibleDashboardColumns({
    hasLeftColumn: false,
    desktopMinWidth: EDITING_MANAGER_DESKTOP_MIN_WIDTH,
  });

  const editingManagerContent = (
    <>
      <div
        style={isDesktopGrid ? { gridTemplateColumns: desktopGridTemplateColumns, columnGap: 0 } : undefined}
        className="relative grid h-full grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 items-stretch flex-1 min-h-0 transition-[grid-template-columns] duration-300 ease-out"
      >
        <div
          style={isDesktopGrid ? { gridColumn: "3 / 4" } : undefined}
          className="relative xl:col-span-9 min-[1280px]:col-span-1 flex h-full flex-1 flex-col gap-4 sm:gap-6 min-h-0 min-w-0"
        >
          {isDesktopGrid && (
            <CollapsibleColumnHandle
              side="right"
              hidden={effectiveRightColumnHidden}
              settling={rightHandleSettling}
              onToggle={toggleRightColumn}
            />
          )}
          <div
            data-onboarding-target="editingmanager-shoots"
            className="flex h-full flex-1 flex-col min-h-0 min-w-0"
          >
            {renderEditingManagerShootsTabsCard()}
          </div>
        </div>
        <div
          style={isDesktopGrid ? { gridColumn: "5 / 6" } : undefined}
          aria-hidden={isDesktopGrid && effectiveRightColumnHidden}
          className={cn(
            "xl:col-span-3 min-[1280px]:col-span-1 flex flex-col gap-4 sm:gap-6 xl:sticky xl:top-6 min-w-0 overflow-hidden transition-opacity duration-200 ease-out",
            isDesktopGrid && effectiveRightColumnHidden && "pointer-events-none opacity-0",
          )}
        >
          <div data-onboarding-target="editingmanager-requests">
            {renderPendingReviewsCard()}
          </div>
          <div data-onboarding-target="editingmanager-ready">
            {renderEditingManagerReadyToDeliverCard()}
          </div>
        </div>
      </div>
      <div data-onboarding-target="editingmanager-pipeline">
        {renderPipelineSection()}
      </div>
    </>
  );

  const editingManagerMobileTabs = [
    {
      id: "shoots" as const,
      label: "Shoots",
      content: (
        <div data-onboarding-target="editingmanager-shoots" className="flex flex-1 flex-col min-h-0">
          {renderEditingManagerShootsTabsCard()}
        </div>
      ),
    },
    {
      id: "requests" as const,
      label: "Requests",
      content: (
        <div data-onboarding-target="editingmanager-requests">
          {renderPendingReviewsCard()}
        </div>
      ),
    },
    {
      id: "ready" as const,
      label: "Ready",
      content: (
        <div data-onboarding-target="editingmanager-ready">
          {renderEditingManagerReadyToDeliverCard()}
        </div>
      ),
    },
    {
      id: "pipeline" as const,
      label: "Pipeline",
      content: (
        <div data-onboarding-target="editingmanager-pipeline">
          {renderPipelineSection()}
        </div>
      ),
    },
  ] as const;

  const editingManagerMobileContent = (
    <Tabs
      value={mobileEditingManagerTab}
      onValueChange={(val) => setMobileEditingManagerTab(val as MobileEditingManagerTab)}
      className="space-y-2 flex-1 flex flex-col dashboard-mobile-tabs"
    >
      <div className="sticky top-[-0.25rem] z-20 pb-1 -mx-2 px-2 sm:-mx-3 sm:px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80" style={{ marginLeft: "-15px" }}>
        <div className="overflow-x-auto hidden-scrollbar">
          <TabsList className="inline-flex gap-2 rounded-full border border-border/50 bg-muted/30 pl-1.5 pr-3 py-1.5">
            {editingManagerMobileTabs.map((tab) => (
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
      {editingManagerMobileTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="focus-visible:outline-none flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col min-h-0 pt-1">
            {tab.content}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );

  return (
    <>
      {isMobile ? editingManagerMobileContent : editingManagerContent}
      <DashboardOnboarding
        roleKey="editing_manager"
        steps={dashboardOnboardingConfig.editing_manager.steps}
        copy={dashboardOnboardingConfig.editing_manager.copy}
        welcomeOpen={onboarding.welcomeOpen}
        tourOpen={onboarding.tourOpen}
        isMobile={isMobile}
        currentMobileTab={mobileEditingManagerTab}
        lastStep={onboarding.onboardingState.lastStep}
        onStart={onboarding.startTour}
        onDismiss={onboarding.dismiss}
        onComplete={(lastStep) => onboarding.complete({ lastStep })}
        onProgress={onboarding.saveProgress}
        onReplay={onboarding.replay}
        onSetMobileTab={(tab) => setMobileEditingManagerTab(tab as MobileEditingManagerTab)}
        onStepView={onboarding.recordStepView}
        onStepBack={onboarding.recordStepBack}
        onHelpOpened={onboarding.recordHelpOpened}
        onHelpMessage={onboarding.recordHelpMessage}
      />
    </>
  );
};
