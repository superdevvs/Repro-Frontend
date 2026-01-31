export type MessageChannel = 'EMAIL' | 'SMS';
export type MessageDirection = 'OUTBOUND' | 'INBOUND';
export type MessageStatus = 'QUEUED' | 'SCHEDULED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
export type SendSource = 'MANUAL' | 'AUTOMATION' | 'SYSTEM';
export type TemplateScope = 'SYSTEM' | 'GLOBAL' | 'ACCOUNT' | 'USER';
export type TemplateCategory = 'BOOKING' | 'REMINDER' | 'PAYMENT' | 'INVOICE' | 'ACCOUNT' | 'GENERAL';
export type EmailProviderType = 'CAKEMAIL';
export type ChannelScope = 'GLOBAL' | 'ACCOUNT' | 'USER';

export type AutomationTriggerType =
  | 'ACCOUNT_CREATED'
  | 'ACCOUNT_VERIFIED'
  | 'PASSWORD_RESET'
  | 'TERMS_ACCEPTED'
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
  | 'PHOTOGRAPHER_ASSIGNED';

export interface MessageChannelConfig {
  id: number;
  type: 'EMAIL' | 'SMS';
  provider: EmailProviderType | 'MIGHTYCALL';
  display_name: string;
  label?: string;
  from_email?: string;
  reply_to_email?: string;
  from_number?: string;
  is_default: boolean;
  owner_scope: ChannelScope;
  owner_id?: number;
  config_json?: Record<string, any>;
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
  shoot?: any;
  invoice?: any;
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

export interface AutomationRule {
  id: number;
  name: string;
  description?: string;
  trigger_type: AutomationTriggerType;
  is_active: boolean;
  scope: TemplateScope;
  owner_id?: number;
  template_id?: number;
  channel_id?: number;
  condition_json?: Record<string, any>;
  schedule_json?: {
    type?: string;
    day_of_week?: number;
    time?: string;
    offset?: string;
    cron?: string;
  };
  recipients_json?: Array<'client' | 'photographer' | 'admin' | 'rep'> | {
    type?: string;
    roles?: string[];
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
  variables?: Record<string, any>;
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
}

