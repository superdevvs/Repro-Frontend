import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import type { WeeklyInvoice } from './invoiceService';

export type PayoutEditorRole = 'admin' | 'photographer' | 'salesRep';
export interface PayoutShootCandidate {
  shoot_id: number;
  shoot_service_id: number;
  address: string;
  service_name: string;
  scheduled_date: string | null;
  completed_date: string | null;
  amount: number;
  eligible: boolean;
  unavailable_reason: string | null;
  earning_week: string | null;
  outside_period: boolean;
}
export interface PayoutEditInput {
  action?: 'add_shoot' | 'add_external' | 'add_expense';
  description?: string;
  amount?: number;
  quantity?: number;
  shoot_id?: number;
  shoot_service_id?: number;
  reference?: string;
  work_date?: string;
  address?: string;
  reason?: string;
  verified?: boolean;
  reconcile_history?: boolean;
}
const prefix = (role: PayoutEditorRole, id: number) => `${API_BASE_URL}/api/${role === 'salesRep' ? 'salesrep' : role}/invoices/${id}`;
async function request<T>(url: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const response = await fetch(url, {
    method, signal,
    headers: { ...getApiHeaders(), Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    const validation = Object.values(result.errors ?? {}).flat().find((value) => typeof value === 'string');
    throw new Error(typeof validation === 'string' ? validation : result.message || 'Unable to update payout invoice');
  }
  return result as T;
}
export const fetchPayoutEditor = (role: PayoutEditorRole, id: number, signal?: AbortSignal) =>
  request<{ invoice: WeeklyInvoice }>(`${prefix(role, id)}/edit`, 'GET', undefined, signal);
export const fetchPayoutShootCandidates = (role: PayoutEditorRole, id: number, search: string, date: string, signal?: AbortSignal) => {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (date) params.set('date', date);
  return request<{ data: PayoutShootCandidate[] }>(`${prefix(role, id)}/shoot-candidates?${params}`, 'GET', undefined, signal);
};
export const savePayoutInvoiceItem = (role: PayoutEditorRole, invoice: WeeklyInvoice, data: PayoutEditInput, itemId?: number) =>
  request<{ invoice: WeeklyInvoice }>(`${prefix(role, invoice.id)}/edit/items${itemId ? `/${itemId}` : ''}`, itemId ? 'PATCH' : 'POST', { ...data, expected_revision: invoice.payout_review?.revision ?? 0 });
export const removePayoutInvoiceItem = (role: PayoutEditorRole, invoice: WeeklyInvoice, itemId: number, reason: string) =>
  request<{ invoice: WeeklyInvoice }>(`${prefix(role, invoice.id)}/edit/items/${itemId}`, 'DELETE', { reason, expected_revision: invoice.payout_review?.revision ?? 0 });
