import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';

const fixture = vi.hoisted(() => ({ shoots: [] as ShootData[] }));
vi.mock('@/context/shootsContextState', () => ({ useShoots: () => fixture }));

import { useClientsData } from './useClientsData';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllEnvs();
});

describe('client scheduled activity dates', () => {
  it('selects the latest booked calendar day without comparing timezone-shifted instants', () => {
    vi.stubEnv('TZ', 'America/New_York');
    localStorage.clear();
    fixture.shoots = ['2026-09-10T00:00:00+14:00', '2026-09-09T23:00:00-10:00']
      .map((scheduledDate) => ({ scheduledDate, client: { name: 'Client', email: 'client@example.com' } } as ShootData));

    const { result } = renderHook(() => useClientsData());

    expect(result.current.clientsData).toHaveLength(1);
    expect(result.current.clientsData[0]).toMatchObject({ shootsCount: 2, lastActivity: '2026-09-10' });
  });
});
