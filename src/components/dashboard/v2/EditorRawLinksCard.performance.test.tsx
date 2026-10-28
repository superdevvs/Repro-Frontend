import React from 'react';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { EditorRawLinksCard } from './EditorRawLinksCard';

vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer test' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
const shoots = Array.from({ length: 12 }, (_, index) => ({
  id: String(index + 1), updatedAt: '2026-10-28T10:00:00Z',
  location: { address: `Property ${index + 1}` }, rawPhotoCount: 3,
})) as ShootData[];
const response = (data: unknown) => ({ ok: true, json: async () => ({ data }) }) as Response;
const card = (rows = shoots, editorId = 1) => <MemoryRouter><EditorRawLinksCard shoots={rows} editorId={editorId} /></MemoryRouter>;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('editor raw-link request bounds', () => {
  it('only requests the five visible rows and avoids refetching on unrelated history completion', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => response([]));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(card());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
    view.rerender(card(shoots.map(shoot => ({ ...shoot }))));
    await act(async () => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls.map(call => String(call[0])).filter(url => url.includes('/share-links')))
      .toEqual([1, 2, 3, 4, 5].map(id => expect.stringContaining(`/shoots/${id}/share-links`)));
    const changed = shoots.map(shoot => shoot.id === '12' ? { ...shoot, updatedAt: '2026-10-29T10:00:00Z' } : shoot);
    view.rerender(card(changed));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(11));
    expect(fetchMock.mock.calls.map(call => String(call[0]))).toContainEqual(expect.stringContaining('/shoots/12/share-links'));
  });

  it('aborts obsolete requests and never publishes a previous editor scope response', async () => {
    const requests: Array<{ signal: AbortSignal; finish: (value: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
      if (!String(input).includes('/share-links')) return Promise.resolve(response({}));
      return new Promise<Response>(finish => { requests.push({ signal: options?.signal as AbortSignal, finish }); });
    }));
    const view = render(card(shoots.slice(0, 1)));
    await waitFor(() => expect(requests).toHaveLength(1));
    view.rerender(card(shoots.slice(0, 1), 2));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0].signal.aborted).toBe(true);
    await act(async () => requests[0].finish(response([{ id: 1, share_url: 'https://example.test/old', media_stage: 'raw' }])));
    expect(screen.getByRole('button', { name: 'Share link' })).toBeDisabled();
    await act(async () => requests[1].finish(response([{ id: 2, share_url: 'https://example.test/new', media_stage: 'raw' }])));
    expect(screen.getByRole('button', { name: 'Share link' })).toBeEnabled();
    view.unmount();
    expect(requests[1].signal.aborted).toBe(true);
  });
});
