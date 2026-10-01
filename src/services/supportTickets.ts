import { apiClient } from './api';

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
}
export interface TicketDetail { data: SupportTicket; messages: TicketMessage[]; meta: { current_page: number; last_page: number; total: number } }
export interface TicketList { data: SupportTicket[]; meta: { can_manage: boolean; categories: string[]; statuses: SupportStatus[]; pagination: { current_page: number; last_page: number; total: number; per_page: number } } }
export interface TicketDraft { request_key: string; subject: string; body: string; category: string; page_path?: string }
export const supportStatusLabel = (status: string) => ({ open: 'Open', in_progress: 'In progress', waiting: 'Waiting for reply', resolved: 'Resolved' })[status] || status;
export const listSupportTickets = async (params: { page: number; query?: string; status?: string }, signal?: AbortSignal): Promise<TicketList> => (await apiClient.get('/support/tickets', { params: { ...params, per_page: 20 }, signal })).data;
export const getSupportTicket = async (id: number, page: number, signal?: AbortSignal): Promise<TicketDetail> => (await apiClient.get(`/support/tickets/${id}`, { params: { page }, signal })).data;
export const createSupportTicket = async (data: TicketDraft): Promise<SupportTicket> => (await apiClient.post('/support/tickets', data)).data.data;
export const replySupportTicket = async (id: number, data: { request_key: string; body: string; internal: boolean }): Promise<SupportTicket> => (await apiClient.post(`/support/tickets/${id}/replies`, data)).data.data;
export const updateSupportTicket = async (id: number, data: { version: number; status?: SupportStatus; priority?: 'normal' | 'urgent'; assigned_to?: number | null }): Promise<SupportTicket> => (await apiClient.patch(`/support/tickets/${id}`, data)).data.data;
export const listSupportAssignees = async (): Promise<Array<{ id: number; name: string }>> => (await apiClient.get('/support/tickets/assignees')).data.data;
