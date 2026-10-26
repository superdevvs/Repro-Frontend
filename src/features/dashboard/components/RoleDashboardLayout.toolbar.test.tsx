import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Camera, CheckCircle2, ListChecks, MessageCircle } from 'lucide-react';

import { UpcomingShootsCard } from '@/components/dashboard/v2/UpcomingShootsCard';
import type { DashboardShootSummary } from '@/types/dashboard';
import { RoleDashboardLayout } from './RoleDashboardLayout';

vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => true }));
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/components/layout/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@/components/dashboard/DashboardNoticeStack', () => ({ DashboardNoticeStack: () => null }));
vi.mock('@/components/dashboard/UploadStatusWidget', () => ({ UploadStatusWidget: () => null }));
vi.mock('@/features/dashboard/components/ProfileCompletionNotice', () => ({ ProfileCompletionNotice: () => null }));
vi.mock('@/components/dashboard/v2/PendingReviewsCard', () => ({ PendingReviewsCard: () => null }));
vi.mock('@/components/dashboard/v2/RoleMetricTilesCard', () => ({ RoleMetricTilesCard: () => null }));
vi.mock('@/services/weatherService', () => ({ getWeatherForLocation: vi.fn().mockResolvedValue(null) }));
vi.mock('@/state/weatherProviderStore', () => ({ subscribeToWeatherProvider: () => () => {} }));
vi.mock('@/contexts/UserPreferencesContext', () => ({
  useUserPreferences: () => ({
    formatDate: (value: Date | string | null) => value instanceof Date ? value.toISOString().slice(0, 10) : value || 'Date TBD',
    formatTime: (value: string) => value,
    formatTemperature: (value: number) => `${value}°F`,
  }),
}));

const records: DashboardShootSummary[] = [
  {
    id: 5846,
    addressLine: '318 Knickerbocker Road',
    cityStateZip: 'Closter, New Jersey, 07624',
    clientName: 'Private photo client',
    scheduledLocalDate: '2026-10-26',
    scheduleTimezone: 'America/New_York',
    dayLabel: '2026-10-26',
    timeLabel: '9:00 AM',
    workflowStatus: 'scheduled',
    status: 'scheduled',
    paymentStatus: 'unpaid',
    services: [],
    isFlagged: false,
    canViewVideoEditorContext: false,
  },
  {
    id: 5847,
    addressLine: '9008 Flicker Place',
    cityStateZip: 'Columbia, Maryland, 21044',
    clientName: 'Authorized video client',
    scheduledLocalDate: '2026-10-27',
    scheduleTimezone: 'America/New_York',
    dayLabel: '2026-10-27',
    timeLabel: '12:00 PM',
    workflowStatus: 'scheduled',
    status: 'scheduled',
    paymentStatus: 'unpaid',
    services: [],
    isFlagged: false,
    canViewVideoEditorContext: true,
  },
] as DashboardShootSummary[];

function Dashboard({ role }: { role: 'photographer' | 'editor' }) {
  const primaryTab = role === 'photographer' ? 'shoots' : 'queue';
  return (
    <RoleDashboardLayout
      title="Dashboard"
      description="Assigned shoots"
      role={role}
      leftColumnCard={null}
      upcomingShoots={records}
      pendingReviews={[]}
      onSelectShoot={vi.fn()}
      mobileTabs={[
        {
          id: primaryTab,
          label: role === 'photographer' ? 'Shoots' : 'Queue',
          icon: role === 'photographer' ? Camera : ListChecks,
          content: <UpcomingShootsCard shoots={records} role={role} onSelect={vi.fn()} />,
        },
        { id: 'requests', label: 'Requests', icon: MessageCircle, content: <p>Requests panel</p> },
        { id: 'completed', label: 'Completed', icon: CheckCircle2, content: <p>Completed panel</p> },
      ]}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-26T15:00:00Z'));
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RoleDashboardLayout compact tab toolbar', () => {
  it.each(['photographer', 'editor'] as const)('keeps %s controls connected to the active shoot panel', role => {
    const { container } = render(<Dashboard role={role} />);
    const toolbar = container.querySelector<HTMLElement>('[data-dashboard-mobile-toolbar]')!;
    const toggle = screen.getByRole('button', { name: 'Show compact shoot cards' });
    const filter = screen.getByRole('button', { name: 'Filters' });

    expect(toolbar).toContainElement(toggle);
    expect(toolbar).toContainElement(filter);
    expect(within(toolbar).getAllByRole('button')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Show compact shoot cards' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Filters' })).toHaveLength(1);
    expect(screen.getByRole('tablist').parentElement?.parentElement).toBe(toolbar.parentElement);
    expect(within(screen.getByRole('tabpanel')).queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(localStorage.getItem('dashboard-shoots-compact')).toBe('1');
    expect(within(toolbar).getByRole('button', { name: 'Show full shoot cards' })).toHaveAttribute('aria-pressed', 'true');
    const compactCards = container.querySelectorAll<HTMLElement>('[data-compact-shoot="true"]');
    expect(compactCards).toHaveLength(2);
    expect(compactCards[0]).not.toHaveTextContent('Unpaid');

    if (role === 'photographer') {
      expect(within(compactCards[0]).getByText('OCT')).toBeInTheDocument();
      expect(within(compactCards[0]).getByText('26')).toBeInTheDocument();
      expect(within(compactCards[0]).getByText('MON')).toBeInTheDocument();
      expect(compactCards[0]).toHaveTextContent('Closter, New Jersey, 07624');
      expect(compactCards[0]).toHaveTextContent('Private photo client');
    } else {
      expect(compactCards[0]).not.toHaveTextContent('Private photo client');
      expect(compactCards[0]).toHaveTextContent('Shoot #5846');
      expect(compactCards[1]).toHaveTextContent('Authorized video client');
      expect(within(compactCards[0]).getByRole('button', { name: 'Download raw files for 318 Knickerbocker Road' })).toBeEnabled();
    }

    fireEvent.click(filter);
    expect(filter).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByPlaceholderText('City, street, zip'), { target: { value: 'Knickerbocker' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    const filteredCards = container.querySelectorAll<HTMLElement>('[data-shoot-card="true"]');
    expect(filteredCards).toHaveLength(1);
    expect(filteredCards[0]).toHaveTextContent('318 Knickerbocker Road');
    expect(within(toolbar).getByRole('button', { name: 'Filters (1 active)' })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Requests' }), { key: 'Enter' });
    expect(screen.getByText('Requests panel')).toBeInTheDocument();
    expect(toolbar).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: 'Show full shoot cards' })).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('tab', { name: role === 'photographer' ? 'Shoots' : 'Queue' }), { key: 'Enter' });
    expect(within(toolbar).getByRole('button', { name: 'Show full shoot cards' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(toolbar).getAllByRole('button')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Filters/ })).toHaveLength(1);
  });
});
