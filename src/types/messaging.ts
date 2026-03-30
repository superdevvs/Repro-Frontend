export type MessageChannel = 'EMAIL' | 'SMS';
export type MessageDirection = 'OUTBOUND' | 'INBOUND';
export type MessageStatus = 'QUEUED' | 'SCHEDULED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
export type SendSource = 'MANUAL' | 'AUTOMATION' | 'SYSTEM';
export type TemplateScope = 'SYSTEM' | 'GLOBAL' | 'ACCOUNT' | 'USER';
export type TemplateCategory = 'BOOKING' | 'REMINDER' | 'PAYMENT' | 'INVOICE' | 'ACCOUNT' | 'GENERAL';
export type EmailProviderType = 'CAKEMAIL';
export type ChannelScope = 'GLOBAL' | 'ACCOUNT' | 'USER';

export type MessagingJsonPrimitive = string | number | boolean | null;
export type MessagingJsonValue = MessagingJsonPrimitive | MessagingJsonObject | MessagingJsonValue[];

export interface MessagingJsonObject {
  [key: string]: MessagingJsonValue;
}

export type AutomationTriggerType =
  | 'ACCOUNT_CREATED'
  | 'ACCOUNT_VERIFIED'
  | 'PASSWORD_RESET'
  | 'TERMS_ACCEPTED'
  | 'SHOOT_REQUESTED'
  | 'SHOOT_REQUEST_APPROVED'
  | 'SHOOT_BOOKED'
  | 'SHOOT_SCHEDULED'
  | 'SHOOT_UPDATED'
  | 'SHOOT_REMINDER'
  | 'SHOOT_COMPLETED'
  | 'SHOOT_CANCELED'
  | 'SHOOT_REMOVED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REFUNDED'
  | 'INVOICE_DUE'
  | 'INVOICE_OVERDUE'
  | 'INVOICE_SUMMARY'
  | 'INVOICE_PAID'
  | 'WEEKLY_PHOTOGRAPHER_INVOICE'
  | 'WEEKLY_REP_INVOICE'
  | 'WEEKLY_SALES_REPORT'
  | 'WEEKLY_AUTOMATED_INVOICING'
  | 'PHOTO_UPLOADED'
  | 'MEDIA_UPLOAD_COMPLETE'
  | 'PHOTOGRAPHER_ASSIGNED'
  | 'EDITING_COMPLETE'
  | 'PROPERTY_CONTACT_REMINDER';

export type AutomationRecipientRole = 'client' | 'photographer' | 'admin' | 'rep';

export interface AutomationScheduleJson {
  type?: string;
  day_of_week?: number;
  time?: string;
  offset?: string;
  cron?: string;
  command?: string;
}

export type WorkflowNodeType =
  | 'trigger.event'
  | 'trigger.schedule'
  | 'condition.if'
  | 'wait.duration'
  | 'wait.datetime_offset'
  | 'action.email'
  | 'action.sms'
  | 'action.internal_notification'
  | 'end';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: {
    x: number;
    y: number;
  };
  config: MessagingJsonObject;
  validation?: string[];
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  branchKey?: string | null;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  meta?: MessagingJsonObject;
}

export interface AutomationValidationState {
  valid: boolean;
  errors: string[];
  warnings: string[];
  node_errors: Record<string, string[]>;
  summary: {
    node_count: number;
    edge_count: number;
    reachable_action_count: number;
  };
}

export interface AutomationSimulationRecipient {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  [key: string]: unknown;
}

export interface AutomationSimulationTraceEntry {
  node_id: string;
  node_type: string;
  status?: string | null;
  branch?: string | null;
  scheduled_for?: string | null;
  preview_recipients?: AutomationSimulationRecipient[];
  [key: string]: unknown;
}

export interface AutomationSimulationResult {
  trace?: AutomationSimulationTraceEntry[];
  errors?: string[];
  [key: string]: unknown;
}

export interface AutomationTestResult {
  status?: string;
  message?: string;
  errors?: string[];
  trace?: AutomationSimulationTraceEntry[];
  [key: string]: unknown;
}

export interface AutomationRunStep {
  id: number;
  automation_run_id: number;
  automation_rule_id?: number;
  node_id: string;
  node_type: string;
  status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'skipped';
  attempt_count: number;
  scheduled_for?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  input_json?: MessagingJsonObject | null;
  output_json?: MessagingJsonObject | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: number;
  automation_rule_id: number;
  trigger_type?: string | null;
  status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed';
  context_json?: MessagingJsonObject | null;
  related_shoot_id?: number | null;
  related_account_id?: number | null;
  related_invoice_id?: number | null;
  scheduled_for?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  steps?: AutomationRunStep[];
}

export interface MessageChannelConfig {
  id: number;
  type: 'EMAIL' | 'SMS';
  provider: EmailProviderType | 'TWILIO';
  display_name: string;
  label?: string;
  from_email?: string;
  reply_to_email?: string;
  from_number?: string;
  is_default: boolean;
  owner_scope: ChannelScope;
  owner_id?: number;
  config_json?: MessagingJsonObject;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: number;
  channel: MessageChannel;
  name: string;
  slug?: string;
  description?: string;
  category?: TemplateCategory;
  subject?: string;
  body_html?: string;
  body_text?: string;
  variables_json?: string[];
  scope: TemplateScope;
  owner_id?: number;
  is_system: boolean;
  is_active: boolean;
  created_by?: number;
  updated_by?: number;
  creator?: {
    id: number;
    name: string;
  };
  updater?: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  channel: MessageChannel;
  direction: MessageDirection;
  provider?: string;
  provider_message_id?: string;
  message_channel_id?: number;
  from_address?: string;
  to_address: string;
  reply_to_email?: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  attachments_json?: Array<{
    name: string;
    size: number;
    type: string;
    url: string;
  }>;
  status: MessageStatus;
  send_source: SendSource;
  tags_json?: string[];
  error_message?: string;
  scheduled_at?: string;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  created_by?: number;
  sender_user_id?: number;
  sender_account_id?: number;
  sender_role?: string;
  sender_display_name?: string;
  template_id?: number;
  related_shoot_id?: number;
  related_account_id?: number;
  related_invoice_id?: number;
  thread_id?: number;
  created_at: string;
  updated_at: string;
  // Relations
  template?: MessageTemplate;
  channel_config?: MessageChannelConfig;
  shoot?: MessageRelatedRecord | null;
  invoice?: MessageRelatedRecord | null;
  thread?: MessageThread;
  creator?: {
    id: number;
    name: string;
  };
}

