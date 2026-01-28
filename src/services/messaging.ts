import { apiClient } from './api';
import type {
  Message,
  MessageTemplate,
  MessageChannelConfig,
  AutomationRule,
  MessageThread,
  ComposeEmailPayload,
  ScheduleEmailPayload,
  MessagingOverview,
  SmsThreadSummary,
  SmsThreadDetail,
  SmsMessageDetail,
  SmsContact,
} from '@/types/messaging';

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

export const testSendTemplate = async (id: number, data: { to: string; variables?: Record<string, any> }): Promise<void> => {
  await apiClient.post(`/messaging/templates/${id}/test-send`, data);
};

export const previewTemplate = async (id: number, variables?: Record<string, any>): Promise<any> => {
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

export const testAutomation = async (id: number, data: { test_email: string; test_context?: Record<string, any> }): Promise<any> => {
  const response = await apiClient.post(`/messaging/automations/${id}/test`, data);
  return response.data;
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

export const getEmailThreads = async (params?: {
  per_page?: number;
  page?: number;
}): Promise<{ data: MessageThread[]; total: number; current_page: number; last_page: number }> => {
  const response = await apiClient.get('/messaging/email/threads', { params });
  return response.data;
};

export const composeEmail = async (data: ComposeEmailPayload): Promise<Message> => {
  const response = await apiClient.post('/messaging/email/compose', data);
  return response.data;
};

export const scheduleEmail = async (data: ScheduleEmailPayload): Promise<Message> => {
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
}): Promise<{ data: SmsThreadSummary[]; meta: any }> => {
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

export const getSmsSettings = async (): Promise<{ numbers: any[] }> => {
  const response = await apiClient.get('/messaging/settings/sms');
  return response.data;
};

export const saveSmsSettings = async (data: { numbers: any[] }): Promise<any> => {
  const response = await apiClient.post('/messaging/settings/sms', data);
  return response;
};

export const testSmsConnection = async (apiKey?: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  const response = await apiClient.post('/messaging/settings/sms/test-connection', { api_key: apiKey });
  return response.data;
};

export const testSmsSend = async (data: { to: string; message: string; sms_number_id?: number }): Promise<{ success: boolean; message_id?: string; error?: string }> => {
  const response = await apiClient.post('/messaging/settings/sms/test-send', data);
  return response.data;
};

export const syncSmsMessages = async (hours?: number): Promise<{ success: boolean; message?: string; output?: string; error?: string }> => {
  const response = await apiClient.post('/messaging/settings/sms/sync', { hours });
  return response.data;
};

