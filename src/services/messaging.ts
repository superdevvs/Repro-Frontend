import { apiClient } from './api';
import type {
  Message,
  MessageTemplate,
  MessageChannelConfig,
  AutomationRule,
  AutomationRun,
  AutomationSimulationResult,
  AutomationTestResult,
  AutomationValidationState,
  MessageThread,
  ComposeEmailPayload,
  ScheduleEmailPayload,
  MessagingOverview,
  PaginatedResponseMeta,
  SmsThreadSummary,
  SmsThreadDetail,
  SmsMessageDetail,
  SmsContact,
  SmsNumberConfig,
  EmailRecipient,
  EmailComposeRecipient,
  TemplatePreviewResult,
} from '@/types/messaging';

const toEmailRecipient = (value: unknown, fallbackId: number): EmailRecipient | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.email !== 'string' || !record.email) {
    return null;
  }

  const numericId =
    typeof record.id === 'number' && Number.isFinite(record.id)
      ? record.id
      : typeof record.id === 'string' && Number.isFinite(Number(record.id))
        ? Number(record.id)
        : fallbackId;

  return {
    id: numericId,
    name: typeof record.name === 'string' ? record.name : undefined,
    email: record.email,
  };
};

// Overview
export const getMessagingOverview = async (): Promise<MessagingOverview> => {
  const response = await apiClient.get('/messaging/overview');
  return response.data;
};

// Templates
export const getTemplates = async (params?: {
  channel?: string;
  scope?: string;
  category?: string;
  is_active?: boolean;
}): Promise<MessageTemplate[]> => {
  const response = await apiClient.get('/messaging/templates', { params });
  return response.data;
};

export const getTemplate = async (id: number): Promise<MessageTemplate> => {
  const response = await apiClient.get(`/messaging/templates/${id}`);
  return response.data;
};

export const createTemplate = async (data: Partial<MessageTemplate>): Promise<MessageTemplate> => {
  const response = await apiClient.post('/messaging/templates', data);
  return response.data;
};

export const updateTemplate = async (id: number, data: Partial<MessageTemplate>): Promise<MessageTemplate> => {
  const response = await apiClient.put(`/messaging/templates/${id}`, data);
  return response.data;
};

export const deleteTemplate = async (id: number): Promise<void> => {
  await apiClient.delete(`/messaging/templates/${id}`);
};

export const duplicateTemplate = async (id: number): Promise<MessageTemplate> => {
  const response = await apiClient.post(`/messaging/templates/${id}/duplicate`);
  return response.data;
};

export const testSendTemplate = async (
  id: number,
  data: {
    to: string;
    variables?: ComposeEmailPayload['variables'];
    template?: Pick<MessageTemplate, 'channel' | 'name' | 'description' | 'category' | 'subject' | 'body_html' | 'body_text'>;
  },
): Promise<void> => {
  await apiClient.post(`/messaging/templates/${id}/test-send`, data);
};

export const previewTemplate = async (
  id: number,
  variables?: ComposeEmailPayload['variables'],
): Promise<TemplatePreviewResult> => {
  const response = await apiClient.post(`/messaging/templates/${id}/preview`, { variables });
  return response.data;
};

// Automations
export const getAutomations = async (params?: {
  trigger_type?: string;
  is_active?: boolean;
}): Promise<AutomationRule[]> => {
  const response = await apiClient.get('/messaging/automations', { params });
  return response.data;
};

export const getAutomation = async (id: number): Promise<AutomationRule> => {
  const response = await apiClient.get(`/messaging/automations/${id}`);
  return response.data;
};

export const createAutomation = async (data: Partial<AutomationRule>): Promise<AutomationRule> => {
  const response = await apiClient.post('/messaging/automations', data);
  return response.data;
};

export const updateAutomation = async (id: number, data: Partial<AutomationRule>): Promise<AutomationRule> => {
  const response = await apiClient.put(`/messaging/automations/${id}`, data);
  return response.data;
};

export const deleteAutomation = async (id: number): Promise<void> => {
  await apiClient.delete(`/messaging/automations/${id}`);
};

export const toggleAutomation = async (id: number): Promise<AutomationRule> => {
  const response = await apiClient.post(`/messaging/automations/${id}/toggle`);
  return response.data;
};

export const runAutomation = async (id: number): Promise<{ status: string; output?: string; automation: AutomationRule }> => {
  const response = await apiClient.post(`/messaging/automations/${id}/run`);
  return response.data;
};

export const testAutomation = async (
  id: number,
  data: { test_email: string; test_context?: ComposeEmailPayload['variables'] },
): Promise<AutomationTestResult> => {
  const response = await apiClient.post(`/messaging/automations/${id}/test`, data);
  return response.data;
};

