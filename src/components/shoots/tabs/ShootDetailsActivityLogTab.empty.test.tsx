import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShootDetailsActivityLogTab } from './ShootDetailsActivityLogTab';
import type { ShootData } from '@/types/shoots';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('activity empty and failure states', () => {
  it('keeps a failed request distinct from an empty log and supports retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ShootDetailsActivityLogTab shoot={{ id: '42' } as ShootData} isAdmin={false} onShootUpdate={vi.fn()} />);
    expect(screen.getByText('Loading activity log...')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load activity');
    expect(screen.queryByText('No activity logged yet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('heading', { name: 'No activity logged yet' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
