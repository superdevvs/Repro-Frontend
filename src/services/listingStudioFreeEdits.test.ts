import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFreeEditsEligibility, submitFreeEdits } from './listingStudioFreeEdits';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('./api', () => ({ apiClient: api }));
beforeEach(() => vi.clearAllMocks());

describe('free photo edit API', () => {
  it('loads current eligibility using an abortable authenticated request', async () => {
    const eligibility = { eligible: true }; api.get.mockResolvedValue({ data: { data: eligibility } });
    const signal = new AbortController().signal;
    expect(await getFreeEditsEligibility(signal)).toEqual(eligibility);
    expect(api.get).toHaveBeenCalledWith('/listing-studio/free-edits', { signal });
  });
  it('pairs each uploaded photo with its requested edit and retains the idempotency key', async () => {
    api.post.mockResolvedValue({ data: { data: { id: 7 } } });
    const files = [new File(['first'], 'first.jpg'), new File(['second'], 'second.png'), new File(['third'], 'third.webp')];
    await submitFreeEdits({ request_key: 'same-retry-key', attachments: files, edit_types: ['twilight', 'virtual_staging', 'green_grass'], notes: '  Leave the walls unchanged.  ' });
    const [path, form, config] = api.post.mock.calls[0];
    expect(path).toBe('/listing-studio/free-edits');
    expect(form.get('request_key')).toBe('same-retry-key');
    expect(form.get('notes')).toBe('Leave the walls unchanged.');
    expect(form.get('attachments[0]')).toEqual(files[0]);
    expect(form.get('attachments[2]')).toEqual(files[2]);
    expect(form.get('edit_types[0]')).toBe('twilight');
    expect(form.get('edit_types[2]')).toBe('green_grass');
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
  });
});
