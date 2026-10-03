import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { waitForSavedMedia } from './savedMediaPublication';
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./api', () => ({ apiClient: api }));
vi.mock('./studioWorkspaceService', () => ({ studioError: (error: Error) => error.message }));
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());
it('waits for every saved version to publish before allowing submission', async () => {
  api.get.mockResolvedValueOnce({ data: { data: { status: 'published' } } })
    .mockResolvedValueOnce({ data: { data: { status: 'processing' } } })
    .mockResolvedValueOnce({ data: { data: { status: 'published' } } });
  const result = waitForSavedMedia(9, ['one', 'two']);
  await vi.runAllTimersAsync();
  expect(await result).toMatchObject({ published: true });
  expect(api.get.mock.calls.map(call => call[0])).toEqual(['/shoots/9/media-versions/one', '/shoots/9/media-versions/two', '/shoots/9/media-versions/two']);
});
it.each(['conflict', 'failed'])('preserves the saved outcome when publication is %s', async status => {
  api.get.mockResolvedValue({ data: { data: { status } } });
  expect(await waitForSavedMedia(9, ['one'])).toMatchObject({ published: false, message: expect.stringContaining('saved edit needs review') });
});
it('does not suggest another upload after a status network failure', async () => {
  api.get.mockRejectedValue(new Error('Network unavailable'));
  expect(await waitForSavedMedia(9, ['one'])).toMatchObject({ published: false, message: expect.stringContaining('Uploads are saved') });
});
it('bounds processing waits and honors cancellation', async () => {
  const controller = new AbortController();
  api.get.mockResolvedValue({ data: { data: { status: 'processing' } } });
  const result = waitForSavedMedia(9, ['one'], controller.signal);
  await vi.advanceTimersByTimeAsync(1); controller.abort();
  expect(await result).toMatchObject({ published: false, message: expect.stringContaining('Uploads are saved') });
  expect(api.get).toHaveBeenCalledTimes(1);
});
