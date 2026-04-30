import React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export const EditingManagerDashboardView = ({
  isMobile,
  mobileEditingManagerTab,
  renderEditingManagerReadyToDeliverCard,
  renderEditingManagerShootsTabsCard,
  renderPendingReviewsCard,
  renderPipelineSection,
  setMobileEditingManagerTab,
}: EditingManagerDashboardViewProps) => {
  const editingManagerContent = (
    <>
      <div className="grid h-full grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 items-stretch flex-1 min-h-0">
        <div className="xl:col-span-9 flex h-full flex-1 flex-col gap-4 sm:gap-6 min-h-0 min-w-0">
          {renderEditingManagerShootsTabsCard()}
        </div>
        <div className="xl:col-span-3 flex flex-col gap-4 sm:gap-6 xl:sticky xl:top-6">
          {renderPendingReviewsCard()}
          {renderEditingManagerReadyToDeliverCard()}
        </div>
      </div>
      {renderPipelineSection()}
    </>
  );

  const editingManagerMobileTabs = [
    {
      id: "shoots" as const,
      label: "Shoots",
      content: renderEditingManagerShootsTabsCard(),
    },
    {
      id: "requests" as const,
      label: "Requests",
      content: renderPendingReviewsCard(),
    },
    {
      id: "ready" as const,
      label: "Ready",
      content: renderEditingManagerReadyToDeliverCard(),
    },
    {
      id: "pipeline" as const,
      label: "Pipeline",
      content: renderPipelineSection(),
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

  return isMobile ? editingManagerMobileContent : editingManagerContent;
};
