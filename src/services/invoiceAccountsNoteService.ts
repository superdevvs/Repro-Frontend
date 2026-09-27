import { apiClient } from '@/services/api';

export interface InvoiceAccountsNote {
  note: string;
  author: { id: number; name: string } | null;
  created_at: string | null;
  updated_at: string | null;
}

const parseAccountsNote = (payload: unknown): InvoiceAccountsNote => {
  const envelope = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
  const data = envelope?.data && typeof envelope.data === 'object'
    ? envelope.data as Record<string, unknown> : null;
  if (!data || typeof data.note !== 'string') {
    throw new Error('The accounts note response was invalid. Please reload and try again.');
  }
  const author = data.author && typeof data.author === 'object' ? data.author as Record<string, unknown> : null;
  return {
    note: data.note,
    author: author && typeof author.id === 'number' && typeof author.name === 'string'
      ? { id: author.id, name: author.name } : null,
    created_at: typeof data.created_at === 'string' ? data.created_at : null,
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : null,
  };
};

export async function fetchInvoiceAccountsNote(invoiceId: number): Promise<InvoiceAccountsNote> {
  const response = await apiClient.get<unknown>(`/admin/invoices/${invoiceId}/accounts-note`);
  return parseAccountsNote(response.data);
}

export async function saveInvoiceAccountsNote(invoiceId: number, note: string): Promise<InvoiceAccountsNote> {
  const response = await apiClient.put<unknown>(`/admin/invoices/${invoiceId}/accounts-note`, { note });
  return parseAccountsNote(response.data);
}
