import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootsProvider } from './ShootsProvider';
import { useShoots } from './shootsContextState';

const auth = vi.hoisted(() => ({
  user: { id: '42', name: 'Office', role: 'admin' },
  logout: vi.fn(),
}));
const effects = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ ...auth, isImpersonating: false }) }));
vi.mock('@/components/ui/use-toast', () => ({ toast: effects.toast }));

const response = (payload: unknown, status = 200) => ({
  ok: status === 200, status, text: async () => JSON.stringify(payload),
}) as Response;

const Probe = () => {
  const { shoots, isInitialLoading, fetchShoots } = useShoots();
  return <>
    <button onClick={() => void fetchShoots()}>Refresh</button>
    <output data-testid="loading">{String(isInitialLoading)}</output>
    <output data-testid="ids">{shoots.map(shoot => shoot.id).join(',')}</output>
    <output data-testid="today">{shoots.filter(shoot => shoot.scheduledDate?.startsWith('2026-09-28')).length}</output>
  </>;
};
const showProbe = () => render(<MemoryRouter initialEntries={['/dashboard']}><ShootsProvider><Probe /></ShootsProvider></MemoryRouter>);
const record = (id: number) => ({ id, status: 'scheduled', address: `Property ${id}`, scheduled_date: id <= 9 ? '2026-09-28' : '2026-10-02', time: '10:00' });

