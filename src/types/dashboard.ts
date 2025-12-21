export interface DashboardStatsResponse {
  total_shoots: number;
  scheduled_today: number;
  flagged_shoots: number;
  pending_reviews: number;
}

export interface DashboardShootServiceTagResponse {
  label: string;
  type: string;
}

export interface DashboardPhotographerResponse {
  id: number;
  name: string;
  region?: string | null;
  load_today: number;
  available_from?: string | null;
  next_slot?: string | null;
  avatar?: string | null;
  status: 'free' | 'busy' | 'editing' | 'offline';
  next_shoot_distance?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface DashboardActivityResponse {
  id: number;
  message: string;
  action?: string;
  type: string;
  timestamp: string | null;
  user?: {
    id: number;
    name: string;
  } | null;
}

export interface DashboardIssueResponse {
  id: number;
  message: string;
  severity: 'low' | 'medium' | 'high';
  status?: string | null;
  client?: string | null;
  updated_at?: string | null;
}

export interface DashboardShootSummaryResponse {
  id: number;
  day_label?: string | null;
  time_label?: string | null;
  start_time?: string | null;
  address_line?: string | null;
  city_state_zip?: string | null;
  status?: string | null;
  workflow_status?: string | null;
  client_name?: string | null;
  client_id?: number | null;
  temperature?: string | null;
  services: DashboardShootServiceTagResponse[];
  photographer?: {
    id: number;
    name: string;
    avatar?: string | null;
  } | null;
  is_flagged: boolean;
  delivery_deadline?: string | null;
  submitted_for_review_at?: string | null;
  admin_issue_notes?: string | null;
}

export interface DashboardWorkflowColumnResponse {
  key: string;
  label: string;
  accent: string;
  count: number;
  shoots: DashboardShootSummaryResponse[];
}

export interface DashboardWorkflowResponse {
  columns: DashboardWorkflowColumnResponse[];
}

export interface DashboardOverviewResponse {
  stats: DashboardStatsResponse;
  upcoming_shoots: DashboardShootSummaryResponse[];
  photographers: DashboardPhotographerResponse[];
  pending_reviews: DashboardShootSummaryResponse[];
  activity_log: DashboardActivityResponse[];
  issues: DashboardIssueResponse[];
  workflow: DashboardWorkflowResponse;
}

// Normalized UI-friendly types
export interface DashboardStats {
  totalShoots: number;
  scheduledToday: number;
  flaggedShoots: number;
  pendingReviews: number;
}

export interface DashboardShootServiceTag {
  label: string;
  type: string;
}

export interface DashboardPhotographerSummary {
  id: number;
  name: string;
  region: string;
  loadToday: number;
  availableFrom: string | null;
  nextSlot: string | null;
  avatar?: string | null;
  status: 'free' | 'busy' | 'editing' | 'offline';
  nextShootDistance?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface DashboardActivityItem {
  id: number;
  message: string;
  action?: string;
  type: string;
  timestamp: string | null;
  userName?: string | null;
}

export interface DashboardIssueItem {
  id: number;
  message: string;
  severity: 'low' | 'medium' | 'high';
  status?: string | null;
  client?: string | null;
  updatedAt?: string | null;
}

export interface DashboardShootSummary {
  id: number;
  dayLabel: string;
  timeLabel: string | null;
  startTime: string | null;
  addressLine: string;
  cityStateZip: string;
  status: string | null;
  workflowStatus: string | null;
  clientName: string | null;
  clientId?: string | number | null;
  temperature?: string | null;
  services: DashboardShootServiceTag[];
  photographer?: {
    id: number;
    name: string;
    avatar?: string | null;
  } | null;
  isFlagged: boolean;
  deliveryDeadline?: string | null;
  submittedForReviewAt?: string | null;
  adminIssueNotes?: string | null;
}

export interface DashboardWorkflowColumn {
  key: string;
  label: string;
  accent: string;
  count: number;
  shoots: DashboardShootSummary[];
}

export interface DashboardWorkflow {
  columns: DashboardWorkflowColumn[];
}

export interface DashboardOverview {
  stats: DashboardStats;
  upcomingShoots: DashboardShootSummary[];
  photographers: DashboardPhotographerSummary[];
  pendingReviews: DashboardShootSummary[];
  activityLog: DashboardActivityItem[];
  issues: DashboardIssueItem[];
  workflow: DashboardWorkflow;
}

