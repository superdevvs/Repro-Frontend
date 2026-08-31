import { afterEach, describe, expect, it, vi } from 'vitest';

import { submitWeeklyInvoiceChangesForApproval } from './invoiceService';

describe('weekly invoice change submission', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('sends photographer changes to the approval queue instead of the reject endpoint', async () => {
    localStorage.setItem('authToken', 'test-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ message: 'Submitted', invoice: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await submitWeeklyInvoiceChangesForApproval(
      42,
      'photographer',
      'Corrected the package and payout amount.',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/photographer/invoices/42/submit-for-approval');
    expect(url).not.toContain('/reject');
    expect(request.method).toBe('POST');
    expect(request.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    expect(JSON.parse(String(request.body))).toEqual({
      notes: 'Corrected the package and payout amount.',
    });
  });
});
