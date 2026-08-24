import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { ShootData } from '@/types/shoots';
import { mergeAcceptedShootFiles } from '@/hooks/useShootFiles';
import {
  ensureUploadAttemptIdentity,
  parseCanonicalUploadResponse,
  resolveEligibleUploadServices,
  rotateUploadAttemptKey,
} from './mediaUploadUtils';

describe('canonical upload results', () => {
  it('keeps a 38 accepted / 6 failed partial batch internally consistent', () => {
    const uploadedFiles = Array.from({ length: 38 }, (_, index) => ({
      id: index + 1,
      filename: `photo-${index + 1}.jpg`,
      media_type: 'raw',
      workflow_stage: 'todo',
      is_ai_edited: index === 0,
      ai_editing_metadata: index === 0 ? { provider: 'autoenhance' } : null,
    }));
    const errors = Array.from({ length: 6 }, (_, index) => ({
      filename: `failed-${index + 1}.jpg`,
      error_type: 'storage_failure',
      retryable: true,
    }));

    const result = parseCanonicalUploadResponse(JSON.stringify({
      uploaded_files: uploadedFiles,
      errors,
      success_count: 38,
      error_count: 6,
      partial_success: true,
    }));

    expect(result.successCount).toBe(38);
    expect(result.uploadedFiles).toHaveLength(38);
    expect(result.errorCount).toBe(6);
    expect(result.errors).toHaveLength(6);
    expect(result.partialSuccess).toBe(true);
    expect(result.uploadedFiles[0]).toMatchObject({
      is_ai_edited: true,
      ai_editing_metadata: { provider: 'autoenhance' },
    });

    const queryClient = new QueryClient();
    queryClient.setQueryData(['shootFiles', 44, 'raw'], []);
    queryClient.setQueryData(['shootFiles', 44, 'all'], []);
    mergeAcceptedShootFiles(queryClient, 44, 'raw', result.uploadedFiles);
    expect(queryClient.getQueryData(['shootFiles', 44, 'raw'])).toHaveLength(38);
    expect(queryClient.getQueryData(['shootFiles', 44, 'all'])).toHaveLength(38);
  });

  it('does not infer acceptance when the server reports zero successes', () => {
    const result = parseCanonicalUploadResponse(JSON.stringify({
      uploaded_files: [],
      errors: [{ filename: 'bad.jpg', error_type: 'invalid_file' }],
      success_count: 0,
      error_count: 1,
      partial_success: false,
    }));

    expect(result.successCount).toBe(0);
    expect(result.uploadedFiles).toEqual([]);
  });
});

describe('upload attempt identity', () => {
  it('reuses unknown-outcome keys and rotates only the attempt key for a confirmed retry', () => {
    const file = new File(['pixels'], 'front.jpg', { type: 'image/jpeg' });
    const first = ensureUploadAttemptIdentity(file, 'batch-44', 12, 44);
    const replay = ensureUploadAttemptIdentity(file, 'different-batch', 0, 1);

    expect(replay).toEqual(first);

    rotateUploadAttemptKey(file);
    const retry = ensureUploadAttemptIdentity(file, 'ignored', 0, 1);
    expect(retry.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(retry).toMatchObject({ batchId: 'batch-44', batchIndex: 12, batchTotal: 44 });
  });
});

describe('service provenance', () => {
  // Every row carries its execution-row id and its declared upload capability. Both
  // are required now: the id because it is the value the endpoint validates, and the
  // capability because a bookable service is not automatically an upload target.
  const shoot = {
    editor: { id: 9 },
    serviceItems: [
      {
        id: 1, shoot_service_id: 1, name: 'Photos', upload_intake_type: 'photo',
        photographer_id: 7, editor_id: 8, requires_editing: true,
      },
      {
        id: 2, shoot_service_id: 2, name: 'Video', upload_intake_type: 'video',
        photographer_id: 6, editor_id: 9, requires_editing: true,
      },
      {
        id: 3, shoot_service_id: 3, name: 'Delivery only', upload_intake_type: 'photo',
        photographer_id: 7, editor_id: 9, requires_editing: false,
      },
    ],
  } as unknown as ShootData;

  it('shows photographers only directly assigned service items', () => {
    expect(resolveEligibleUploadServices(shoot, { id: 7, role: 'photographer' }, 'raw'))
      .toEqual([
        { id: '1', label: 'Photos' },
        { id: '3', label: 'Delivery only' },
      ]);
  });

  it('keeps the video-only service out of the photo lane and in the video lane', () => {
    expect(resolveEligibleUploadServices(shoot, { id: 6, role: 'photographer' }, 'raw'))
      .toEqual([]);
    expect(resolveEligibleUploadServices(shoot, { id: 6, role: 'photographer' }, 'raw', ['video']))
      .toEqual([{ id: '2', label: 'Video' }]);
  });

  it('lets the legacy top-level editor choose editing-required items only', () => {
    // Edited uploads are gated by the requires-editing capability, not by raw lanes,
    // so the video service is still a valid destination for finished edits.
    expect(resolveEligibleUploadServices(shoot, { id: 9, role: 'editor' }, 'edited'))
      .toEqual([
        { id: '1', label: 'Photos' },
        { id: '2', label: 'Video' },
      ]);
  });
});
