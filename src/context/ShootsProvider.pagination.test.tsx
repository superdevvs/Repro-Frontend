import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootsProvider } from './ShootsProvider';
import { useShoots } from './shootsContextState';
import { DashboardRefreshNotice } from '@/components/dashboard/DashboardRefreshNotice';

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
  const { shoots, isInitialLoading, fetchShoots, refreshIssue, updateShoot, deleteShoot } = useShoots();
  return <>
    <DashboardRefreshNotice />
    <button onClick={() => void fetchShoots()}>Refresh</button>
    <button onClick={() => void fetchShoots(undefined, 1, 25, { includeFiles: true })}>Refresh with files</button>
    <button onClick={() => void updateShoot('101', { workflowStatus: 'ready' }, { skipApi: true })}>Commit submission</button>
    <button onClick={() => deleteShoot('101')}>Delete shoot</button>
    <output data-testid="issue">{refreshIssue}</output>
    <output data-testid="statuses">{shoots.map(shoot => shoot.workflowStatus).join(',')}</output>
    <output data-testid="loading">{String(isInitialLoading)}</output>
    <output data-testid="ids">{shoots.map(shoot => shoot.id).join(',')}</output>
    <output data-testid="today">{shoots.filter(shoot => shoot.scheduledDate?.startsWith('2026-09-28')).length}</output>
  </>;
};
const showProbe = (path = '/dashboard') => render(<MemoryRouter initialEntries={[path]}><ShootsProvider><Probe /></ShootsProvider></MemoryRouter>);
const record = (id: number) => ({ id, status: 'scheduled', address: `Property ${id}`, scheduled_date: id <= 9 ? '2026-09-28' : '2026-10-02', time: '10:00' });

