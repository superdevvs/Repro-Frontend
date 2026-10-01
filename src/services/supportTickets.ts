import { apiClient } from './api';

export const supportTime = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export type SupportStatus = 'open' | 'in_progress' | 'waiting' | 'resolved';
export interface SupportTicket {
  id: number; reference: string; subject: string; category: string;
  status: SupportStatus; priority: 'normal' | 'urgent'; page_path: string | null; version: number;
  requester: { id: number; name: string; role: string } | null;
  assignee: { id: number; name: string } | null;
  created_at: string; updated_at: string; can_manage: boolean;
}
export interface TicketMessage {
  id: number; body: string; internal: boolean; kind: 'opened' | 'reply' | 'note' | 'event';
  author: { id: number; name: string } | null; created_at: string;
  attachments?: Array<{ index: number; name: string; size: number; type: string; download_url: string }>;
}
export interface TicketDetail { data: SupportTicket; messages: TicketMessage[]; meta: { current_page: number; last_page: number; total: number } }
export interface TicketList { data: SupportTicket[]; meta: { can_manage: boolean; categories: string[]; statuses: SupportStatus[]; pagination: { current_page: number; last_page: number; total: number; per_page: number } } }
export interface TicketDraft { request_key: string; subject: string; body: string; category: string; page_path?: string; attachments?: File[] }
function requestBody(data: TicketDraft | { request_key: string; body: string; internal: boolean; attachments?: File[] }) {
  if (!data.attachments?.length) { const { attachments: _attachments, ...json } = data; return json; }
  const form = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'attachments' && value !== undefined) form.append(key, typeof value === 'boolean' ? value ? '1' : '0' : String(value));
  }
  for (const file of data.attachments) form.append('attachments[]', file);
  return form;
}
export const supportStatusLabel = (status: string) => ({ open: 'Open', in_progress: 'In progress', waiting: 'Waiting for reply', resolved: 'Resolved' })[status] || status;
export const listSupportTickets = async (params: { page: number; query?: string; status?: string }, signal?: AbortSignal): Promise<TicketList> => (await apiClient.get('/support/tickets', { params: { ...params, per_page: 20 }, signal })).data;
export const getSupportTicket = async (id: number, page: number, signal?: AbortSignal): Promise<TicketDetail> => (await apiClient.get(`/support/tickets/${id}`, { params: { page }, signal })).data;
export const getLegacySupportTicket = async (messageId: number, signal?: AbortSignal): Promise<{ support_ticket_id: number }> => (await apiClient.get(`/support/tickets/legacy-message/${messageId}`, { signal })).data;
export const createSupportTicket = async (data: TicketDraft): Promise<SupportTicket> => (await apiClient.post('/support/tickets', requestBody(data), data.attachments?.length ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)).data.data;
export const replySupportTicket = async (id: number, data: { request_key: string; body: string; internal: boolean; attachments?: File[] }): Promise<SupportTicket> => (await apiClient.post(`/support/tickets/${id}/replies`, requestBody(data), data.attachments?.length ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)).data.data;
export async function downloadSupportAttachment(ticketId: number, messageId: number, index: number, name: string) {
  // Build the authenticated endpoint locally; never send credentials to a stored attachment URL.
  const response = await apiClient.get<Blob>(`/support/tickets/${ticketId}/messages/${messageId}/attachments/${index}`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const updateSupportTicket = async (id: number, data: { version: number; status?: SupportStatus; priority?: 'normal' | 'urgent'; assigned_to?: number | null }): Promise<SupportTicket> => (await apiClient.patch(`/support/tickets/${id}`, data)).data.data;
export const listSupportAssignees = async (): Promise<Array<{ id: number; name: string }>> => (await apiClient.get('/support/tickets/assignees')).data.data;
