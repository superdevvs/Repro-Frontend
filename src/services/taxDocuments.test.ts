import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api';
import { downloadTaxDocument, readTaxDocument, uploadTaxDocument, validateTaxDocument } from './taxDocuments';

vi.mock('@/services/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

describe('tax document transport', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('uses dedicated authenticated API endpoints and multipart upload data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { tax_document: null } });
    expect(await readTaxDocument()).toBeNull();
    expect(apiClient.get).toHaveBeenCalledWith('/profile/tax-document', { signal: undefined });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { tax_document: { id: 'new' } } });
    const file = new File(['pdf'], 'tax.pdf');
    expect(await uploadTaxDocument(file, ' note ')).toEqual({ id: 'new' });
    const [path, body] = vi.mocked(apiClient.post).mock.calls[0];
    expect(path).toBe('/profile/tax-document');
    expect((body as FormData).get('document')).toBe(file);
    expect((body as FormData).get('notes')).toBe('note');
  });

  it('downloads an authenticated blob and discards the local object URL', async () => {
    vi.useFakeTimers();
    const blob = new Blob(['private']);
    vi.mocked(apiClient.get).mockResolvedValue({ data: blob });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:local-document');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe('blob:local-document');
      expect(this.download).toBe('tax.pdf');
    });
    await downloadTaxDocument('tax.pdf');
    expect(apiClient.get).toHaveBeenCalledWith('/profile/tax-document/download', { responseType: 'blob' });
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(document.querySelector('a')).toBeNull();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-document');
  });

  it('rejects empty and oversized files as well as unsupported extensions', () => {
    expect(validateTaxDocument(null)).toContain('Choose');
    expect(validateTaxDocument(new File([], 'empty.pdf'))).toContain('not empty');
    expect(validateTaxDocument(new File(['one'], 'file.exe'))).toContain('PDF');
    const oversized = new File(['one'], 'large.pdf');
    Object.defineProperty(oversized, 'size', { value: 10 * 1024 * 1024 + 1 });
    expect(validateTaxDocument(oversized)).toContain('10 MB');
  });
});
