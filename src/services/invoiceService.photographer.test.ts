import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addWeeklyInvoiceCharge,
  addWeeklyInvoiceExpense,
  fetchPhotographerInvoices,
  removeWeeklyInvoiceCharge,
  submitWeeklyInvoiceForApproval,
  updateWeeklyInvoiceItem,
} from './invoiceService';

describe('photographer invoice API client', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  const stubOk = (payload: unknown) => {
    localStorage.setItem('authToken', 'test-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('lists the authenticated photographer invoices', async () => {
    const fetchMock = stubOk({ data: [{ id: 7 }], current_page: 1, last_page: 1, total: 1 });

    await fetchPhotographerInvoices({ page: 2, per_page: 25 });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/photographer/invoices?page=2&per_page=25');
    expect(request.headers).toMatchObject({ Authorization: 'Bearer test-token' });
  });

  it('posts expenses, charges, item edits, and approval through photographer routes', async () => {
    const fetchMock = stubOk({ message: 'ok', item: { id: 3 }, invoice: { id: 9 } });

    await addWeeklyInvoiceExpense(9, 'photographer', { description: 'Parking', amount: 25 });
    await addWeeklyInvoiceCharge(9, 'photographer', { description: 'Twilight', amount: 50, quantity: 1 });
    await updateWeeklyInvoiceItem(9, 3, 'photographer', { amount: 30 });
    await removeWeeklyInvoiceCharge(9, 4, 'photographer');
    await submitWeeklyInvoiceForApproval(9, 'photographer', 'Ready for accounts.');

    const urls = fetchMock.mock.calls.map(([url, request]) => [url, request.method]);
    expect(urls).toEqual([
      [expect.stringContaining('/api/photographer/invoices/9/expenses'), 'POST'],
      [expect.stringContaining('/api/photographer/invoices/9/charges'), 'POST'],
      [expect.stringContaining('/api/photographer/invoices/9/items/3'), 'PATCH'],
      [expect.stringContaining('/api/photographer/invoices/9/charges/4'), 'DELETE'],
      [expect.stringContaining('/api/photographer/invoices/9/submit-for-approval'), 'POST'],
    ]);
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({
      description: 'Parking',
      amount: 25,
    });
    expect(JSON.parse(String((fetchMock.mock.calls[4][1] as RequestInit).body))).toEqual({
      notes: 'Ready for accounts.',
    });
  });

  it('refuses to add charges on a sales-rep invoice', async () => {
    await expect(
      addWeeklyInvoiceCharge(9, 'salesRep', { description: 'Nope', amount: 1 }),
    ).rejects.toThrow('only supported for photographers');
  });
});
