import type { Role } from '@/components/auth/AuthProvider';

export type InsightRole = Extract<Role, 'client' | 'photographer' | 'editor' | 'salesRep'>;

export const INSIGHT_ROLE_OPTIONS: {
  value: InsightRole;
  tabLabel: string;
  headline: string;
  description: string;
  metric: 'bookings' | 'deliveries';
}[] = [
  {
    value: 'client',
    tabLabel: 'Clients',
    headline: 'Client Momentum',
    description: 'Month-to-date delivery and booking activity by client.',
    metric: 'deliveries',
  },
  {
    value: 'photographer',
    tabLabel: 'Photographers',
    headline: 'Photographer Momentum',
    description: 'Month-to-date coverage and schedules driven by photographers.',
    metric: 'bookings',
  },
  {
    value: 'editor',
    tabLabel: 'Editing',
    headline: 'Editing Flow',
    description: 'Month-to-date edit completions and delivery readiness.',
    metric: 'bookings',
  },
  {
    value: 'salesRep',
    tabLabel: 'Sales',
    headline: 'Sales Reach',
    description: 'Month-to-date account touchpoints and shoots sourced by sales.',
    metric: 'bookings',
  },
];

export const INSIGHT_ROLE_VALUES = INSIGHT_ROLE_OPTIONS.map((option) => option.value);
