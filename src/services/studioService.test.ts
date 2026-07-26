import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './api';
import {
  clampProgress,
  createProjectPayload,
  studioService,
  uploadFileId,
} from './studioService';
import { studioMetricsService } from './studioMetricsService';

/**
 * Unit tests for `studioService` (task 9.1).
 *
 * These assert the service maps the implemented `/api/studio/*` response shapes
 * (`{ success, data, meta }`) onto the design's frontend types and that request
 * bodies carry what the Laravel controllers validate.
 */

let get: ReturnType<typeof vi.spyOn>;
let post: ReturnType<typeof vi.spyOn>;
let put: ReturnType<typeof vi.spyOn>;
let del: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Spies are installed per test: `restoreAllMocks` in afterEach detaches them,
  // so re-creating here keeps every test isolated from the real transport.
  get = vi.spyOn(apiClient, 'get');
  post = vi.spyOn(apiClient, 'post');
  put = vi.spyOn(apiClient, 'put');
  del = vi.spyOn(apiClient, 'delete');
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ok = (data: unknown, meta?: unknown) => ({ data: { success: true, data, meta } });

describe('studioService helpers', () => {
  it('clamps progress into 0–100 and rounds', () => {
    expect(clampProgress(-40)).toBe(0);
    expect(clampProgress(0)).toBe(0);
    expect(clampProgress(49.6)).toBe(50);
    expect(clampProgress(1000)).toBe(100);
    expect(clampProgress(Number.NaN)).toBe(0);
  });

  it('builds a shoot-source create payload with the idempotency key', () => {
    const payload = createProjectPayload(
      {
        workflowId: 'photo-enhancement',
        sourceType: 'shoot',
        shootId: 7,
        fileIds: [1, 2],
        name: 'Maple St',
      },
      'req-123',
    );

    expect(payload).toEqual({
      request_id: 'req-123',
      workflow_id: 'photo-enhancement',
      source_type: 'shoot',
      workflow_config: {},
      shoot_id: 7,
      file_ids: [1, 2],
      name: 'Maple St',
    });
  });

  it('builds an upload-source create payload with media refs only', () => {
    const payload = createProjectPayload(
      {
        workflowId: 'listing-video',
        sourceType: 'upload',
        mediaRefs: ['studio/uploads/1/2/a.jpg'],
        targetSeconds: 30,
      },
      'req-456',
    );

    expect(payload).toMatchObject({
      request_id: 'req-456',
      source_type: 'upload',
      media_refs: ['studio/uploads/1/2/a.jpg'],
      target_seconds: 30,
    });
    expect(payload).not.toHaveProperty('file_ids');
    expect(payload).not.toHaveProperty('shoot_id');
  });
});

