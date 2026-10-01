import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { ShootDetailsIssuesTab } from './ShootDetailsIssuesTab';

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '9', role: 'salesRep' }, isImpersonating: false }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useShootFiles', () => ({ useShootFiles: () => ({ data: [] }) }));
vi.mock('./media/MediaViewer', () => ({ MediaViewer: () => null }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Accept: 'application/json' }) }));

const requests = [
  { id: '1', shootId: '89', note: 'Please review my property request', status: 'open', raisedBy: { id: '3', name: 'Client', role: 'client' }, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' },
  { id: '2', shootId: '89', note: 'Retake the exterior photo', status: 'open', assignedToRole: 'photographer', raisedBy: { id: '3', name: 'Client', role: 'client' }, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' },
];
const shoot = { id: '89', payment: {}, assignedRepId: '9' } as ShootData;

beforeAll(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('sales representative client request access', () => {
  it('shows client requests in the shoot tab and its request manager for a rep', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: requests }) }));
    render(<ShootDetailsIssuesTab shoot={shoot} role="salesRep" isAdmin={false} isPhotographer={false} isEditor={false} isClient={false} onShootUpdate={vi.fn()} />);
    expect(await screen.findByText('Please review my property request')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Add request' }));
    expect(await within(screen.getByRole('dialog')).findByText('Please review my property request')).toBeVisible();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /Create Request/i })).toBeVisible();
  });

  it.each([null, '10'])('keeps request creation hidden when shoot rep assignment is %s', async (assignedRepId) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: requests }) }));
    const otherShoot = { ...shoot, assignedRepId, rep: { id: '9', name: 'Account rep' } } as ShootData;
    render(<ShootDetailsIssuesTab shoot={otherShoot} role="salesRep" isAdmin={false} isPhotographer={false} isEditor={false} isClient={false} onShootUpdate={vi.fn()} />);
    expect(await screen.findByText('Please review my property request')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Add request' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manage requests' }));
    expect(await within(screen.getByRole('dialog')).findByText('Please review my property request')).toBeVisible();
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /Create Request/i })).not.toBeInTheDocument();
  });

  it('lets a rep assign an existing request from the shoot tab without loading admin user options', async () => {
    const fetcher = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => ({ data: init?.method === 'POST' ? { ...requests[0], assignedToRole: 'editor' } : requests }),
    }));
    vi.stubGlobal('fetch', fetcher);
    render(<ShootDetailsIssuesTab shoot={{ ...shoot, assignedRepId: null }} role="salesRep" isAdmin={false} isPhotographer={false} isEditor={false} isClient={false} onShootUpdate={vi.fn()} />);
    const assign = await screen.findByRole('button', { name: /^Assign$/ });
    fireEvent.pointerDown(assign, { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Assign to Editor' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/shoots/89/issues/1/assign'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ assignedToRole: 'editor' }) })));
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/admin/users'))).toBe(false);
  });

  it('lets an unassigned rep hand off requests in the manager while keeping creation protected', async () => {
    const fetcher = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => ({ data: init?.method === 'POST' ? { ...requests[0], assignedToRole: 'editor' } : requests }),
    }));
    vi.stubGlobal('fetch', fetcher);
    render(<ShootDetailsIssuesTab shoot={{ ...shoot, assignedRepId: null }} role="salesRep" isAdmin={false} isPhotographer={false} isEditor={false} isClient={false} onShootUpdate={vi.fn()} />);
    await screen.findByText('Please review my property request');
    fireEvent.click(screen.getByRole('button', { name: 'Manage requests' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.pointerDown((await within(dialog).findAllByRole('button', { name: 'Assign request' }))[0], { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Assign to Editor' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/shoots/89/issues/1/assign'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ assignedToRole: 'editor' }) })));
    expect(within(dialog).queryByRole('button', { name: /Create Request/i })).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/admin/users'))).toBe(false);
  });

  it('keeps photographer fulfilment limited to explicitly assigned requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: requests }) }));
    render(<ShootDetailsIssuesTab shoot={shoot} role="photographer" isAdmin={false} isPhotographer isEditor={false} isClient={false} onShootUpdate={vi.fn()} />);
    expect(await screen.findByText('Retake the exterior photo')).toBeVisible();
    expect(screen.queryByText('Please review my property request')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add request' })).not.toBeInTheDocument();
  });
});
