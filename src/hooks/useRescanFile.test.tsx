/**
 * Unit tests for the useRescanFile hook (Req 15.8).
 *
 * Covers the happy path (200 with `{ scan_status: 'quarantined' }`), the
 * non-failed rejection (409), and that a successful rescan invalidates the
 * shootFiles query keys so the badge in the file list flips to "Scanning"
 * on the next refresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useRescanFile } from './useRescanFile';
import { apiClient } from '@/services/api';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const wrapWithClient = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useRescanFile', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it('POSTs to the rescan endpoint and returns the new scan_status on success', async () => {
    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { message: 'Scan re-enqueued.', scan_status: 'quarantined' } } as never);

    const { result } = renderHook(() => useRescanFile(), {
      wrapper: wrapWithClient(queryClient),
    });

    let mutateResult: unknown;
    await act(async () => {
      mutateResult = await result.current.mutateAsync({ shootId: 42, fileId: 'abc-123' });
    });

    expect(postSpy).toHaveBeenCalledWith('/shoots/42/files/abc-123/rescan');
    expect(mutateResult).toEqual({
      message: 'Scan re-enqueued.',
      scan_status: 'quarantined',
    });
    await waitFor(() => {
      expect(result.current.data).toEqual({
        message: 'Scan re-enqueued.',
        scan_status: 'quarantined',
      });
    });
  });

  it('invalidates shootFiles query keys for raw, edited, and all on success', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { scan_status: 'quarantined' },
    } as never);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRescanFile(), {
      wrapper: wrapWithClient(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ shootId: 42, fileId: 'abc-123' });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        ['shootFiles', 42, 'raw'],
        ['shootFiles', 42, 'edited'],
        ['shootFiles', 42, 'all'],
      ]),
    );
  });

  it('surfaces a 409 conflict from the backend as an axios error', async () => {
    const conflict = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          message: 'Only files whose scan failed can be re-scanned.',
          scan_status: 'clean',
        },
      },
    };
    vi.spyOn(apiClient, 'post').mockRejectedValue(conflict as never);

    const { result } = renderHook(() => useRescanFile(), {
      wrapper: wrapWithClient(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ shootId: 42, fileId: 'abc-123' }),
      ).rejects.toMatchObject({
        response: { status: 409 },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.response?.status).toBe(409);
    expect(result.current.error?.response?.data?.scan_status).toBe('clean');
  });
});