beforeEach(() => { localStorage.clear(); localStorage.setItem('authToken', 'test-token'); auth.logout.mockClear(); effects.toast.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('complete scheduled shoot hydration', () => {
  it('retains the complete earlier queue on refresh failure and removes finalized work after recovery', async () => {
    auth.user.role = 'admin';
    let phase = 'initial';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://example.test');
      if (url.searchParams.get('tab') === 'scheduled') return response({ data: [record(1)] });
      if (phase === 'failure' && url.searchParams.get('page') === '2') return response({}, 500);
      return response({
        data: [{ ...record(phase === 'initial' ? 101 : 102), status: 'editing' }],
        meta: { last_page: phase === 'failure' ? 2 : 1 },
      });
    }));
    showProbe();
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('1,101'));
    phase = 'failure';
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(effects.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Earlier work could not refresh', description: expect.stringContaining('last loaded'),
    })));
    expect(screen.getByTestId('ids').textContent).toBe('1,101');
    expect(JSON.parse(localStorage.getItem('shoots') ?? '[]').map((shoot: { id: string }) => shoot.id)).toEqual(['1', '101']);
    phase = 'recovery';
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('1,102'));
    vi.restoreAllMocks();
  });

  it('keeps earlier cards mounted through refresh and replaces finalized work once the complete lane arrives', async () => {
    auth.user.role = 'admin';
    let refreshing = false;
    let completePage: (value: Response) => void = () => undefined;
    const laterPage = new Promise<Response>(resolve => { completePage = resolve; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://example.test');
      if (url.searchParams.get('tab') === 'scheduled') return response({ data: [record(1)] });
      if (url.searchParams.get('page') === '2') return laterPage;
      return response({
        data: [{ ...record(refreshing ? 102 : 101), status: 'editing' }],
        meta: { last_page: refreshing ? 2 : 1 },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    showProbe();
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('1,101'));
    refreshing = true;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('page=2'))).toBe(true));
    expect(screen.getByTestId('ids').textContent).toBe('1,101');
    await act(async () => { completePage(response({ data: [{ ...record(103), status: 'ready' }] })); });
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('1,102,103'));
  });

  it.each(['admin', 'superadmin', 'photographer', 'editor', 'editing_manager', 'salesRep'])(
    'hydrates older open work across completed pages for %s without draining delivered history', async (role) => {
      auth.user.role = role;
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://example.test');
        const tab = url.searchParams.get('tab');
        const page = Number(url.searchParams.get('page'));
        if (tab === 'scheduled') return response({ data: [record(1)], meta: { last_page: 1 } });
        if (tab === 'completed') return response({
          data: [{ ...record(page + 100), status: page === 1 ? 'uploaded' : 'editing', scheduled_date: '2026-08-01' }],
          meta: { last_page: 2, count: 2 },
        });
        return response({ data: [{ ...record(200), status: 'delivered' }], meta: { last_page: 30, count: 750 } });
      });
      vi.stubGlobal('fetch', fetchMock);
      showProbe();
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
      expect(screen.getByTestId('ids').textContent?.split(',')).toEqual(expect.arrayContaining(['1', '101', '102']));
      const urls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(urls.filter(url => url.includes('tab=completed'))).toHaveLength(2);
      expect(urls.filter(url => url.includes('tab=completed')).every(url => url.includes('dashboard_open=true'))).toBe(true);
      expect(urls.some(url => url.includes('tab=delivered&page=2'))).toBe(false);
    },
  );

  it('keeps client completed hydration unchanged', async () => {
    auth.user.role = 'client';
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const tab = new URL(String(input), 'https://example.test').searchParams.get('tab');
      return response({ data: [record(1)], meta: { last_page: tab === 'completed' ? 3 : 1 } });
    });
    vi.stubGlobal('fetch', fetchMock);
    showProbe();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(fetchMock.mock.calls).toHaveLength(3);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('dashboard_open'))).toBe(true);
  });

  it('keeps the schedule without publishing a partial completed lane when a later page fails', async () => {
    auth.user.role = 'admin';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://example.test');
      if (url.searchParams.get('tab') === 'scheduled') return response({ data: [record(1)] });
      if (url.searchParams.get('page') === '2') return response({}, 500);
      return response({ data: [{ ...record(101), status: 'uploaded' }], meta: { last_page: 2 } });
    }));
    showProbe();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('ids').textContent).toBe('1');
    vi.restoreAllMocks();
  });

  it.each(['admin', 'superadmin', 'photographer', 'editor', 'editing_manager', 'salesRep', 'client'])(
    'loads all nine appointments across API pages for %s', async (role) => {
      auth.user.role = role;
      const first = [1, 2, 3, 4, 5, ...Array.from({ length: 20 }, (_, i) => i + 10)];
      const second = [6, 7, 8, 9, 30, 31, 32, 33, 34];
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://example.test');
        const page = Number(url.searchParams.get('page'));
        return response(url.searchParams.get('tab') === 'scheduled'
          ? { data: (page === 1 ? first : second).map(record), meta: { current_page: page, last_page: 2, per_page: 25, count: 34 } }
          : { data: [], meta: { current_page: 1, last_page: 1, count: 0 } });
      });
      vi.stubGlobal('fetch', fetchMock);
      showProbe();
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
      expect(screen.getByTestId('today').textContent).toBe('9');
      expect(new Set(screen.getByTestId('ids').textContent?.split(',')).size).toBe(34);
      expect(fetchMock.mock.calls.map(([url]) => String(url)).filter(url => url.includes('tab=scheduled'))).toHaveLength(2);
    },
  );

  it.each(['photographer', 'salesRep', 'editor', 'editing_manager'] as const)(
    'keeps scheduled shoots for %s when the delivered tab fails',
    async (role) => {
      auth.user.role = role;
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://example.test');
        if (url.searchParams.get('tab') === 'delivered') return response({}, 500);
        if (url.searchParams.get('tab') === 'scheduled') {
          return response({ data: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(record), meta: { last_page: 1, count: 9 } });
        }
        return response({ data: [], meta: { last_page: 1, count: 0 } });
      }));
      showProbe();
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
      expect(screen.getByTestId('today').textContent).toBe('9');
      vi.restoreAllMocks();
    },
  );

  it('does not publish a partial schedule when a later page fails', async () => {
    auth.user.role = 'admin';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://example.test');
      if (url.searchParams.get('tab') !== 'scheduled') return response({ data: [] });
      if (url.searchParams.get('page') === '2') return response({}, 500);
      return response({ data: [record(1)], meta: { last_page: 2, count: 2 } });
    }));
    showProbe();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('ids').textContent).toBe('');
    vi.restoreAllMocks();
  });
});
