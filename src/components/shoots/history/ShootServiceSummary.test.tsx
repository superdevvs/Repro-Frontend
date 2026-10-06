import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext';
import { SharedShootCard } from '@/components/shoots/SharedShootCard';
import { ClientShootTile } from '@/features/dashboard/components/ClientShootTile';
import type { ClientShootTileProps } from '@/features/dashboard/types';
import type { ShootData, ShootHistoryRecord } from '@/types/shoots';
import { shootDataToSummary } from '@/utils/dashboardDerivedUtils';
import { ScheduledShootListRow } from './ScheduledShootListRow';
import { CompletedShootListRow } from './CompletedShootListRow';
import { CompletedAlbumCard } from './CompletedAlbumCard';
import { HoldOnShootCard } from './HoldOnShootCard';
import { HistoryRow } from './ShootHistoryHistoryRows';

vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('@/hooks/useWeatherData', () => ({ useWeatherData: () => ({ temperature: null, condition: null }) }));
afterEach(cleanup);

const shoot = {
  id: '108', scheduledDate: '2026-09-28', time: '09:00', status: 'scheduled', workflowStatus: 'scheduled',
  client: { name: 'Demo Client' }, photographer: { name: 'Demo Photographer' },
  location: { address: 'Five Unit Demo', city: 'Rockville', state: 'MD', zip: '20852', fullAddress: 'Five Unit Demo' },
  services: ['HDR Photos'],
  serviceItems: Array.from({ length: 5 }, (_, index) => ({ id: '2', service_id: '2', shoot_service_id: String(151 + index), name: 'HDR Photos', quantity: 1, price: 175 })),
  payment: { baseQuote: 0, taxRate: 0, taxAmount: 0, totalQuote: 0, totalPaid: 0 },
} as ShootData;

const show = (node: React.ReactNode) => render(<UserPreferencesProvider>{node}</UserPreferencesProvider>);

describe('grouped service labels on shoot summaries', () => {
  const reassigned = {
    ...shoot, photographer: { id: '1123', name: 'Alex Frachetti' },
    serviceItems: [
      { id: '43', name: 'Drone', photographer_id: '1134', photographer: { id: '1134', name: 'Darryl Felton' } },
      { id: '52', name: 'Digital Twilight', photographer_id: '2264', photographer: { id: '2264', name: 'R/E Pro Photos Editor' } },
      { id: '72', name: 'HDR', photographer_id: '1134', photographer: { id: '1134', name: 'Darryl Felton' } },
    ],
  } as ShootData;

  it.each([
    ['shared', <SharedShootCard shoot={reassigned} role="admin" />],
    ['scheduled list', <ScheduledShootListRow shoot={reassigned} onSelect={vi.fn()} />],
    ['completed list', <CompletedShootListRow shoot={reassigned} onSelect={vi.fn()} />],
    ['completed album', <CompletedAlbumCard shoot={reassigned} onSelect={vi.fn()} />],
    ['on hold', <HoldOnShootCard shoot={reassigned} onSelect={vi.fn()} />],
  ])(
    'previews current service assignees instead of a stale shoot primary in %s', (_name, node) => {
      show(node);
      expect(screen.getAllByText('Darryl Felton · R/E Pro Photos Editor').length).toBeGreaterThan(0);
      expect(screen.queryByText('Alex Frachetti')).not.toBeInTheDocument();
    },
  );

  it('carries service assignment display into the history preview without changing photographer identity', () => {
    const summary = shootDataToSummary(reassigned);
    expect(summary.photographerDisplayName).toBe('Darryl Felton · R/E Pro Photos Editor');
    expect(summary.photographer).toMatchObject({ id: 1123, name: 'Alex Frachetti' });
  });

  it.each([
    ['shared', <SharedShootCard shoot={shoot} role="admin" />],
    ['scheduled list', <ScheduledShootListRow shoot={shoot} onSelect={vi.fn()} />],
    ['completed list', <CompletedShootListRow shoot={shoot} onSelect={vi.fn()} />],
    ['completed album', <CompletedAlbumCard shoot={shoot} onSelect={vi.fn()} />],
    ['on hold', <HoldOnShootCard shoot={shoot} onSelect={vi.fn()} />],
  ])('renders one counted label in the %s summary', (_name, node) => {
    show(node);
    expect(screen.getAllByText('HDR Photos × 5')).toHaveLength(1);
    expect(screen.queryByText('HDR Photos')).not.toBeInTheDocument();
  });

  it.each(['upcoming', 'completed', 'hold'] as const)('groups the client %s tile before applying its four-chip limit', variant => {
    const props: ClientShootTileProps = {
      record: { data: shoot, summary: shootDataToSummary(shoot) },
      variant, onSelect: vi.fn(), onReschedule: vi.fn(), onCancel: vi.fn(), onContactSupport: vi.fn(),
      onDownload: vi.fn(), onRebook: vi.fn(), onRequestRevision: vi.fn(), onHoldAction: vi.fn(),
    };
    show(<ClientShootTile {...props} />);
    expect(screen.getAllByText('HDR Photos × 5')).toHaveLength(1);
    expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();
  });

  it('counts historical record labels before applying its three-chip limit', () => {
    show(<HistoryRow record={{ id: 108, services: Array(5).fill('HDR Photos'), scheduledDate: '2026-09-28' } as ShootHistoryRecord} />);
    expect(screen.getAllByText('HDR Photos × 5')).toHaveLength(1);
    expect(screen.queryByText('+2')).not.toBeInTheDocument();
  });
});
