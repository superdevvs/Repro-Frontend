/** Shapes returned by /api/crm/*. Kept close to the Laravel presenters. */

export type StageKey = 'outreach' | 'inquiry' | 'estimate' | 'booked' | 'client_pool' | 'lost';
export type PipelineStage = Exclude<StageKey, 'client_pool' | 'lost'>;
export type Health = 'healthy' | 'slowing' | 'at_risk' | 'new' | null;

export interface Person { id: number; name: string; initials?: string; email?: string | null; avatar?: string | null; role?: string }
export interface Option { key: string; label: string }

export interface CrmMeta {
  me: Person;
  can: {
    view_all: boolean; create: boolean; update: boolean; assign: boolean; import: boolean; manage_event_types: boolean;
    enrol_drips: boolean; manage_drips: boolean; create_campaigns: boolean; approve_campaigns: boolean; approve_templates: boolean;
    approve_signatures: boolean; approve_quotes: boolean; recruiting: boolean; recruiting_manage: boolean; recruiting_documents: boolean;
  };
  counts: { unassigned: number; duplicate_attempts: number; unread_notices: number; follow_ups_due?: number };
  reps: Person[];
  stages: Option[];
  pipeline_stages: PipelineStage[];
  segments: Option[];
  client_types: Option[];
  lost_reasons: Option[];
  lead_sources: Option[];
  markets: string[];
  settings: { first_contact_business_days: number; quote_discount_approval_percent: number };
}

export interface CrmEvent {
  id: number;
  type: { id: number; key: string; label: string; icon?: string | null } | null;
  starts_at: string;
  duration_min: number;
  status: 'planned' | 'done' | 'missed' | 'cancelled';
  note: string | null;
  outcome_note: string | null;
  completed_at: string | null;
  assigned_user: Person | null;
  via_robbie: boolean;
  overdue: boolean;
  late: string | null;
  contact: { id: number; name: string; company: string | null; stage: StageKey; stage_label: string } | null;
  applicant_id: number | null;
  applicant?: { id: number; name: string; role: string; stage: string } | null;
  on_calendar: boolean;
}

export interface DripSummary {
  id: number;
  campaign: { id: number; name: string; length: string } | null;
  status: string;
  stop_reason: string | null;
  step: number;
  steps_total: number;
  week: number;
  started_at: string | null;
  next_send_at: string | null;
  emails_sent: number;
  opened: number;
  clicked: number;
}

export interface Contact {
  id: number;
  name: string;
  company: string | null;
  company_id: number | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  market_state: string | null;
  market_city: string | null;
  market: string | null;
  segment: 'residential' | 'commercial';
  client_type: 'one_off' | 'recurring' | null;
  stage: StageKey;
  stage_label: string;
  stage_before_lost: StageKey | null;
  lost_reason: string | null;
  lost_reason_label: string | null;
  lost_note: string | null;
  lost_at: string | null;
  assigned_rep: Person | null;
  lead_source: string;
  lead_source_label: string;
  first_shoot_date: string | null;
  client_user_id: number | null;
  email_opted_out: boolean;
  email_status: string | null;
  sms_consent: boolean;
  needs_review: boolean;
  review_reasons: string[];
  health: Health;
  usual_gap_days: number | null;
  last_shoot_on: string | null;
  stage_changed_at: string | null;
  last_contacted_at: string | null;
  first_contact_due_at: string | null;
  created_at: string | null;
  can: { edit: boolean; assign: boolean };
  next_event?: CrmEvent | null;
  drip?: DripSummary | null;
  shoots?: { total: number; first_completed: string | null; last_shoot: string | null } | null;
  inquiry?: { type: string; message: string | null; received_at: string | null } | null;
  suggestion?: { rep: Person; reason: string } | null;
}

export interface BoardCard {
  id: number;
  name: string;
  company: string | null;
  segment: string;
  market: string | null;
  stage: StageKey;
  lead_source: string;
  is_new_website_lead: boolean;
  assigned_rep: Person | null;
  footer: { kind: 'overdue' | 'event' | 'drip' | 'none'; icon: string; text: string };
}

export interface Stat { key: string; label: string; value: number; delta: number | null; series: number[] | null; tone?: 'bad' | 'neutral' }

export interface Paged<T> { data: T[]; meta: { total: number; page: number; last_page: number; per_page?: number } }