beforeEach(() => { localStorage.clear(); localStorage.setItem('authToken', 'test-token'); auth.logout.mockClear(); effects.toast.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('complete scheduled shoot hydration', () => {
  it('keeps fresh shoots usable when the browser cache is full during initial load and refresh', async () => {
    auth.user.role = 'photographer';
    let id = 101;
    const originalSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'shoots') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      originalSet.call(this, key, value);
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => response({
      data: String(input).includes('tab=scheduled') ? [record(id)] : [],
    }));
    vi.stubGlobal('fetch', fetchMock);
    showProbe();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('ids').textContent).toBe('101');
    originalSet.call(localStorage, 'shoots', JSON.stringify([{ id: 'stale' }]));
    id = 202;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('202'));
    expect(localStorage.getItem('shoots')).toBeNull();
    expect(screen.getByTestId('issue').textContent).toBe('');
    expect(effects.toast).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).toContain('include_files=false');
      expect(String(url)).toContain('view=card');
    }
  });

  it('does not restore a deleted initial row when the remaining lane fails without another page', async () => {
    auth.user.role = 'admin';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let failLane!: (value: Response) => void;
    const pendingLane = new Promise<Response>(resolve => { failLane = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === 'DELETE') return response({});
      const tab = new URL(String(input), 'https://example.test').searchParams.get('tab');
      return tab === 'scheduled' ? response({ data: [record(101)] }) : pendingLane;
    }));
    showProbe();
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('101'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete shoot' }));
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe(''));
    await act(async () => failLane(response({}, 500)));
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('ids').textContent).toBe('');
    expect(JSON.parse(localStorage.getItem('shoots') ?? '[]')).toEqual([]);
    expect(screen.getByTestId('issue').textContent).toContain('completed, page 1');
    consoleError.mockRestore();
  });

  it.each(['admin', 'client'])('shows first scheduled page before slower pages and history finish for %s', async role => {
    auth.user.role = role;
    let finishPage!: (response: Response) => void;
    let finishHistory!: (response: Response) => void;
    const laterPage = new Promise<Response>(resolve => { finishPage = resolve; });
    const history = new Promise<Response>(resolve => { finishHistory = resolve; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://example.test');
      if (url.searchParams.get('tab') !== 'scheduled') return history;
      return url.searchParams.get('page') === '2' ? laterPage
        : response({ data: [record(1)], meta: { last_page: 2, count: 2 } });
    });
    vi.stubGlobal('fetch', fetchMock);
    showProbe();
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('1'));
    expect(screen.getByTestId('loading').textContent).toBe('true');
    await act(async () => finishPage(response({ data: [record(2)] })));
    expect(screen.getByTestId('ids').textContent).toBe('1,2');
    await act(async () => finishHistory(response({ data: [] })));
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    if (role === 'client') {
      const deliveredUrl = fetchMock.mock.calls.map(([url]) => String(url)).find(url => url.includes('tab=delivered'));
      expect(deliveredUrl).toContain('per_page=50');
    }
  });

  it('does not overwrite a committed submission with an older dashboard response', async () => {
    auth.user.role = 'admin';
    let refreshing = false;
    let resolveRefresh!: (value: Response) => void;
    const delayed = new Promise<Response>(resolve => { resolveRefresh = resolve; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const tab = new URL(String(input), 'https://example.test').searchParams.get('tab');
      if (tab === 'scheduled') return response({ data: [] });
      return refreshing ? delayed : response({ data: [{ ...record(101), status: 'editing', workflow_status: 'editing' }] });
    });
    vi.stubGlobal('fetch', fetchMock);
    showProbe();
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('101'));
    refreshing = true;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    fireEvent.click(screen.getByRole('button', { name: 'Commit submission' }));
    await waitFor(() => expect(screen.getByTestId('statuses').textContent).toBe('ready'));
    await act(async () => resolveRefresh(response({ data: [{ ...record(101), status: 'editing', workflow_status: 'editing' }] })));
    expect(screen.getByTestId('statuses').textContent).toBe('ready');
    expect(effects.toast).not.toHaveBeenCalled();
  });

  it('preserves loaded sections when a refresh is aborted without reporting a failure', async () => {
    auth.user.role = 'editing_manager';
    let abort = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (abort) throw new DOMException('Aborted', 'AbortError');
      return response({ data: String(input).includes('tab=scheduled') ? [record(1)] : [] });
    }));
    showProbe();
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('1'));
    abort = true;
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Refresh' })));
    expect(screen.getByTestId('ids').textContent).toBe('1');
    expect(screen.getByTestId('issue').textContent).toBe('');
    expect(effects.toast).not.toHaveBeenCalled();
  });
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
    await waitFor(() => expect(screen.getByTestId('issue').textContent).toContain('completed, page 2'));
    expect(effects.toast).not.toHaveBeenCalled();
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
      expect(urls.every(url => url.includes('include_filters=false'))).toBe(true);
      expect(urls.every(url => new URL(url, 'https://example.test').searchParams.get('view') === 'card')).toBe(true);
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
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('include_filters=false') && String(url).includes('view=card'))).toBe(true);
  });

  it('keeps detailed file refreshes and non-dashboard editing-manager reads on their full payload contract', async () => {
    auth.user.role = 'editing_manager';
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => response({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    showProbe('/accounts');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('view=card'))).toBe(true);
    fetchMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh with files' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('include_files=true') && !String(url).includes('view=card'))).toBe(true);
  });

  it('retries failed editing-manager dashboard sections with compact cards and no unused filter catalog', async () => {
    auth.user.role = 'editing_manager';
    let fail = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => response({ data: [] }, fail && String(input).includes('tab=delivered') ? 500 : 200));
    vi.stubGlobal('fetch', fetchMock);
    showProbe();
    await waitFor(() => expect(screen.getByTestId('issue').textContent).toContain('delivered, page 1'));
    fail = false;
    fetchMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Retry dashboard refresh' }));
    await waitFor(() => expect(screen.getByTestId('issue').textContent).toBe(''));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('view=card') && String(url).includes('include_filters=false') && String(url).includes('include_files=false'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('retains initially loaded completed pages with an explicit incomplete notice when a later page fails', async () => {
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
    expect(screen.getByTestId('ids').textContent).toBe('1,101');
    expect(screen.getByTestId('issue').textContent).toContain('more shoots may remain unloaded');
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

  it('retains initially loaded schedule pages with an incomplete notice when a later page fails', async () => {
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
    expect(screen.getByTestId('ids').textContent).toBe('1');
    expect(screen.getByTestId('issue').textContent).toContain('scheduled, page 2');
    vi.restoreAllMocks();
  });
});