export interface MessageThread {
  id: number;
  channel: MessageChannel;
  contact_id: number;
  last_message_at?: string;
  last_direction?: MessageDirection;
  last_snippet?: string;
  unread_for_user_ids_json?: number[];
  created_at: string;
  updated_at: string;
  // Relations
  contact?: {
    id: number;
    name?: string;
    email?: string;
    phone?: string;
    type: string;
  };
  messages?: Message[];
}

export type SmsThreadFilter = 'all' | 'unanswered' | 'my_recents' | 'clients';

export interface SmsContact {
  id: string;
  name?: string;
  initials?: string;
  type?: string;
  email?: string;
  primaryNumber?: string;
  numbers: Array<{
    id?: string;
    number: string;
    label?: string;
    is_primary?: boolean;
  }>;
  comment?: string;
  tags?: string[];
}

export interface SmsThreadSummary {
  id: string;
  contact?: SmsContact;
  lastMessageSnippet?: string;
  lastMessageAt?: string;
  lastDirection?: MessageDirection;
  unread: boolean;
  status?: string;
  tags?: string[];
  assignedToUserId?: number;
  assignedTo?: {
    id: string;
    name: string;
  } | null;
}

export interface SmsMessageDetail {
  id: string;
  threadId: string;
  direction: MessageDirection;
  from?: string;
  to?: string;
  body?: string;
  status?: MessageStatus;
  sentAt?: string;
  providerMessageId?: string;
}

export interface SmsThreadDetail {
  thread: SmsThreadSummary;
  messages: SmsMessageDetail[];
  contact: SmsContact;
}

export interface SmsNumberConfig {
  id?: number;
  provider?: 'TWILIO';
  phone_number: string;
  label?: string;
  twilio_phone_number_sid?: string | null;
  is_default?: boolean;
}

export interface AutomationRule {
  id: number;
  name: string;
  description?: string;
  trigger_type: AutomationTriggerType;
  editor_mode?: 'visual' | 'simple';
  engine_version?: number;
  is_active: boolean;
  scope: TemplateScope;
  owner_id?: number;
  template_id?: number;
  channel_id?: number;
  condition_json?: MessagingJsonObject;
  schedule_json?: AutomationScheduleJson;
  workflow_definition_json?: WorkflowDefinition;
  entry_trigger_json?: {
    trigger_type?: string;
    node_id?: string | null;
    node_type?: string | null;
    config?: MessagingJsonObject;
  };
  is_system_locked?: boolean;
  recipients_json?: AutomationRecipientRole[] | {
    type?: string;
    roles?: AutomationRecipientRole[];
  };
  created_by?: number;
  updated_by?: number;
  created_at: string;
  updated_at: string;
  // Relations
  template?: MessageTemplate;
  channel?: MessageChannelConfig;
  creator?: {
    id: number;
    name: string;
  };
  updater?: {
    id: number;
    name: string;
  };
  latest_dispatch?: {
    id: number;
    trigger_type?: string;
    period_key?: string;
    scheduled_for?: string;
    command?: string;
    status?: 'running' | 'completed' | 'failed';
    output?: string | null;
    error_message?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  };
  legacy_status?: 'migrated' | 'converted_from_legacy';
  validation_state?: AutomationValidationState;
  recent_runs?: AutomationRun[];
}

export interface ComposeEmailPayload {
  to?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  reply_to?: string;
  template_id?: number;
  channel_id?: number;
  related_shoot_id?: number;
  related_account_id?: number;
  related_invoice_id?: number;
  variables?: MessagingJsonObject;
  cc?: string[];
  bcc?: string[];
  attachments?: File[];
}

export interface ScheduleEmailPayload extends ComposeEmailPayload {
  scheduled_at: string;
}

export interface EmailRecipient {
  id: number;
  name?: string;
  email: string;
}

export interface MessagingOverview {
  total_sent_today: number;
  total_failed_today: number;
  total_scheduled: number;
  unread_sms_count: number;
  recent_activity: Message[];
  active_automations: number;
  delivery_rate?: number | null;
  average_response_time?: string | null;
  delivery_score?: number | null;
  template_usage?: {
    active?: number | null;
    [key: string]: unknown;
  } | null;
  automation_summary?: {
    coverage?: string | number | null;
    paused?: number | null;
    [key: string]: unknown;
  } | null;
  upcoming_broadcasts?: string | null;
}

export interface MessageRelatedRecord {
  id?: number | string;
  [key: string]: unknown;
}

export interface TemplatePreviewResult {
  subject?: string | null;
  body_html?: string | null;
  body_text?: string | null;
  variables?: MessagingJsonObject | null;
  missing_variables?: string[];
  [key: string]: unknown;
}

export interface PaginatedResponseMeta {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  from?: number | null;
  to?: number | null;
  path?: string;
  [key: string]: unknown;
}
