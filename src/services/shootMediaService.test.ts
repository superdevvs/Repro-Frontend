import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { fetchShootMedia, finalizeEditedUploadQueue, getMediaThumbnail, uploadRawPhotos } from './shootMediaService';

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: vi.fn(() => false) } }));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.example.test' }));

describe('shoot media without a cloud connection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves authorized shoot media and local thumbnail URLs', async () => {
    const payload = { data: [{ id: '8', name: 'front.jpg', thumbnail_link: '/storage/shoots/42/thumbs/front.jpg' }], counts: { raw_photo_count: 1 } };
    vi.mocked(axios.get).mockResolvedValueOnce({ data: payload });
    expect(await fetchShootMedia('42', 'raw', 'session-token')).toEqual(payload);
    expect(axios.get).toHaveBeenCalledWith('https://api.example.test/api/shoots/42/media', {
      params: { type: 'raw' }, headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
    });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { url: '/storage/shoots/42/front.jpg' } });
    expect(await getMediaThumbnail('42', '8', 'session-token')).toBe('/storage/shoots/42/front.jpg');
    expect(axios.get).toHaveBeenLastCalledWith('https://api.example.test/api/shoots/42/media/8/download', {
      headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
    });
  });

  it('uploads local files with the bearer session and preserves bracket batch metadata', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { success_count: 1, workflow_status: 'editing', workflow_status_changed: true } });
    const files = [new File(['first'], 'first.jpg', { type: 'image/jpeg' }), new File(['second'], 'second.jpg', { type: 'image/jpeg' })];
    const progress = vi.fn();
    const result = await uploadRawPhotos('42', files, 3, 'session-token', progress);
    expect(result).toMatchObject({ success_count: 2, error_count: 0, workflow_status_changed: true });
    expect(axios.post).toHaveBeenCalledTimes(2);
    const batchIds: FormDataEntryValue[] = [];
    vi.mocked(axios.post).mock.calls.forEach(([url, body, options], index) => {
      expect(url).toBe('https://api.example.test/api/shoots/42/upload');
      expect(options?.headers?.Authorization).toBe('Bearer session-token');
      const data = body as FormData;
      expect(data.get('files[]')).toBe(files[index]);
      expect(data.get('upload_type')).toBe('raw');
      expect(data.get('bracket_mode')).toBe('3');
      expect(data.get('upload_batch_total')).toBe('2');
      expect(data.get('upload_batch_index')).toBe(String(index));
      batchIds.push(data.get('upload_batch_id')!);
    });
    expect(batchIds[0]).toBeTruthy();
    expect(batchIds[0]).toBe(batchIds[1]);
    expect(progress).toHaveBeenLastCalledWith(100);
  });

  it('keeps edited upload finalization on the existing authorized shoot endpoint', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { workflow_status_changed: true, shoot_status: 'editing' } });
    expect(await finalizeEditedUploadQueue(42, { Authorization: 'Bearer session-token' })).toMatchObject({ workflow_status_changed: true });
    expect(axios.post).toHaveBeenCalledWith('https://api.example.test/api/shoots/42/upload/finalize-edited', {}, {
      headers: { Authorization: 'Bearer session-token' },
    });
  });
});
