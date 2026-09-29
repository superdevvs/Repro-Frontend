import React from "react";

import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { Camera, CheckCircle2, KanbanSquare, MessageCircle } from "lucide-react";
import { useAuth } from "@/components/auth";
import { cn } from "@/lib/utils";

import { DashboardOnboarding } from "../components/DashboardOnboarding";
import { CollapsibleColumnHandle } from "../components/CollapsibleColumnHandle";
import { dashboardOnboardingConfig } from "../config/dashboardOnboardingConfig";
import { useDashboardOnboarding } from "../hooks/useDashboardOnboarding";
import { useCollapsibleDashboardColumns } from "../hooks/useCollapsibleDashboardColumns";
import type { MobileEditingManagerTab } from "../types";
import {
  DASHBOARD_MOBILE_SECTION_PANEL_INNER_CLASS,
  DASHBOARD_MOBILE_SECTION_TABS_CLASS,
  DASHBOARD_MOBILE_SECTION_TABS_STICKY_CLASS,
  DASHBOARD_MOBILE_TAB_LIST_CLASS,
  DASHBOARD_MOBILE_TAB_ROW_CLASS,
} from "../utils/dashboardMobilePanel";
import { DashboardMobileTabTrigger } from "../components/DashboardMobileTabTrigger";

interface EditingManagerDashboardViewProps {
  isMobile: boolean;
  mobileEditingManagerTab: MobileEditingManagerTab;
  pipelineCount: number;
  readyCount: number;
  renderEditingManagerReadyToDeliverCard: () => React.ReactNode;
  renderEditingManagerShootsTabsCard: () => React.ReactNode;
  renderPendingReviewsCard: () => React.ReactNode;
  renderPipelineSection: () => React.ReactNode;
  requestCount: number;
  setMobileEditingManagerTab: (tab: MobileEditingManagerTab) => void;
  shootsCount: number;
}

// The editing manager layout only goes side-by-side at the xl breakpoint, so
// the collapsible side column should only activate from that width up.
const EDITING_MANAGER_DESKTOP_MIN_WIDTH = 1280;

export const EditingManagerDashboardView = ({
  isMobile,
  mobileEditingManagerTab,
  pipelineCount,
  readyCount,
  renderEditingManagerReadyToDeliverCard,
  renderEditingManagerShootsTabsCard,
  renderPendingReviewsCard,
  renderPipelineSection,
  requestCount,
  setMobileEditingManagerTab,
  shootsCount,
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
      icon: Camera,
      count: shootsCount,
      content: (
        <div data-onboarding-target="editingmanager-shoots" className="flex flex-1 flex-col min-h-0">
          {renderEditingManagerShootsTabsCard()}
        </div>
      ),
    },
    {
      id: "requests" as const,
      label: "Requests",
      icon: MessageCircle,
      count: requestCount,
      content: (
        <div data-onboarding-target="editingmanager-requests" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {renderPendingReviewsCard()}
        </div>
      ),
    },
    {
      id: "ready" as const,
      label: "Ready",
      icon: CheckCircle2,
      count: readyCount,
      content: (
        <div data-onboarding-target="editingmanager-ready" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {renderEditingManagerReadyToDeliverCard()}
        </div>
      ),
    },
    {
      id: "pipeline" as const,
      label: "Pipeline",
      icon: KanbanSquare,
      count: pipelineCount,
      content: (
        <div data-onboarding-target="editingmanager-pipeline" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {renderPipelineSection()}
        </div>
      ),
    },
  ] as const;

  const editingManagerMobileContent = (
    <Tabs
      value={mobileEditingManagerTab}
      onValueChange={(val) => setMobileEditingManagerTab(val as MobileEditingManagerTab)}
      className={DASHBOARD_MOBILE_SECTION_TABS_CLASS}
    >
      <div className={DASHBOARD_MOBILE_SECTION_TABS_STICKY_CLASS}>
        <div className={DASHBOARD_MOBILE_TAB_ROW_CLASS}>
          <TabsList className={cn(DASHBOARD_MOBILE_TAB_LIST_CLASS, "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70")}>
            {editingManagerMobileTabs.map((tab) => (
              <DashboardMobileTabTrigger
                key={tab.id}
                value={tab.id}
                label={tab.label}
                icon={tab.icon}
                count={tab.count}
              />
            ))}
          </TabsList>
        </div>
      </div>
      {editingManagerMobileTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="focus-visible:outline-none flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={DASHBOARD_MOBILE_SECTION_PANEL_INNER_CLASS}>
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
