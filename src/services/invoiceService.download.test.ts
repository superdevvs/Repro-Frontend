import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadInvoiceCsv, parseContentDispositionFilename } from './invoiceService';

const originalCreateObjectUrl = window.URL.createObjectURL;
const originalRevokeObjectUrl = window.URL.revokeObjectURL;

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window.URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: originalCreateObjectUrl,
  });
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: originalRevokeObjectUrl,
  });
});

describe('parseContentDispositionFilename', () => {
  it('prefers and decodes an RFC 5987 filename', () => {
    expect(parseContentDispositionFilename(
      'attachment; filename="fallback.csv"; filename*=UTF-8\'\'Invoice%20August%202026.csv',
    )).toBe('Invoice August 2026.csv');
  });

  it('removes path traversal and browser-invalid filename characters', () => {
    expect(parseContentDispositionFilename(
      'attachment; filename="../../client:invoice?.csv"',
    )).toBe('client-invoice-.csv');
  });
});

describe('downloadInvoiceCsv', () => {
  it('sends authentication and surfaces the API error message', async () => {
    localStorage.setItem('authToken', 'test-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Forbidden',
      clone: () => ({
        json: vi.fn().mockResolvedValue({ message: 'You cannot download this invoice.' }),
      }),
      text: vi.fn().mockResolvedValue(''),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadInvoiceCsv('client/42')).rejects.toThrow('You cannot download this invoice.');

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/invoices/client%2F42/download');
    expect(request.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      Accept: 'text/csv, application/json',
    });
  });

  it('downloads the blob under the server-provided filename', async () => {
    localStorage.setItem('authToken', 'test-token');
    const createObjectUrl = vi.fn().mockReturnValue('blob:invoice-download');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrl,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const blob = new Blob(['Invoice ID,42'], { type: 'text/csv' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => name.toLowerCase() === 'content-disposition'
          ? 'attachment; filename*=UTF-8\'\'Invoice%2000042.csv'
          : null,
      },
      blob: vi.fn().mockResolvedValue(blob),
    }));

    await expect(downloadInvoiceCsv(42)).resolves.toBe('Invoice 00042.csv');

    expect(createObjectUrl).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:invoice-download');
  });
});