export interface Note { id: number; body: string; author: Person | null; via_robbie: boolean; created_at: string; edited_at: string | null; has_versions: boolean; can_edit: boolean }

export interface Activity {
  id: number; type: string; summary: string; data: Record<string, unknown>; actor: Person | null; via_robbie: boolean;
  subject_type: string | null; subject_id: number | null; occurred_at: string;
}

export interface DuplicatePayload { blocked: boolean; reason: 'email' | 'phone' | 'name'; admin_notified: boolean; overridable: boolean; match?: Contact }

export interface TemplateVersion {
  id: number; version_no: number; subject: string; preheader: string | null; body_html: string; image_url: string | null;
  cta_label: string | null; cta_url: string | null; status: string; created_by: Person | null; reviewed_by: Person | null;
  reviewed_at: string | null; review_comment: string | null; content_check: ContentCheck | null; updated_at: string | null;
}
export interface EmailTemplate {
  id: number; name: string; kind: 'one_off' | 'drip' | 'campaign' | 'recruiting'; status: string; owner: Person | null;
  approved: TemplateVersion | null; latest: TemplateVersion | null; has_pending_changes: boolean; updated_at: string | null;
  versions?: TemplateVersion[]; usage?: Record<string, unknown>;
}
export interface ContentCheck { passed: boolean; issues: { kind: string; message: string; quote?: string; start?: number; length?: number }[]; ai?: boolean }

export interface Signature {
  id: number; version: number; user: Person | null; fields: Record<string, string>; sender_email: string; headshot_url: string | null;
  status: 'pending' | 'approved' | 'rejected'; review_comment: string | null; reviewed_by: Person | null; reviewed_at: string | null;
  is_current_approved: boolean; submitted_at: string | null; html: string;
}

export interface EmailSend {
  id: number; source_type: string; source_id: number | null; from: string; from_name: string | null; to: string; reply_to: string | null;
  subject: string; status: string; delivered: boolean; recorded_only: boolean; error: string | null; sender: Person | null;
  sent_at: string | null; opened: boolean; open_count: number; click_count: number; first_opened_at: string | null;
  bounced_at: string | null; replied_at: string | null; created_at: string | null; html?: string; text?: string;
}

export interface Proposal {
  id: number; kind: 'note' | 'event' | 'stage' | 'email' | 'drip'; summary: string; payload: Record<string, unknown>;
  status: 'pending' | 'running' | 'confirmed' | 'dismissed' | 'expired'; contact: { id: number; name: string; company: string | null } | null;
  editable: string[]; result: Record<string, unknown> | null; expires_at: string | null;
}

export interface Insight { key: string; tone: 'warning' | 'info'; count: number; text: string; href: string; prompt: string }

export interface PlanItem {
  kind: 'overdue' | 'follow_up' | 'first_contact' | 'quote' | 'at_risk'; at: string | null; title: string; reason: string;
  note: string | null; event_id: number | null; action: { kind: 'call' | 'email' | 'event'; label: string };
  contact: { id: number; name: string; company: string | null; stage: StageKey; phone: string | null; email: string | null } | null;
}

export interface Quote {
  id: number; number: string; status: 'draft' | 'pending_approval' | 'approved' | 'sending' | 'sent' | 'accepted' | 'declined' | 'expired';
  total: number; subtotal: number; discount_percent: number; discount_amount: number; needs_approval: boolean;
  contact: { id: number; name: string; company: string | null } | null; property_address: string | null; valid_until: string | null;
  sent_at: string | null; accepted_at: string | null; declined_at: string | null; created_by: Person | null; approved_by: Person | null;
  via_robbie: boolean; created_at: string | null;
  items?: { id: number; service_id: number | null; name: string; quantity: number; unit_price: number; total: number }[];
  sqft?: number | null; property_city?: string | null; property_state?: string | null; property_zip?: string | null;
  booking_status?: 'needs_review' | 'requested' | 'linked' | null; booking_shoot_id?: number | null; booking_review_reason?: string | null;
  notes?: string | null; decline_reason?: string | null; public_url?: string | null;
}

export interface ApiError { message: string; status?: number; errors?: Record<string, string[]>; duplicate?: DuplicatePayload; reason?: string; content_check?: ContentCheck }