describe('studioService reads', () => {
  it('returns grouped search results and defaults missing result lists', async () => {
    get.mockResolvedValueOnce(
      ok(
        [
          {
            recordType: 'project',
            label: 'Projects',
            results: [
              {
                recordType: 'project',
                recordId: 'p1',
                title: 'Maple St',
                context: 'Photo Enhancement',
                deepLink: { destination: 'projects', recordType: 'project', recordId: 'p1' },
              },
            ],
          },
          { recordType: 'shoot', label: 'Shoots' },
        ],
        { query: 'maple', total: 1 },
      ),
    );

    const groups = await studioService.search('maple');

    expect(get).toHaveBeenCalledWith('/studio/search', { params: { q: 'maple' } });
    expect(groups[0].results[0].deepLink.destination).toBe('projects');
    expect(groups[1].results).toEqual([]);
  });

  it('normalizes queue records, clamping progress and preserving null ETA', async () => {
    get.mockResolvedValueOnce(
      ok(
        [
          {
            id: 'photo-12',
            aiJobId: '12',
            jobType: 'photo',
            workflowTitle: 'Photo Enhancement',
            context: { type: 'project', id: 'p1', label: 'Maple St' },
            contextLabel: null,
            thumbnailUrl: null,
            status: 'processing',
            progress: 140,
            eta: null,
            failureReason: null,
            terminalAt: null,
            version: '2026-01-01T00:00:00.000Z',
            deepLink: { destination: 'queue', recordType: 'ai_job', recordId: 'photo-12' },
          },
          {
            id: 'video-3',
            aiJobId: '3',
            jobType: 'video',
            workflowTitle: 'Listing Video',
            context: null,
            contextLabel: null,
            thumbnailUrl: null,
            status: 'queued',
            progress: null,
            eta: { estimateSeconds: 60, calculatedAt: '2026-01-01T00:00:00.000Z' },
            failureReason: null,
            terminalAt: null,
            version: '2026-01-01T00:00:00.000Z',
            deepLink: { destination: 'queue', recordType: 'ai_job', recordId: 'video-3' },
          },
        ],
        { retentionHours: 24, calculatedAt: '2026-01-01T00:00:00.000Z' },
      ),
    );

    const records = await studioService.getQueue();

    expect(records[0].progress).toBe(100);
    expect(records[0].contextLabel).toBe('Maple St');
    expect(records[1].progress).toBeNull();
    expect(records[1].eta?.estimateSeconds).toBe(60);
  });

  it('exposes queue retention meta', async () => {
    get.mockResolvedValueOnce(ok([], { retentionHours: 24, calculatedAt: 'now' }));

    await expect(studioService.getQueueWithMeta()).resolves.toEqual({
      records: [],
      retentionHours: 24,
      calculatedAt: 'now',
    });
  });

  it('reads the 30-day metrics summary from both services', async () => {
    const summary = {
      projectsProcessed: 3,
      aiJobsCompleted: 5,
      successRate: 0,
      mediaOutputs: 0,
      windowStart: '2025-12-02T00:00:00+00:00',
      windowEnd: '2026-01-01T00:00:00+00:00',
    };
    get.mockResolvedValue(ok(summary));

    await expect(studioService.getMetricsSummary()).resolves.toEqual(summary);
    await expect(studioMetricsService.getSummary()).resolves.toEqual(summary);
    expect(get).toHaveBeenCalledWith('/studio/metrics/summary');
  });

  it('lists projects and fetches shoot media for a workflow', async () => {
    get.mockResolvedValueOnce(ok([{ id: 'p1', name: 'Maple St', mediaCount: 2 }], { count: 1 }));
    const projects = await studioService.listProjects();
    expect(projects[0].mediaCount).toBe(2);

    get.mockResolvedValueOnce(ok([{ id: 9, shootId: 4, mediaType: 'image' }]));
    const media = await studioService.getShootMedia(4, 'photo-enhancement');

    expect(get).toHaveBeenLastCalledWith('/studio/shoots/4/media', {
      params: { workflow: 'photo-enhancement' },
    });
    expect(media[0].shootId).toBe(4);
  });

  it('returns an empty list when a search or shoot response omits data', async () => {
    get.mockResolvedValueOnce({ data: { success: true } });

    await expect(studioService.searchShoots('nothing')).resolves.toEqual([]);
  });
});

