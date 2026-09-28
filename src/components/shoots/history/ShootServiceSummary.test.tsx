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
