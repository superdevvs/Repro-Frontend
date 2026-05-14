import React from "react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PendingReviewsCard } from "@/components/dashboard/v2/PendingReviewsCard";
import { RoleMetricTilesCard } from "@/components/dashboard/v2/RoleMetricTilesCard";
import { UpcomingShootsCard } from "@/components/dashboard/v2/UpcomingShootsCard";
import { UploadStatusWidget } from "@/components/dashboard/UploadStatusWidget";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

import type { RoleDashboardLayoutProps } from "../types";
import { DevProfiler } from "./DevProfiler";

export const RoleDashboardLayout: React.FC<RoleDashboardLayoutProps> = ({
  title,
  description,
  metricTiles,
  leftColumnCard,
  rightColumnCards = [],
  upcomingShoots,
  pendingReviews,
  onSelectShoot,
  upcomingTitle,
  upcomingSubtitle,
  upcomingEmptyStateText,
  upcomingDefaultShowPastDays,
  pendingCard,
  pendingTitle = "Requests",
  emptyPendingText = "No active requests.",
  role,
  hideLeftColumn = false,
  mobileTab,
  onMobileTabChange,
  mobileTabs = [],
}) => {
  const isCompactDashboardLayout = useMediaQuery("(max-width: 1024px)");

  const hasMetricTiles = Boolean(metricTiles && metricTiles.length > 0);
  const hasLeftColumnCard = Boolean(leftColumnCard);
  const mobileTabsProps =
    mobileTab !== undefined
      ? {
          value: mobileTab,
          onValueChange: onMobileTabChange,
        }
      : {
          defaultValue: mobileTabs[0]?.id,
        };
  const pendingContent =
    pendingCard ||
    (
      <PendingReviewsCard
        title={pendingTitle}
        reviews={pendingReviews}
        issues={[]}
        onSelect={onSelectShoot}
        emptyRequestsText={emptyPendingText}
      />
    );

  return (
    <DevProfiler id={`RoleDashboardLayout:${role ?? "default"}`}>
      <DashboardLayout>
        <div className={cn("p-3 sm:px-6 sm:pb-6 sm:pt-0 flex flex-col gap-4 sm:gap-6", hideLeftColumn && "min-h-[calc(100vh-4rem)]")}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <PageHeader title={title} description={description} />
            </div>
            <div className="flex items-center gap-2 empty:hidden">
              <UploadStatusWidget />
            </div>
          </div>
          {isCompactDashboardLayout && mobileTabs.length > 0 ? (
            <div className="space-y-4 flex-1 flex flex-col">
              {hasMetricTiles ? (
                <RoleMetricTilesCard tiles={metricTiles} />
              ) : null}
              <Tabs {...mobileTabsProps} className="space-y-2 flex-1 flex flex-col dashboard-mobile-tabs">
                <div
                  className="sticky top-[-0.25rem] z-20 pb-1 -mx-2 px-2 sm:-mx-3 sm:px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
                >
                  <div className="overflow-x-auto hidden-scrollbar">
                    <TabsList className="inline-flex gap-2 rounded-full border border-border/50 bg-muted/30 pl-1.5 pr-3 py-1.5">
                      {mobileTabs.map((tab) => (
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
              {mobileTabs.map((tab) => (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="focus-visible:outline-none flex-1 flex flex-col min-h-0"
                >
                  <div className="flex-1 flex flex-col min-h-0 pt-1">
                    {tab.content}
                  </div>
                </TabsContent>
              ))}
              </Tabs>
            </div>
          ) : (
          <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch", hideLeftColumn && "flex-1")}>
          {!hideLeftColumn && (hasMetricTiles || hasLeftColumnCard) && (
          <div className="lg:col-span-3 flex flex-col gap-4 sm:gap-6 h-full order-1 lg:order-none">
              {hasMetricTiles ? (
                <div className="order-1 lg:order-none">
                  <ErrorBoundary
                    fallback={
                      <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                        Unable to load dashboard overview
                      </div>
                    }
                  >
                    <RoleMetricTilesCard tiles={metricTiles} />
                  </ErrorBoundary>
                </div>
              ) : null}
              {hasLeftColumnCard ? (
                <div className="flex-1 min-h-0 flex flex-col hidden lg:flex order-3 lg:order-none">
                  <ErrorBoundary
                    fallback={
                      <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                        Unable to load card
                      </div>
                    }
                  >
                    {leftColumnCard}
                  </ErrorBoundary>
                </div>
              ) : null}
            </div>
          )}
            <div className={cn("flex flex-col h-full order-2 lg:order-none", hideLeftColumn ? "lg:col-span-9" : "lg:col-span-6")}>
              <ErrorBoundary
                fallback={
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Unable to load upcoming shoots
                  </div>
                }
              >
                <UpcomingShootsCard 
                  shoots={upcomingShoots} 
                  onSelect={(shoot, weather) => onSelectShoot(shoot, weather)}
                  role={role}
                  title={upcomingTitle}
                  subtitle={upcomingSubtitle}
                  emptyStateText={upcomingEmptyStateText}
                  defaultShowPastDays={upcomingDefaultShowPastDays}
                />
              </ErrorBoundary>
            </div>
            {/* Left Column Card - Mobile only, appears after Upcoming Shoots */}
            {!hideLeftColumn && hasLeftColumnCard && (
            <div className="lg:hidden order-3">
              <ErrorBoundary
                fallback={
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Unable to load card
                  </div>
                }
              >
                {leftColumnCard}
              </ErrorBoundary>
            </div>
            )}
          <div className="lg:col-span-3 flex flex-col gap-4 sm:gap-6 h-full order-4 lg:order-none">
            <ErrorBoundary
              fallback={
                <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Unable to load pending reviews
                </div>
              }
            >
              {pendingContent}
            </ErrorBoundary>
            {rightColumnCards
              .filter((card): card is React.ReactNode => Boolean(card))
              .map((card, index) => (
                <ErrorBoundary
                  key={index}
                  fallback={
                    <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      Unable to load card
                    </div>
                  }
                >
                  {card}
                </ErrorBoundary>
              ))}
            </div>
          </div>
          )}
        </div>
      </DashboardLayout>
    </DevProfiler>
  );
};
