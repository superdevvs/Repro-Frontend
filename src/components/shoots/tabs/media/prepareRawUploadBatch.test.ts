import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareRawUploadBatch } from './prepareRawUploadBatch';
import { ensureUploadAttemptIdentity } from './uploadAttemptIdentity';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const options = () => ({ shootId: 42, files: [new File(['raw'], 'photo.cr3')], batchId: crypto.randomUUID(), serviceId: '7', headers: { Authorization: 'Bearer token' } });

describe('durable RAW batch negotiation', () => {
  it('prepares the batch and preserves original positions on retries after two hours', async () => {
    const input = options();
    const identity = ensureUploadAttemptIdentity(input.files[0], input.batchId, 7, 20);
    const fetcher = vi.fn(async (_url, init) => ({ ok: true, status: 200, json: async () => ({ batch_id: JSON.parse(init.body).batch_id, parallel_uploads: 2 }) }));
    vi.stubGlobal('fetch', fetcher);
    expect(await prepareRawUploadBatch(input)).toBe(2);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 3 * 60 * 60 * 1000);
    expect(await prepareRawUploadBatch({ ...input, batchId: crypto.randomUUID() })).toBe(2);
    const bodies = fetcher.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(bodies[0]).toEqual({ type: 'raw', batch_id: identity.batchId, total_files: 20, service_id: 7, upload_lane: 'photo', upload_type: 'raw', upload_batch_id: identity.batchId, upload_batch_total: 20, shoot_service_id: 7 });
    expect(bodies[1]).toEqual(bodies[0]);
  });
  it('keeps an older draft reservation server serial during a mixed release', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      expect(body.upload_type).toBe('raw');
      return { ok: true, status: 201, json: async () => ({ upload_batch_id: body.upload_batch_id, upload_batch_total: body.upload_batch_total, parallel_uploads: 2 }) };
    }));
    expect(await prepareRawUploadBatch(options())).toBe(1);
  });
  it.each([404, 405])('falls back to serial only when the endpoint is unsupported (%i)', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status })));
    expect(await prepareRawUploadBatch(options())).toBe(1);
  });
  it.each([401, 403, 409, 422, 429, 500])('stops on a batch preparation error (%i)', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status, json: async () => ({ message: 'Batch refused' }) })));
    await expect(prepareRawUploadBatch(options())).rejects.toThrow('Batch refused');
  });
  it('stops on a lost response rather than bypassing preparation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(prepareRawUploadBatch(options())).rejects.toThrow('offline');
  });
});