export const validateAutomationWorkflow = async (
  workflow_definition_json: AutomationRule['workflow_definition_json'],
): Promise<AutomationValidationState> => {
  const response = await apiClient.post('/messaging/automations/validate', {
    workflow_definition_json,
  });
  return response.data;
};

export const simulateAutomation = async (
  id: number,
  test_context?: ComposeEmailPayload['variables'],
): Promise<AutomationSimulationResult> => {
  const response = await apiClient.post(`/messaging/automations/${id}/simulate`, {
    test_context,
  });
  return response.data;
};

export const getAutomationRuns = async (id: number): Promise<AutomationRun[]> => {
  const response = await apiClient.get(`/messaging/automations/${id}/runs`);
  return response.data?.data ?? [];
};

// Email Messages
export const getEmailMessages = async (params?: {
  status?: string;
  channel_id?: number;
  send_source?: string;
  search?: string;
  per_page?: number;
  page?: number;
}): Promise<{ data: Message[]; total: number; current_page: number; last_page: number }> => {
  const response = await apiClient.get('/messaging/email/messages', { params });
  return response.data;
};

export const getEmailMessage = async (id: number): Promise<Message> => {
  const response = await apiClient.get(`/messaging/email/messages/${id}`);
  return response.data;
};

export const getEmailRecipients = async (): Promise<EmailRecipient[]> => {
  const response = await apiClient.get('/admin/users');
  // API commonly returns { users: [...] }
  const users = response.data?.users ?? response.data ?? [];
  return Array.isArray(users)
    ? users
        .map((user, idx) => toEmailRecipient(user, idx))
        .filter((recipient): recipient is EmailRecipient => Boolean(recipient))
    : [];
};

export const getEmailComposeRecipients = async (params?: {
  search?: string;
  limit?: number;
}): Promise<EmailComposeRecipient[]> => {
  const response = await apiClient.get('/messaging/email/recipients', { params });
  return Array.isArray(response.data) ? response.data : [];
};

export const getEmailThreads = async (params?: {
  per_page?: number;
  page?: number;
}): Promise<{ data: MessageThread[]; total: number; current_page: number; last_page: number }> => {
  const response = await apiClient.get('/messaging/email/threads', { params });
  return response.data;
};

