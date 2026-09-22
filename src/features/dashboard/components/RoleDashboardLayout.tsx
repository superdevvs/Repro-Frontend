import React from "react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardNoticeStack } from "@/components/dashboard/DashboardNoticeStack";
import { PendingReviewsCard } from "@/components/dashboard/v2/PendingReviewsCard";
import { RoleMetricTilesCard } from "@/components/dashboard/v2/RoleMetricTilesCard";
import { UpcomingShootsCard } from "@/components/dashboard/v2/UpcomingShootsCard";
import { UploadStatusWidget } from "@/components/dashboard/UploadStatusWidget";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

import type { RoleDashboardLayoutProps } from "../types";
import {
  DASHBOARD_MOBILE_PAGE_CLASS,
  DASHBOARD_MOBILE_TAB_LIST_CLASS,
  DASHBOARD_MOBILE_TAB_ROW_CLASS,
  DASHBOARD_MOBILE_TAB_TRIGGER_CLASS,
} from "../utils/dashboardMobilePanel";
import { DevProfiler } from "./DevProfiler";
import { CollapsibleColumnHandle } from "./CollapsibleColumnHandle";
import { useCollapsibleDashboardColumns } from "../hooks/useCollapsibleDashboardColumns";

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
  collapsibleColumns = false,
  pendingIndicatorCount = 0,
  mobileTab,
  onMobileTabChange,
  mobileTabs = [],
  metricsOnboardingTarget,
  upcomingOnboardingTarget,
  pendingOnboardingTarget,
  leftColumnOnboardingTarget,
}) => {
  const isCompactDashboardLayout = useMediaQuery("(max-width: 1024px)");

  const hasMetricTiles = Boolean(metricTiles && metricTiles.length > 0);
  const hasLeftColumnCard = Boolean(leftColumnCard);

  // The collapsible layout only makes sense when a left side column exists.
  const useCollapsibleLayout = collapsibleColumns && !hideLeftColumn && (hasMetricTiles || hasLeftColumnCard);
  const {
    isDesktopGrid,
    desktopGridTemplateColumns,
    effectiveLeftColumnHidden,
    effectiveRightColumnHidden,
    leftHandleSettling,
    rightHandleSettling,
    toggleLeftColumn,
    toggleRightColumn,
  } = useCollapsibleDashboardColumns({ hasLeftColumn: useCollapsibleLayout });
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
        <div className={cn(DASHBOARD_MOBILE_PAGE_CLASS, "p-3 sm:px-6 sm:pb-6 sm:pt-0 flex flex-col gap-4 sm:gap-6 max-lg:px-0 max-lg:pt-0", hideLeftColumn && "lg:min-h-[calc(100vh-4rem)]")}>
          <div className="contents md:flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="contents md:block md:flex-1">
              <PageHeader title={title} description={description} hideIntroOnMobile />
            </div>
            <DashboardNoticeStack label="Dashboard notices">
              <UploadStatusWidget />
            </DashboardNoticeStack>
          </div>
          {isCompactDashboardLayout && mobileTabs.length > 0 ? (
            // flex gap rather than space-y, and the tiles wrapper mirrors the card's
            // own `hidden sm:flex`: on phones the card is display:none, and space-y
            // still handed the tabs a 16px margin for that empty wrapper.
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden sm:gap-4">
              {hasMetricTiles ? (
                <div data-onboarding-target={metricsOnboardingTarget} className="hidden sm:block">
                  <RoleMetricTilesCard tiles={metricTiles} />
                </div>
              ) : null}
              <Tabs {...mobileTabsProps} className="flex min-h-0 flex-1 flex-col space-y-2 overflow-hidden dashboard-mobile-tabs">
                <div
                  className="sticky top-[-0.375rem] -mt-1.5 pt-1.5 z-20 pb-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
                >
                  <div className={DASHBOARD_MOBILE_TAB_ROW_CLASS}>
                    <TabsList className={cn(DASHBOARD_MOBILE_TAB_LIST_CLASS, "bg-muted/30")}>
                      {mobileTabs.map((tab) => (
                        <TabsTrigger
                          key={tab.id}
                          value={tab.id}
                          className={DASHBOARD_MOBILE_TAB_TRIGGER_CLASS}
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
                  className="focus-visible:outline-none flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-1">
                    {tab.content}
                  </div>
                </TabsContent>
              ))}
              </Tabs>
            </div>
          ) : useCollapsibleLayout ? (
            <div
              style={isDesktopGrid ? { gridTemplateColumns: desktopGridTemplateColumns, columnGap: 0 } : undefined}
              className="relative grid grid-cols-1 md:grid-cols-12 gap-y-4 gap-x-4 sm:gap-y-6 sm:gap-x-6 items-start transition-[grid-template-columns] duration-300 ease-out"
            >
              {/* Left column: metrics + left card (e.g. assign photographers) */}
              <div
                style={isDesktopGrid ? { gridColumn: "1 / 2" } : undefined}
                aria-hidden={effectiveLeftColumnHidden}
                data-onboarding-target={leftColumnOnboardingTarget}
                className={cn(
                  "md:col-span-3 min-[1025px]:col-start-1 min-[1025px]:col-end-2 flex flex-col gap-4 sm:gap-6 md:sticky md:top-6 h-full order-1 md:order-none min-w-0 overflow-hidden transition-opacity duration-200 ease-out",
                  effectiveLeftColumnHidden && "pointer-events-none opacity-0",
                )}
              >
                {hasMetricTiles ? (
                  <div className="order-1 md:order-none" data-onboarding-target={metricsOnboardingTarget}>
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
                  <div className="flex-1 min-h-0 flex flex-col hidden md:flex order-3 md:order-none">
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

              {/* Center column: upcoming shoots + collapse handles */}
              <div
                style={isDesktopGrid ? { gridColumn: "3 / 4" } : undefined}
                data-onboarding-target={upcomingOnboardingTarget}
                className={cn(
                  "relative flex flex-col gap-4 sm:gap-6 h-full order-2 md:order-none min-w-0 min-[1025px]:col-start-3 min-[1025px]:col-end-4",
                  // The grid is `items-start`, so without this the column is only as
                  // tall as its content: an empty or short shoots list leaves a hole
                  // beside the taller side columns. Stretching the column lets the
                  // card fill it and reach the same bottom edge as the side panels.
                  "md:self-stretch",
                  effectiveLeftColumnHidden && effectiveRightColumnHidden
                    ? "md:col-span-12 min-[1025px]:col-span-1"
                    : effectiveLeftColumnHidden || effectiveRightColumnHidden
                      ? "md:col-span-9 min-[1025px]:col-span-1"
                      : "md:col-span-6 min-[1025px]:col-span-1",
                )}
              >
                <CollapsibleColumnHandle
                  side="left"
                  hidden={effectiveLeftColumnHidden}
                  settling={leftHandleSettling}
                  onToggle={toggleLeftColumn}
                />
                <CollapsibleColumnHandle
                  side="right"
                  hidden={effectiveRightColumnHidden}
                  settling={rightHandleSettling}
                  onToggle={toggleRightColumn}
                  indicatorCount={pendingIndicatorCount}
                />
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

              {/* Left card on mobile, appears after upcoming shoots */}
              {hasLeftColumnCard ? (
                <div className="md:hidden order-3">
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

              {/* Right column: requests + extra cards (e.g. delivered shoots) */}
              <div
                style={isDesktopGrid ? { gridColumn: "5 / 6" } : undefined}
                aria-hidden={effectiveRightColumnHidden}
                className={cn(
                  "md:col-span-3 min-[1025px]:col-start-5 min-[1025px]:col-end-6 flex flex-col gap-4 sm:gap-6 md:sticky md:top-6 h-full order-4 md:order-none min-w-0 overflow-hidden transition-opacity duration-200 ease-out",
                  effectiveRightColumnHidden && "pointer-events-none opacity-0",
                )}
              >
                <div data-onboarding-target={pendingOnboardingTarget}>
                  <ErrorBoundary
                    fallback={
                      <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                        Unable to load pending reviews
                      </div>
                    }
                  >
                    {pendingContent}
                  </ErrorBoundary>
                </div>
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
          ) : (
          <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch", hideLeftColumn && "flex-1")}>
          {!hideLeftColumn && (hasMetricTiles || hasLeftColumnCard) && (
          <div
            className="lg:col-span-3 flex flex-col gap-4 sm:gap-6 h-full order-1 lg:order-none"
            data-onboarding-target={leftColumnOnboardingTarget}
          >
              {hasMetricTiles ? (
                <div className="order-1 lg:order-none" data-onboarding-target={metricsOnboardingTarget}>
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
            <div
              className={cn("flex flex-col h-full order-2 lg:order-none", hideLeftColumn ? "lg:col-span-9" : "lg:col-span-6")}
              data-onboarding-target={upcomingOnboardingTarget}
            >
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
            <div data-onboarding-target={pendingOnboardingTarget}>
              <ErrorBoundary
                fallback={
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Unable to load pending reviews
                  </div>
                }
              >
                {pendingContent}
              </ErrorBoundary>
            </div>
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
