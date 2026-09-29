import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootsProvider } from './ShootsProvider';
import { useShoots } from './shootsContextState';

const auth = vi.hoisted(() => ({
  user: { id: '42', name: 'Office', role: 'admin' },
  logout: vi.fn(),
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ ...auth, isImpersonating: false }) }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

const response = (payload: unknown, status = 200) => ({
  ok: status === 200, status, text: async () => JSON.stringify(payload),
}) as Response;

const Probe = () => {
  const { shoots, isInitialLoading } = useShoots();
  return <>
    <output data-testid="loading">{String(isInitialLoading)}</output>
    <output data-testid="ids">{shoots.map(shoot => shoot.id).join(',')}</output>
    <output data-testid="today">{shoots.filter(shoot => shoot.scheduledDate?.startsWith('2026-09-28')).length}</output>
  </>;
};
const showProbe = () => render(<MemoryRouter initialEntries={['/dashboard']}><ShootsProvider><Probe /></ShootsProvider></MemoryRouter>);
const record = (id: number) => ({ id, status: 'scheduled', address: `Property ${id}`, scheduled_date: id <= 9 ? '2026-09-28' : '2026-10-02', time: '10:00' });

beforeEach(() => { localStorage.clear(); localStorage.setItem('authToken', 'test-token'); auth.logout.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('complete scheduled shoot hydration', () => {
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
