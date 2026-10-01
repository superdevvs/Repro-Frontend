import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
const shoot = { id: '89', payment: {} } as ShootData;

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

  it('keeps photographer fulfilment limited to explicitly assigned requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: requests }) }));
    render(<ShootDetailsIssuesTab shoot={shoot} role="photographer" isAdmin={false} isPhotographer isEditor={false} isClient={false} onShootUpdate={vi.fn()} />);
    expect(await screen.findByText('Retake the exterior photo')).toBeVisible();
    expect(screen.queryByText('Please review my property request')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add request' })).not.toBeInTheDocument();
  });
});
