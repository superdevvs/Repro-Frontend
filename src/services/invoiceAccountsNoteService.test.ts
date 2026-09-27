import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api';
import { fetchInvoiceAccountsNote, saveInvoiceAccountsNote } from './invoiceAccountsNoteService';

vi.mock('@/services/api', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
describe('Invoice accounts note response validation', () => {
  it.each([null, {}, { data: null }, { data: {} }, { data: { note: 42 } }, { data: { note: null } }])(
    'rejects a malformed note response for the component error state: %j',
    async (payload) => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: payload });
      await expect(fetchInvoiceAccountsNote(9)).rejects.toThrow('accounts note response was invalid');
    },
  );
  it('preserves valid text including empty notes and safely normalizes optional metadata', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { note: '', author: 'bad', created_at: 42 } } });
    await expect(fetchInvoiceAccountsNote(9)).resolves.toEqual({ note: '', author: null, created_at: null, updated_at: null });
  });
  it('validates saves too, so invalid responses cannot replace a draft with undefined', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { data: {} } });
    await expect(saveInvoiceAccountsNote(9, 'Keep this draft')).rejects.toThrow('accounts note response was invalid');
    expect(apiClient.put).toHaveBeenCalledWith('/admin/invoices/9/accounts-note', { note: 'Keep this draft' });
  });
});