describe('studioService deep-link resolution', () => {
  it('resolves an authorized deep-link', async () => {
    post.mockResolvedValueOnce(
      ok({ destination: 'projects', record: { recordType: 'project', id: 'p1' } }),
    );

    const result = await studioService.resolveDeepLink({
      destination: 'projects',
      recordType: 'project',
      recordId: 'p1',
    });

    expect(post).toHaveBeenCalledWith('/studio/deep-links/resolve', {
      destination: 'projects',
      recordType: 'project',
      recordId: 'p1',
    });
    expect(result).toEqual({
      ok: true,
      destination: 'projects',
      record: { recordType: 'project', id: 'p1' },
    });
  });

  it('reports a forbidden record without exposing record data', async () => {
    post.mockRejectedValueOnce({
      response: {
        status: 403,
        data: {
          success: false,
          error: { code: 'studio_record_forbidden', message: 'Not authorized.' },
        },
      },
    });

    const result = await studioService.resolveDeepLink({
      destination: 'projects',
      recordType: 'project',
      recordId: 'p9',
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('studio_record_forbidden');
    expect(result.record).toBeNull();
  });

  it('rethrows transport failures that carry no server response', async () => {
    const failure = new Error('network down');
    post.mockRejectedValueOnce(failure);

    await expect(
      studioService.resolveDeepLink({ destination: 'command-center' }),
    ).rejects.toBe(failure);
  });
});

describe('studioService mutations', () => {
  it('creates a project and normalizes the returned job ids', async () => {
    post.mockResolvedValueOnce(
      ok({
        projectId: 'p1',
        aiJobId: null,
        aiJobIds: ['1', '2'],
        jobs: [
          { id: '1', type: 'photo' },
          { id: '2', type: 'photo' },
        ],
        deepLink: {
          destination: 'projects',
          recordType: 'project',
          recordId: 'p1',
          workflowId: 'batch-ai-jobs',
        },
        version: 1,
      }),
    );

    const result = await studioService.createProject(
      { workflowId: 'batch-ai-jobs', sourceType: 'shoot', shootId: 4, fileIds: [1, 2] },
      'req-789',
    );

    expect(post).toHaveBeenCalledWith(
      '/studio/projects',
      expect.objectContaining({ request_id: 'req-789', file_ids: [1, 2] }),
    );
    expect(result.aiJobIds).toEqual(['1', '2']);
    expect(result.deepLink.workflowId).toBe('batch-ai-jobs');
  });

  it('uploads per file, reports progress, and keeps accepted files when one is rejected', async () => {
    const good = new File(['a'], 'good.jpg', { type: 'image/jpeg' });
    const bad = new File(['b'], 'bad.txt', { type: 'text/plain' });

    post
      .mockImplementationOnce(async (_url, _body, config: any) => {
        config.onUploadProgress({ loaded: 5, total: 10 });
        return ok({
          accepted: [{ id: 'u1', mediaRef: 'studio/uploads/1/2/u1.jpg', filename: 'good.jpg' }],
          rejected: [],
        });
      })
      .mockRejectedValueOnce({
        response: {
          status: 422,
          data: {
            success: false,
            data: {
              accepted: [],
              rejected: [
                {
                  filename: 'bad.txt',
                  violations: [{ constraint: 'extension', message: 'Extension .txt is not supported' }],
                },
              ],
            },
          },
        },
      });

    const progress: Array<[string, number]> = [];
    const result = await studioService.upload([good, bad], 'photo-enhancement', (id, pct) =>
      progress.push([id, pct]),
    );

    expect(post).toHaveBeenCalledTimes(2);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].clientFileId).toBe(uploadFileId(good, 0));
    expect(result.rejected[0].violations[0].constraint).toBe('extension');
    expect(result.rejected[0].clientFileId).toBe(uploadFileId(bad, 1));
    expect(progress).toEqual([
      [uploadFileId(good, 0), 50],
      [uploadFileId(good, 0), 100],
    ]);
  });

  it('records a request-level violation when an upload fails without server detail', async () => {
    post.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server error' } } });

    const result = await studioService.upload(
      [new File(['a'], 'a.jpg', { type: 'image/jpeg' })],
      'twilight',
    );

    expect(result.accepted).toEqual([]);
    expect(result.rejected[0].violations[0]).toEqual({
      constraint: 'request',
      message: 'Server error',
    });
  });

  it('creates a template with POST and updates with PUT carrying the version', async () => {
    post.mockResolvedValueOnce(ok({ id: 't1', name: 'Bright', version: 1 }));
    await studioService.saveTemplate({
      name: 'Bright',
      workflowId: 'photo-enhancement',
      config: { intensity: 2 },
    });
    expect(post).toHaveBeenCalledWith('/studio/templates', {
      name: 'Bright',
      workflowId: 'photo-enhancement',
      config: { intensity: 2 },
    });

    put.mockResolvedValueOnce(ok({ id: 't1', name: 'Brighter', version: 2 }));
    const updated = await studioService.saveTemplate({
      id: 't1',
      name: 'Brighter',
      workflowId: 'photo-enhancement',
      config: {},
      version: 1,
    });

    expect(put).toHaveBeenCalledWith('/studio/templates/t1', {
      name: 'Brighter',
      workflowId: 'photo-enhancement',
      config: {},
      version: 1,
    });
    expect(updated.version).toBe(2);
  });

  it('deletes a template with its committed version in the request body', async () => {
    del.mockResolvedValueOnce(ok({ id: 't1', deleted: true }));

    await studioService.deleteTemplate('t1', 3);

    expect(del).toHaveBeenCalledWith('/studio/templates/t1', { data: { version: 3 } });
  });

  it('reads and saves brand state with the committed version', async () => {
    get.mockResolvedValueOnce(ok({ teamId: 1, settings: {}, version: 0, updatedBy: null, updatedAt: null }));
    const brand = await studioService.getBrand();
    expect(brand.version).toBe(0);

    put.mockResolvedValueOnce(ok({ teamId: 1, settings: { include_logo: true }, version: 1 }));
    const saved = await studioService.saveBrand({ settings: { include_logo: true }, version: 0 });

    expect(put).toHaveBeenCalledWith('/studio/brand', {
      version: 0,
      settings: { include_logo: true },
    });
    expect(saved.version).toBe(1);
  });
});
