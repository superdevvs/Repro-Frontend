import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardDerivedData } from '@/hooks/useDashboardDerivedData';
import { ShootsProvider } from './ShootsProvider';
import { transformShootFromApi } from './shootNormalization';
import { useShoots } from './shootsContextState';

const auth = vi.hoisted(() => ({
  user: { id: '42', name: 'Office', email: 'office@example.test', role: 'admin', metadata: {} },
  logout: vi.fn(),
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ ...auth, isImpersonating: auth.user.role === 'salesRep' }) }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

const response = (data: unknown[]) => ({
  ok: true, status: 200, text: async () => JSON.stringify({ data, meta: { last_page: 1 } }),
}) as Response;
const record = (id: number, status = 'scheduled') => ({
  id, status, workflow_status: status, address: `Property ${id}`, scheduled_date: '2026-10-23', time: '10:00',
});
const tabData = (input: RequestInfo | URL) => {
  const tab = new URL(String(input), 'https://example.test').searchParams.get('tab');
  return tab === 'scheduled' ? [record(101)] : tab === 'completed' ? [record(202, 'editing')] : [record(303, 'delivered')];
};
const Probe = () => {
  const { shoots, isInitialLoading } = useShoots();
  const derived = useDashboardDerivedData({ shoots, role: auth.user.role, user: auth.user });
  return <>
    <output data-testid="ids">{shoots.map(shoot => shoot.id).join(',')}</output>
    <output data-testid="upcoming">{derived.repUpcoming.map(shoot => shoot.id).join(',')}</output>
    <output data-testid="loading">{String(isInitialLoading)}</output>
  </>;
};
const tree = () => <MemoryRouter initialEntries={['/dashboard']}><ShootsProvider><Probe /></ShootsProvider></MemoryRouter>;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('authToken', 'test-token');
  auth.user = { id: '42', name: 'Office', email: 'office@example.test', role: 'admin', metadata: {} };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('shoot data belongs to the current authenticated scope', () => {
  it('hydrates fresh records even when their IDs overlap the persisted cache', async () => {
    auth.user = { id: '1080', name: 'Michael Bereson', email: 'rep@example.test', role: 'salesRep', metadata: {} };
    localStorage.setItem('shoots', JSON.stringify([transformShootFromApi(record(101)), transformShootFromApi(record(202, 'editing'))]));
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => response(tabData(input))));
    render(tree());
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('ids').textContent).toBe('101,202,303');
    expect(screen.getByTestId('upcoming').textContent).toBe('101,202');
  });

  it.each(['1080', '42'])('keeps overlapping shoots when switching from admin to rep %s', async (repId) => {
    const pending: Array<() => void> = [];
    let switched = false;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (!switched) return Promise.resolve(response(tabData(input)));
      return new Promise<Response>(resolve => pending.push(() => resolve(response(tabData(input)))));
    }));
    const view = render(tree());
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('101,202'));
    switched = true;
    auth.user = { id: repId, name: 'Michael Bereson', email: 'rep@example.test', role: 'salesRep', metadata: {} };
    view.rerender(tree());
    await waitFor(() => expect(pending).toHaveLength(3));
    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('ids').textContent).toBe('');
    await act(async () => { pending.splice(0).forEach(resolve => resolve()); });
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('ids').textContent).toBe('101,202,303');
    expect(screen.getByTestId('upcoming').textContent).toBe('101,202');
  });

  it('ignores the old admin request when it resolves after the rep request', async () => {
    const oldRequests: Array<() => void> = [];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (auth.user.role === 'admin') return new Promise<Response>(resolve => oldRequests.push(() => resolve(response([record(999)]))));
      return Promise.resolve(response(tabData(input)));
    }));
    const view = render(tree());
    await waitFor(() => expect(oldRequests).toHaveLength(2));
    auth.user = { id: '1080', name: 'Michael Bereson', email: 'rep@example.test', role: 'salesRep', metadata: {} };
    view.rerender(tree());
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('101,202,303'));
    await act(async () => { oldRequests.splice(0).forEach(resolve => resolve()); });
    expect(screen.getByTestId('ids').textContent).toBe('101,202,303');
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });
});
