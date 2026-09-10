import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShootDeclineModal } from './ShootDeclineModal';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('decline request schedule display', () => {
  it.each([
    { timezone: null, scheduled_at: '2026-09-09T10:00:00.000000Z' },
    { timezone: 'America/New_York', scheduled_at: '2026-09-09T14:00:00Z' },
  ])('shows the requested 10 AM schedule for $timezone', async (schedule) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
      id: 86, address: '7319 Golden Horseshoe Court', ...schedule,
    } }) }));
    render(<ShootDeclineModal isOpen onClose={vi.fn()} shootId={86} />);
    expect(await screen.findByText('Requested: Sep 9, 2026 10:00 AM')).toBeInTheDocument();
  });
});
