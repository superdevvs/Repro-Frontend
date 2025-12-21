import {
  DashboardActivityItem,
  DashboardActivityResponse,
  DashboardIssueItem,
  DashboardIssueResponse,
  DashboardOverview,
  DashboardOverviewResponse,
  DashboardPhotographerResponse,
  DashboardPhotographerSummary,
  DashboardShootServiceTag,
  DashboardShootSummary,
  DashboardShootSummaryResponse,
  DashboardStats,
  DashboardWorkflow,
  DashboardWorkflowColumn,
  DashboardWorkflowColumnResponse,
  DashboardWorkflowResponse,
} from '@/types/dashboard';

const defaultTag = (label: string): DashboardShootServiceTag => ({
  label,
  type: 'primary',
});

const normalizeShoot = (shoot: DashboardShootSummaryResponse): DashboardShootSummary => ({
  id: shoot.id,
  dayLabel: shoot.day_label ?? 'Unscheduled',
  timeLabel: shoot.time_label ?? null,
  startTime: shoot.start_time ?? null,
  addressLine: shoot.address_line ?? 'No address on file',
  cityStateZip: shoot.city_state_zip ?? '',
  status: shoot.status ?? null,
  workflowStatus: shoot.workflow_status ?? null,
  clientName: shoot.client_name ?? null,
  clientId: shoot.client_id ?? null,
  temperature: shoot.temperature ?? null,
  services: (shoot.services && shoot.services.length > 0)
    ? shoot.services.map(tag => ({
        label: tag.label,
        type: tag.type,
      }))
    : [defaultTag('Standard Package')],
  photographer: shoot.photographer
    ? {
        id: shoot.photographer.id,
        name: shoot.photographer.name,
        avatar: shoot.photographer.avatar,
      }
    : null,
  isFlagged: Boolean(shoot.is_flagged),
  deliveryDeadline: shoot.delivery_deadline ?? null,
  submittedForReviewAt: shoot.submitted_for_review_at ?? null,
  adminIssueNotes: shoot.admin_issue_notes ?? null,
});

const normalizePhotographer = (
  photographer: DashboardPhotographerResponse,
): DashboardPhotographerSummary => ({
  id: photographer.id,
  name: photographer.name,
  region: photographer.region || 'Unassigned region',
  loadToday: photographer.load_today,
  availableFrom: photographer.available_from ?? null,
  nextSlot: photographer.next_slot ?? null,
  avatar: photographer.avatar ?? undefined,
  status: photographer.status,
  nextShootDistance: photographer.next_shoot_distance ?? undefined,
  email: photographer.email ?? undefined,
  phone: photographer.phone ?? undefined,
});

const normalizeActivity = (item: DashboardActivityResponse): DashboardActivityItem => ({
  id: item.id,
  message: item.message,
  action: item.action,
  type: item.type,
  timestamp: item.timestamp ?? null,
  userName: item.user?.name ?? null,
});

const normalizeIssue = (issue: DashboardIssueResponse): DashboardIssueItem => ({
  id: issue.id,
  message: issue.message,
  severity: issue.severity,
  status: issue.status,
  client: issue.client,
  updatedAt: issue.updated_at ?? null,
});

const normalizeWorkflowColumn = (
  column: DashboardWorkflowColumnResponse,
): DashboardWorkflowColumn => ({
  key: column.key,
  label: column.label,
  accent: column.accent,
  count: column.count,
  shoots: column.shoots.map(normalizeShoot),
});

const normalizeStats = (stats: DashboardOverviewResponse['stats']): DashboardStats => ({
  totalShoots: stats.total_shoots,
  scheduledToday: stats.scheduled_today,
  flaggedShoots: stats.flagged_shoots,
  pendingReviews: stats.pending_reviews,
});

const shootSortValue = (shoot: DashboardShootSummary) => {
  if (!shoot.startTime) return Number.MAX_SAFE_INTEGER;
  const ts = new Date(shoot.startTime).getTime();
  return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts;
};

const dedupeShoots = (shoots: DashboardShootSummary[]): DashboardShootSummary[] => {
  const map = new Map<number, DashboardShootSummary>();
  shoots.forEach((shoot) => {
    if (!map.has(shoot.id)) {
      map.set(shoot.id, shoot);
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    const diff = shootSortValue(a) - shootSortValue(b);
    if (diff !== 0 && Number.isFinite(diff)) return diff;
    return a.id - b.id;
  });
};

export const transformDashboardOverview = (
  response: DashboardOverviewResponse,
): DashboardOverview => {
  const workflow = {
    columns: response.workflow.columns.map(normalizeWorkflowColumn),
  };

  const normalizedUpcoming = response.upcoming_shoots.map(normalizeShoot);
  const workflowShoots = workflow.columns.flatMap((column) => column.shoots);
  const upcomingShoots = dedupeShoots([...normalizedUpcoming, ...workflowShoots]);

  return {
    stats: normalizeStats(response.stats),
    upcomingShoots,
    photographers: response.photographers.map(normalizePhotographer),
    pendingReviews: response.pending_reviews.map(normalizeShoot),
    activityLog: response.activity_log.map(normalizeActivity),
    issues: response.issues.map(normalizeIssue),
    workflow,
  };
};

