import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShootRequestManager } from './ShootRequestManager';

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '1' }, isImpersonating: false }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Accept: 'application/json' }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const openForm = (isClient = false) => render(<ShootRequestManager isOpen onClose={vi.fn()} shootId="89" isAdmin={!isClient} isPhotographer={false} isEditor={false} isClient={isClient} onIssueUpdate={vi.fn()} preselectedMediaIds={['1']} />);

describe('request creation media states', () => {
  it('shows an empty state after a completed empty media response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], users: [] }) }));
    openForm(true);
    expect(await screen.findByText('No photos available yet. You can create a general request.')).toBeVisible();
    expect(screen.queryByText('Loading photos...')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/files?type=edited'), expect.anything());
  });
  it('allows staff to select RAW previews without asking the API for edited files only', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes('/files') ? { data: [{ id: 1, filename: 'property.NEF', thumb_url: '/thumb.jpg' }] } : { data: [], users: [] } }));
    vi.stubGlobal('fetch', fetcher);
    openForm();
    expect(await screen.findByAltText('property.NEF')).toBeVisible();
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/\/shoots\/89\/files$/), expect.anything());
  });
  it('shows media and assignment failures instead of perpetual loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    openForm();
    expect(await screen.findByText('Unable to load photos. You can still create a general request.')).toBeVisible();
    await waitFor(() => expect(screen.queryByText('Loading photos...')).not.toBeInTheDocument());
  });
});
