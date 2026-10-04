import type { ReactNode } from 'react';
import type { DashboardShootSummary } from '@/types/dashboard';
import type { WeatherInfo } from '@/services/weatherService';

export interface UpcomingShootsCardProps {
  shoots: DashboardShootSummary[];
  onSelect: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
  onApprove?: (shoot: DashboardShootSummary) => void;
  onDecline?: (shoot: DashboardShootSummary) => void;
  onModify?: (shoot: DashboardShootSummary) => void;
  onViewInvoice?: (shoot: DashboardShootSummary) => void;
  role?: string;
  title?: string;
  subtitle?: string;
  emptyStateText?: string;
  defaultShowPastDays?: boolean;
  beforeShoots?: ReactNode;
}