export const composeEmail = async (data: ComposeEmailPayload): Promise<Message> => {
  // Use FormData if attachments are present
  if (data.attachments && data.attachments.length > 0) {
    const formData = new FormData();
    
    // Add all non-file fields
    if (data.to) formData.append('to', data.to);
    if (data.subject) formData.append('subject', data.subject);
    if (data.body_html) formData.append('body_html', data.body_html);
    if (data.body_text) formData.append('body_text', data.body_text);
    if (data.reply_to) formData.append('reply_to', data.reply_to);
    if (data.channel_id) formData.append('channel_id', String(data.channel_id));
    if (data.template_id) formData.append('template_id', String(data.template_id));
    if (data.related_shoot_id) formData.append('related_shoot_id', String(data.related_shoot_id));
    if (data.related_shoot_context_type) formData.append('related_shoot_context_type', data.related_shoot_context_type);
    if (data.related_account_id) formData.append('related_account_id', String(data.related_account_id));
    if (data.related_invoice_id) formData.append('related_invoice_id', String(data.related_invoice_id));
    if (data.variables) formData.append('variables', JSON.stringify(data.variables));
    if (data.cc) data.cc.forEach((email) => formData.append('cc[]', email));
    if (data.bcc) data.bcc.forEach((email) => formData.append('bcc[]', email));
    
    // Add attachments
    data.attachments.forEach((file) => formData.append('attachments[]', file));
    
    const response = await apiClient.post('/messaging/email/compose', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
  
  const response = await apiClient.post('/messaging/email/compose', data);
  return response.data;
};

export const scheduleEmail = async (data: ScheduleEmailPayload): Promise<Message> => {
  // Use FormData if attachments are present
  if (data.attachments && data.attachments.length > 0) {
    const formData = new FormData();
    
    // Add all non-file fields
    if (data.to) formData.append('to', data.to);
    if (data.subject) formData.append('subject', data.subject);
    if (data.body_html) formData.append('body_html', data.body_html);
    if (data.body_text) formData.append('body_text', data.body_text);
    if (data.reply_to) formData.append('reply_to', data.reply_to);
    if (data.channel_id) formData.append('channel_id', String(data.channel_id));
    if (data.template_id) formData.append('template_id', String(data.template_id));
    if (data.related_shoot_id) formData.append('related_shoot_id', String(data.related_shoot_id));
    if (data.related_shoot_context_type) formData.append('related_shoot_context_type', data.related_shoot_context_type);
    if (data.related_account_id) formData.append('related_account_id', String(data.related_account_id));
    if (data.related_invoice_id) formData.append('related_invoice_id', String(data.related_invoice_id));
    if (data.variables) formData.append('variables', JSON.stringify(data.variables));
    if (data.cc) data.cc.forEach((email) => formData.append('cc[]', email));
    if (data.bcc) data.bcc.forEach((email) => formData.append('bcc[]', email));
    formData.append('scheduled_at', data.scheduled_at);
    
    // Add attachments
    data.attachments.forEach((file) => formData.append('attachments[]', file));
    
    const response = await apiClient.post('/messaging/email/schedule', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
  
  const response = await apiClient.post('/messaging/email/schedule', data);
  return response.data;
};

export const retryEmail = async (id: number): Promise<Message> => {
  const response = await apiClient.post(`/messaging/email/messages/${id}/retry`);
  return response.data;
};

export const cancelEmail = async (id: number): Promise<Message> => {
  const response = await apiClient.post(`/messaging/email/messages/${id}/cancel`);
  return response.data;
};

// SMS
export const getSmsThreads = async (params?: {
  per_page?: number;
  page?: number;
  filter?: string;
  search?: string;
}): Promise<{ data: SmsThreadSummary[]; meta: PaginatedResponseMeta }> => {
  const response = await apiClient.get('/messaging/sms/threads', { params });
  return {
    data: response.data.data ?? [],
    meta: response.data.meta ?? {},
  };
};

export const getSmsThread = async (id: string | number): Promise<SmsThreadDetail> => {
  const response = await apiClient.get(`/messaging/sms/threads/${id}`);
  return response.data;
};

export const sendSms = async (data: { to: string; body_text: string; sms_number_id?: number }): Promise<{
  message: SmsMessageDetail;
  thread: SmsThreadSummary;
}> => {
  const response = await apiClient.post('/messaging/sms/send', data);
  return response.data;
};

export const sendSmsMessageToThread = async (
  threadId: string | number,
  data: { body: string; sms_number_id?: number },
): Promise<{
  message: SmsMessageDetail;
  thread: SmsThreadSummary;
}> => {
  const response = await apiClient.post(`/messaging/sms/threads/${threadId}/messages`, data);
  return response.data;
};

export const markSmsThreadRead = async (id: string | number): Promise<void> => {
  await apiClient.post(`/messaging/sms/threads/${id}/mark-read`);
};

export const updateSmsContact = async (
  contactId: string | number,
  data: {
    name?: string;
    email?: string;
    type?: string;
    numbers?: SmsContact['numbers'];
    tags?: string[];
  },
): Promise<SmsContact> => {
  const response = await apiClient.put(`/messaging/contacts/${contactId}`, data);
  return response.data.contact;
};

export const updateSmsContactComment = async (
  contactId: string | number,
  comment: string,
): Promise<SmsContact> => {
  const response = await apiClient.put(`/messaging/contacts/${contactId}/comment`, { comment });
  return response.data.contact;
};

// Settings
export const getEmailSettings = async (): Promise<{ channels: MessageChannelConfig[] }> => {
  const response = await apiClient.get('/messaging/settings/email');
  return response.data;
};

export const saveEmailSettings = async (data: { channels: Partial<MessageChannelConfig>[] }): Promise<void> => {
  await apiClient.post('/messaging/settings/email', data);
};

export const createEmailChannel = async (data: Partial<MessageChannelConfig>): Promise<MessageChannelConfig> => {
  const response = await apiClient.post('/messaging/settings/email/channels', data);
  return response.data;
};

export const updateEmailChannel = async (id: number, data: Partial<MessageChannelConfig>): Promise<MessageChannelConfig> => {
  const response = await apiClient.put(`/messaging/settings/email/channels/${id}`, data);
  return response.data;
};

export const deleteEmailChannel = async (id: number): Promise<void> => {
  await apiClient.delete(`/messaging/settings/email/channels/${id}`);
};

export const testEmailChannel = async (id: number, test_email: string): Promise<void> => {
  await apiClient.post(`/messaging/settings/email/channels/${id}/test`, { test_email });
};

export const getSmsSettings = async (): Promise<{ numbers: SmsNumberConfig[] }> => {
  const response = await apiClient.get('/messaging/settings/sms');
  return response.data;
};

export const saveSmsSettings = async (data: { numbers: SmsNumberConfig[] }): Promise<{ status: string; numbers: SmsNumberConfig[] }> => {
  const response = await apiClient.post('/messaging/settings/sms', data);
  return response.data;
};

export const testSmsConnection = async (sms_number_id?: number): Promise<{ success: boolean; message?: string; error?: string }> => {
  const response = await apiClient.post('/messaging/settings/sms/test-connection', { sms_number_id });
  return response.data;
};

export const testSmsSend = async (data: { to: string; message: string; sms_number_id?: number }): Promise<{ success: boolean; message_id?: string; error?: string }> => {
  const response = await apiClient.post('/messaging/settings/sms/test-send', data);
  return response.data;
};
