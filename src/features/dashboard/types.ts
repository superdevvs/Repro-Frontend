import type React from "react";

import type { DashboardMetricTile } from "@/components/dashboard/v2/RoleMetricTilesCard";
import type { WeatherInfo } from "@/services/weatherService";
import type { UserRole } from "@/types/auth";
import type { ClientBillingSummary } from "@/types/clientBilling";
import type { DashboardShootModalTab, DashboardShootSummary } from "@/types/dashboard";
import type { ClientShootRecord } from "@/utils/dashboardDerivedUtils";

export type MobileDashboardTab = "shoots" | "assign" | "requests" | "completed" | "pipeline";
export type MobileClientDashboardTab = "shoots" | "invoices" | "actions";
export type MobileEditingManagerTab = "shoots" | "requests" | "ready" | "pipeline";

export type CommandBarState = {
  openRequestManager?: boolean;
  selectedRequestId?: string | null;
  openEditingRequest?: boolean;
  editingRequestId?: number | null;
};

export type OpenShootInModalOptions = {
  initialTab?: DashboardShootModalTab;
  missingToast?: { title: string; description: string } | null;
  authToast?: { title: string; description: string } | null;
  onMissing?: () => void;
};

export interface RoleDashboardLayoutProps {
  title: React.ReactNode;
  description: string;
  metricTiles?: DashboardMetricTile[];
  leftColumnCard: React.ReactNode;
  rightColumnCards?: React.ReactNode[];
  upcomingShoots: DashboardShootSummary[];
  pendingReviews: DashboardShootSummary[];
  onSelectShoot: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
  upcomingTitle?: string;
  upcomingSubtitle?: string;
  upcomingEmptyStateText?: string;
  upcomingDefaultShowPastDays?: boolean;
  pendingCard?: React.ReactNode;
  pendingTitle?: string;
  emptyPendingText?: string;
  role?: UserRole;
  hideLeftColumn?: boolean;
  mobileTab?: string;
  onMobileTabChange?: (value: string) => void;
  mobileTabs?: Array<{
    id: string;
    label: string;
    content: React.ReactNode;
  }>;
}

export interface ClientMyShootsProps {
  upcoming: ClientShootRecord[];
  completed: ClientShootRecord[];
  onHold: ClientShootRecord[];
  currentUserId?: string | number | null;
  onSelect: (record: ClientShootRecord) => void;
  onReschedule: (record: ClientShootRecord) => void;
  onCancel: (record: ClientShootRecord) => void;
  onContactSupport: () => void;
  onDownload: (record: ClientShootRecord) => void;
  onRebook: (record: ClientShootRecord) => void;
  onRequestRevision: (record: ClientShootRecord) => void;
  onHoldAction: (record: ClientShootRecord) => void;
  onPayment: (record: ClientShootRecord) => void;
  onBookNewShoot: () => void;
}

export interface ClientShootTileProps {
  record: ClientShootRecord;
  variant: "upcoming" | "completed" | "hold";
  onSelect: (record: ClientShootRecord) => void;
  onReschedule: (record: ClientShootRecord) => void;
  onCancel: (record: ClientShootRecord) => void;
  onContactSupport: () => void;
  onDownload: (record: ClientShootRecord) => void;
  onRebook: (record: ClientShootRecord) => void;
  onRequestRevision: (record: ClientShootRecord) => void;
  onHoldAction: (record: ClientShootRecord) => void;
  onPayment?: (record: ClientShootRecord) => void;
}

export interface ClientInvoicesCardProps {
  summary: ClientBillingSummary;
  onViewAll: () => void;
  onPay: () => void;
}
