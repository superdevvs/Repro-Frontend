import React, { Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";

import { UpcomingShootsCard } from "@/components/dashboard/v2/UpcomingShootsCard";
import { CompletedShootsCardSkeleton } from "@/components/dashboard/v2/CompletedShootsCardSkeleton";
import type { WeatherInfo } from "@/services/weatherService";
import type { DashboardShootSummary } from "@/types/dashboard";

import { RoleDashboardLayout } from "../components/RoleDashboardLayout";

const LazyCompletedShootsCard = lazy(() =>
  import("@/components/dashboard/v2/CompletedShootsCard").then((module) => ({
    default: module.CompletedShootsCard,
  })),
);

interface PhotographerDashboardViewProps {
  greetingTitleFullName: React.ReactNode;
  photographerDelivered: DashboardShootSummary[];
  photographerPendingReviews: DashboardShootSummary[];
  photographerUpcoming: DashboardShootSummary[];
  shootDetailsModal: React.ReactNode;
  onSelectShoot: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
}

export const PhotographerDashboardView = ({
  greetingTitleFullName,
  photographerDelivered,
  photographerPendingReviews,
  photographerUpcoming,
  shootDetailsModal,
  onSelectShoot,
}: PhotographerDashboardViewProps) => {
  const navigate = useNavigate();
  const photographerMobileTabs = [
    {
      id: "shoots",
      label: "Shoots",
      content: (
        <UpcomingShootsCard
          shoots={photographerUpcoming}
          onSelect={(shoot, weather) => onSelectShoot(shoot, weather)}
          role="photographer"
        />
      ),
    },
    {
      id: "completed",
      label: "Completed",
      content: (
        <Suspense fallback={<CompletedShootsCardSkeleton />}>
          <LazyCompletedShootsCard
            shoots={photographerDelivered}
            title="Completed shoots"
            subtitle="Ready for clients"
            emptyStateText="No completed shoots yet."
            onViewAll={() => navigate("/shoot-history?tab=delivered")}
          />
        </Suspense>
      ),
    },
  ] as const;

  return (
    <>
      <RoleDashboardLayout
        title={greetingTitleFullName}
        description="Field schedule, uploads, and delivery milestones."
        hideLeftColumn
        leftColumnCard={null}
        rightColumnCards={[
          <Suspense key="completed-shoots" fallback={<CompletedShootsCardSkeleton />}>
            <LazyCompletedShootsCard
              shoots={photographerDelivered}
              title="Completed shoots"
              subtitle="Ready for clients"
              emptyStateText="No completed shoots yet."
              onViewAll={() => navigate("/shoot-history?tab=delivered")}
            />
          </Suspense>,
        ]}
        upcomingShoots={photographerUpcoming}
        pendingReviews={photographerPendingReviews}
        pendingCard={null}
        onSelectShoot={onSelectShoot}
        role="photographer"
        mobileTabs={photographerMobileTabs.map((tab) => ({ ...tab }))}
      />
      {shootDetailsModal}
    </>
  );
};
