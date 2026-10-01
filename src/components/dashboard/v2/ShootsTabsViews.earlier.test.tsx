import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import type { useShootsTabsCardController } from './useShootsTabsCardController';
import { DefaultShootsTabsView } from './DefaultShootsTabsView';
import { EditingManagerShootsTabsView } from './EditingManagerShootsTabsView';

vi.mock('@/components/shoots/ShootEmptyState', () => ({ ShootEmptyState: ({ title }: { title: string }) => <div>{title}</div> }));
vi.mock('./EarlierShootsStack', () => ({
  EarlierShootsStack: ({ shoots, onSelect }: { shoots: DashboardShootSummary[]; onSelect: (shoot: DashboardShootSummary) => void }) => (
    <section aria-label="Earlier unfinished shoots">{shoots.map((shoot) => <button key={shoot.id} onClick={() => onSelect(shoot)}>{shoot.addressLine}</button>)}</section>
  ),
}));

type Model = ReturnType<typeof useShootsTabsCardController>;
const earlier = { id: 1, addressLine: 'Yesterday property' } as DashboardShootSummary;
const today = { id: 2, addressLine: 'Today property' } as DashboardShootSummary;
const group = { label: 'Today', shoots: [today], isToday: true, isPast: false, dayTime: 0, dayOffset: 0 };

function model(overrides: Partial<Model> = {}): Model {
  return {
    role: 'admin',
    title: 'Shoots',
    activeTab: 'upcoming',
    setActiveTab: vi.fn(),
    setIsCompactMobile: vi.fn(),
    setShowPastDays: vi.fn(),
    setShowPastRequests: vi.fn(),
    setIsMenuOpen: vi.fn(),
    setDraftFilters: vi.fn(),
    setIsFilterOpen: vi.fn(),
    isCompactDashboardViewport: true,
    isCompactMobile: false,
    isMenuOpen: false,
    showPastDays: false,
    hasPastDays: true,
    hasPastRequests: false,
    pastRequests: [],
    requestedCount: 0,
    upcomingCount: 2,
    activeFilterCount: 0,
    filterPanelHostRef: { current: null },
    scrollContainerRef: { current: null },
    loadMoreSentinelRef: { current: null },
    paginatedGroups: [group],
    earlierShoots: [earlier],
    editingManagerEarlierShoots: [earlier],
    editingManagerPaginatedGroups: [group],
    editingManagerTabs: [{ id: 'upcoming', label: 'Upcoming', shoots: [earlier, today] }, { id: 'uploaded', label: 'Uploaded', shoots: [] }, { id: 'ready', label: 'Ready', shoots: [] }],
    getRelativeGroupLabel: () => 'Today • 1 shoot',
    renderShootCard: (shoot: DashboardShootSummary) => <div key={shoot.id}>{shoot.addressLine}</div>,
    onSelect: vi.fn(),
    ...overrides,
  } as Model;
}
afterEach(cleanup);

describe('staff stacked shoot views', () => {
  it.each(['admin', 'superadmin', 'salesRep'])('puts one compact icon before Previous for %s compact chrome', (role) => {
    const state = model({ role });
    const { container } = render(<DefaultShootsTabsView model={state} />);
    const compact = screen.getByRole('button', { name: 'Show compact shoot cards' });
    expect(compact.textContent).toBe('');
    expect(compact.nextElementSibling?.textContent).toMatch(/Previous/);
    const previous = screen.getByRole('button', { name: 'Previous shoots' });
    expect(previous).toBeEnabled();
    expect(previous.querySelector('.lucide-history')).not.toBeNull();
    expect(previous).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(previous);
    expect(state.setShowPastDays).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Toggle menu' })).toBeNull();
    expect(container.querySelector('.h-0')).toBeNull();
    fireEvent.click(compact);
    expect(state.setIsCompactMobile).toHaveBeenCalled();
    const stack = screen.getByRole('region', { name: 'Earlier unfinished shoots' });
    expect(stack.parentElement).toHaveClass('overflow-y-auto');
    expect(stack.parentElement?.querySelector('.sticky.top-0')).not.toBeNull();
    fireEvent.click(screen.getByText('Yesterday property'));
    expect(state.onSelect).toHaveBeenCalledWith(earlier);
  });

  it('still renders an earlier-only list instead of the empty state', () => {
    render(<DefaultShootsTabsView model={model({ paginatedGroups: [] })} />);
    expect(screen.getByText('Yesterday property')).toBeVisible();
    expect(screen.queryByText('No upcoming shoots')).toBeNull();
  });

  it('preserves client menu, floating compact control and no earlier stack', () => {
    const { container } = render(<DefaultShootsTabsView model={model({ role: 'client' })} />);
    expect(screen.getByRole('button', { name: 'Toggle menu' })).toBeInTheDocument();
    expect(container.querySelector('.h-0')).not.toBeNull();
    expect(screen.queryByRole('region', { name: 'Earlier unfinished shoots' })).toBeNull();
    expect(screen.getByText('Today property')).toBeVisible();
  });

  it('keeps desktop compact text in the floating control only', () => {
    const { container } = render(<DefaultShootsTabsView model={model({ isCompactDashboardViewport: false })} />);
    expect(screen.getByRole('button', { name: 'Show compact shoot cards' })).toHaveTextContent('Compact');
    expect(screen.queryByRole('button', { name: 'Toggle menu' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Earlier unfinished shoots' }).nextElementSibling).toBe(container.querySelector('.h-0'));
  });

  it('keeps manager workflow tabs and places compact before Filters without inventing Previous', () => {
    const state = model({ role: 'editing_manager', editingManagerPaginatedGroups: [] });
    const { container } = render(<EditingManagerShootsTabsView model={state} />);
    expect(screen.getByRole('button', { name: /Uploaded/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Ready/ })).toBeVisible();
    const compact = screen.getByRole('button', { name: 'Show compact shoot cards' });
    expect(compact.nextElementSibling).toBe(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.queryByText(/Previous/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Toggle menu' })).toBeNull();
    expect(container.querySelector('.h-0')).toBeNull();
    expect(screen.getByRole('region', { name: 'Earlier unfinished shoots' }).parentElement).toHaveClass('overflow-y-auto');
    expect(screen.queryByText('No shoots found.')).toBeNull();
  });
});
