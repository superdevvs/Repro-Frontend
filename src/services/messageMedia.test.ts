import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import { apiClient } from './api';
import { fetchMessageMediaBlob, getSmsMessageAttachments, putMessageUploadChunk, sendSmsWithAttachments } from './messageMedia';

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset();
  vi.mocked(apiClient.post).mockReset();
  vi.mocked(apiClient.put).mockReset();
});

describe('message media API', () => {
  it('asks for attachments in batches of 100 and returns only messages that have some', async () => {
    const ids = Array.from({ length: 230 }, (_, index) => String(index + 1));
    vi.mocked(apiClient.post).mockImplementation(async (_url, body) => {
      const batch = (body as { ids: string[] }).ids;
      return { data: { data: Object.fromEntries(batch.map(id => [id, { attachments: id === '150' ? [{ id: 'file-150' }] : [], reactions: [] }])) } };
    });

    const found = await getSmsMessageAttachments(ids);

    expect(vi.mocked(apiClient.post).mock.calls.map(([url, body]) => [url, (body as { kind: string }).kind, (body as { ids: string[] }).ids.length]))
      .toEqual([['/messaging/media/content', 'sms', 100], ['/messaging/media/content', 'sms', 100], ['/messaging/media/content', 'sms', 30]]);
    expect(found).toEqual({ '150': [{ id: 'file-150' }] });
  });

  it('downloads private media through the signed-in API client only from its own media routes', async () => {
    const blob = new Blob(['x']);
    vi.mocked(apiClient.get).mockResolvedValue({ data: blob });

    await expect(fetchMessageMediaBlob('/api/messaging/media/files/abc?preview=1')).resolves.toBe(blob);
    expect(apiClient.get).toHaveBeenCalledWith('/messaging/media/files/abc?preview=1', { responseType: 'blob', signal: undefined });

    await expect(fetchMessageMediaBlob('https://files.example.test/abc')).rejects.toThrow('Unexpected attachment address.');
    await expect(fetchMessageMediaBlob('/api/users/1')).rejects.toThrow('Unexpected attachment address.');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('uploads a chunk as raw bytes to its numbered slot', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { id: 'u1', received_bytes: 4 } });
    const chunk = new Blob(['test']);

    await putMessageUploadChunk('u1', 3, chunk);

    expect(apiClient.put).toHaveBeenCalledWith('/messaging/media/uploads/u1/chunks/3', chunk,
      expect.objectContaining({ headers: { 'Content-Type': 'application/octet-stream' } }));
  });

  it('sends an SMS reply with its attachment ids and replay key on the SMS channel', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, id: '9' } });

    await sendSmsWithAttachments({ request_key: 'key', conversation_id: '51', body: 'Hi', sender_id: 2, attachment_ids: ['a', 'b'] });

    expect(apiClient.post).toHaveBeenCalledWith('/messaging/media/send',
      { request_key: 'key', conversation_id: '51', body: 'Hi', sender_id: 2, attachment_ids: ['a', 'b'], channel: 'sms' });
  });
});
