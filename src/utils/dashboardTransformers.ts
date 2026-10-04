import {
  DashboardActivityItem,
  DashboardActivityResponse,
  DashboardIssueItem,
  DashboardIssueResponse,
  DashboardOverview,
  DashboardOverviewResponse,
  DashboardPhotographerResponse,
  DashboardPhotographerSummary,
  DashboardShootSummary,
  DashboardShootSummaryResponse,
  DashboardStats,
  DashboardWorkflow,
  DashboardWorkflowColumn,
  DashboardWorkflowColumnResponse,
  DashboardWorkflowResponse,
} from '@/types/dashboard';
import { extractLocalYmd } from '@/utils/shootLocalDate';
import { streetWithAptSuite } from '@/utils/shootAddressDisplay';

const normalizeShoot = (shoot: DashboardShootSummaryResponse): DashboardShootSummary => ({
  id: shoot.id,
  completedAt: shoot.completed_at ?? null,
  dayLabel: shoot.day_label ?? 'Unscheduled',
  timeLabel: shoot.time_label ?? null,
  // The backend's start_time ISO carries the shoot's local date in its prefix;
  // extract it as the intended local calendar day so display never drifts.
  scheduledLocalDate: extractLocalYmd(shoot.start_time) ?? null,
  startTime: shoot.start_time ?? null,
  scheduledInstant: shoot.scheduled_instant ?? null,
  addressLine: streetWithAptSuite(shoot.address_line ?? '', shoot.property_details) || 'No address on file',
  cityStateZip: shoot.city_state_zip ?? '',
  status: shoot.status ?? null,
  cancellationRequestedAt: shoot.cancellation_requested_at ?? null,
  cancellationReason: shoot.cancellation_reason ?? null,
  holdRequestedAt: shoot.hold_requested_at ?? null,
  holdRequestedBy: shoot.hold_requested_by ?? null,
  holdReason: shoot.hold_reason ?? null,
  workflowStatus: shoot.workflow_status ?? null,
  canViewInvoice: shoot.can_view_invoice,
  canSubmitRaw: Boolean(shoot.can_submit_raw ?? shoot.canSubmitRaw),
  clientName: shoot.client_name ?? null,
  clientId: shoot.client_id ?? null,
  clientPhone: shoot.client_phone ?? null,
  temperature: shoot.temperature ?? null,
  services: (shoot.services && shoot.services.length > 0)
    ? shoot.services.map(tag => ({
        label: tag.label,
        type: tag.type,
        icon: tag.icon ?? null,
      }))
    : [],
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
  createdBy: shoot.created_by ?? null,
  heroImage: shoot.hero_image ?? null,
  previewImages: Array.isArray(shoot.preview_images)
    ? shoot.preview_images.filter((image): image is string => Boolean(image))
    : [],
  paymentStatus: (() => {
    const typed = shoot as {
      payment_status?: string | null;
      paymentStatus?: string | null;
      total_paid?: number | string | null;
      total_quote?: number | string | null;
    };
    const raw = typed.payment_status ?? typed.paymentStatus ?? null;
    if (raw) {
      const normalized = String(raw).trim().toLowerCase();
      if (normalized === 'paid' || normalized === 'no_payment_required') return 'paid' as const;
      if (['partial', 'partial_paid', 'partially_paid'].includes(normalized)) return 'partial' as const;
      if (normalized === 'unpaid') return 'unpaid' as const;
    }
    // Fallback when overview select historically omitted payment_status but totals are present.
    const paid = Number(typed.total_paid ?? NaN);
    const quote = Number(typed.total_quote ?? NaN);
    if (Number.isFinite(paid) && Number.isFinite(quote) && quote > 0.01) {
      if (paid <= 0) return 'unpaid' as const;
      if (paid >= quote) return 'paid' as const;
      return 'partial' as const;
    }
    return null;
  })(),
  // Notes fields
  shootNotes: shoot.shoot_notes ?? null,
  companyNotes: shoot.company_notes ?? null,
  photographerNotes: shoot.photographer_notes ?? null,
  editorNotes: shoot.editor_notes ?? null,
  // Property details
  propertyDetails: shoot.property_details ?? null,
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
  travelRange: photographer.travel_range ?? undefined,
  travelRangeUnit: photographer.travel_range_unit ?? undefined,
});

const normalizeActivity = (item: DashboardActivityResponse): DashboardActivityItem => ({
  id: item.id,
  message: item.message,
  action: item.action,
  type: item.type,
  timestamp: item.timestamp ?? null,
  userName: item.user?.name ?? null,
  shootId: item.shootId ?? null,
  address: item.address ?? null,
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
  shoots: Array.isArray(column.shoots) 
    ? column.shoots.map(normalizeShoot)
    : [],
});

const normalizeStats = (stats?: DashboardOverviewResponse['stats'] | null): DashboardStats => ({
  totalShoots: stats?.total_shoots ?? 0,
  scheduledToday: stats?.scheduled_today ?? 0,
  flaggedShoots: stats?.flagged_shoots ?? 0,
  pendingReviews: stats?.pending_reviews ?? 0,
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
  try {
    // Safely handle workflow data
    const workflowColumns = Array.isArray(response.workflow?.columns) 
      ? response.workflow.columns.map(normalizeWorkflowColumn)
      : [];
    
    const workflow = {
      columns: workflowColumns,
    };

    const normalizedUpcoming = Array.isArray(response.upcoming_shoots) 
      ? response.upcoming_shoots.map(normalizeShoot)
      : [];
    const workflowShoots = workflow.columns.flatMap((column) => column.shoots);
    const upcomingShoots = dedupeShoots([...normalizedUpcoming, ...workflowShoots]);

    return {
      stats: normalizeStats(response.stats),
      upcomingShoots,
      latestDeliveries: Array.isArray(response.latest_deliveries)
        ? response.latest_deliveries.map(normalizeShoot)
        : undefined,
      photographers: Array.isArray(response.photographers) 
        ? response.photographers.map(normalizePhotographer)
        : [],
      pendingReviews: Array.isArray(response.pending_reviews) 
        ? response.pending_reviews.map(normalizeShoot)
        : [],
      activityLog: Array.isArray(response.activity_log) 
        ? response.activity_log.map(normalizeActivity)
        : [],
      issues: Array.isArray(response.issues) 
        ? response.issues.map(normalizeIssue)
        : [],
      workflow,
      pendingCancellations: Array.isArray(response.pending_cancellations)
        ? response.pending_cancellations.map((s) => ({
            id: s.id,
            address: s.address_line || `Shoot #${s.id}`,
            clientName: s.client_name || undefined,
            cancellationReason: s.cancellation_reason || undefined,
          }))
        : [],
    };
  } catch (error) {
    console.error('Error transforming dashboard overview:', error, response);
    // Return safe defaults
    return {
      stats: { totalShoots: 0, scheduledToday: 0, flaggedShoots: 0, pendingReviews: 0 },
      upcomingShoots: [],
      photographers: [],
      pendingReviews: [],
      activityLog: [],
      issues: [],
      workflow: { columns: [] },
      pendingCancellations: [],
    };
  }
};
