import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import { UpcomingShootsCard } from './UpcomingShootsCard';

const viewport = vi.hoisted(() => ({ compact: false }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => viewport.compact }));
vi.mock('@/services/weatherService', () => ({ getWeatherForLocation: vi.fn().mockResolvedValue(null) }));
vi.mock('@/state/weatherProviderStore', () => ({ subscribeToWeatherProvider: () => () => {} }));
vi.mock('@/components/shoots/ShootEmptyState', () => ({ ShootEmptyState: ({ title }: { title: string }) => <div>{title}</div> }));
vi.mock('@/contexts/UserPreferencesContext', () => ({
  useUserPreferences: () => ({
    formatDate: (value: string | Date | null) => value instanceof Date ? value.toISOString().slice(0, 10) : value || 'Date TBD',
    formatTime: (value: string) => value,
    formatTemperature: (value: number) => `${value}°F`,
  }),
}));
// The carousel owns rotation and gestures; this suite checks its filtered input
// and its placement within the existing paginated/sticky scroll container.
vi.mock('./EarlierShootsStack', () => ({
  EarlierShootsStack: ({ shoots, onSelect }: { shoots: DashboardShootSummary[]; onSelect: (shoot: DashboardShootSummary) => void }) => (
    <section aria-label="Earlier unfinished shoots">
      {shoots.map((shoot) => <button key={shoot.id} onClick={() => onSelect(shoot)}>{shoot.addressLine}</button>)}
    </section>
  ),
}));

const shoot = (id: number, day: string, workflowStatus = 'scheduled'): DashboardShootSummary => ({
  id,
  addressLine: `Property ${id}`,
  cityStateZip: 'Columbia, MD 21044',
  clientName: 'Example client',
  scheduledLocalDate: day,
  scheduleTimezone: 'America/New_York',
  dayLabel: day,
  timeLabel: '10:00 AM',
  workflowStatus,
  status: workflowStatus,
  services: [],
  isFlagged: false,
} as DashboardShootSummary);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T15:00:00Z'));
  viewport.compact = false;
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('UpcomingShootsCard earlier unfinished work', () => {
  it('expands the stack into the original previous-day cards and restores it when closed', () => {
    const onSelect = vi.fn();
    const records = [shoot(1, '2026-09-30', 'uploaded'), shoot(2, '2026-09-29', 'delivered'), shoot(3, '2026-10-01')];
    const { container } = render(<UpcomingShootsCard shoots={records} role="photographer" onSelect={onSelect} />);
    const stack = screen.getByRole('region', { name: 'Earlier unfinished shoots' });
    expect(within(stack).getByText('Property 1')).toBeVisible();
    expect(within(stack).queryByText('Property 2')).toBeNull();
    expect(stack.parentElement).toHaveClass('overflow-y-auto');
    expect(container.querySelector('.sticky.top-0')).not.toBeNull();
    fireEvent.click(within(stack).getByText('Property 1'));
    expect(onSelect).toHaveBeenCalledWith(records[0], undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Previous shoots' }));
    expect(screen.queryByRole('region', { name: 'Earlier unfinished shoots' })).toBeNull();
    expect(Array.from(container.querySelectorAll('[data-shoot-card="true"]')).map(card => card.querySelector('h3')?.textContent)).toEqual(['Property 1', 'Property 2', 'Property 3']);
    fireEvent.click(screen.getByRole('button', { name: 'Hide previous shoots' }));
    expect(screen.getByRole('region', { name: 'Earlier unfinished shoots' })).toBeVisible();
    expect(container.querySelectorAll('[data-shoot-card="true"]')).toHaveLength(1);
    expect(screen.queryByText('Property 2')).toBeNull();
  });

  it('keeps Previous available when every earlier shoot is unfinished', () => {
    viewport.compact = true;
    const { container } = render(<UpcomingShootsCard shoots={[shoot(1, '2026-09-30', 'uploaded')]} role="photographer" onSelect={vi.fn()} />);
    const previous = screen.getByRole('button', { name: 'Previous shoots' });
    expect(previous).toBeEnabled();
    expect(previous.querySelector('.lucide-history')).not.toBeNull();
    expect(previous).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(previous);
    expect(screen.getByText('Yesterday • 1 shoot')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Earlier unfinished shoots' })).toBeNull();
    expect(container.querySelectorAll('[data-shoot-card="true"]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Hide previous shoots' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not consume the five-card agenda page with earlier stack items', () => {
    const records = [shoot(1, '2026-09-30', 'editing'), ...Array.from({ length: 6 }, (_, i) => shoot(10 + i, '2026-10-01'))];
    const { container } = render(<UpcomingShootsCard shoots={records} role="editor" onSelect={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Earlier unfinished shoots' })).toBeVisible();
    expect(container.querySelectorAll('[data-shoot-card="true"]')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(container.querySelectorAll('[data-shoot-card="true"]')).toHaveLength(6);
  });

  it('honors the same address filter for the stack and day cards', () => {
    render(<UpcomingShootsCard shoots={[shoot(1, '2026-09-30'), shoot(2, '2026-09-30')]} role="admin" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByPlaceholderText('City, street, zip'), { target: { value: 'Property 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    const stack = screen.getByRole('region', { name: 'Earlier unfinished shoots' });
    expect(within(stack).queryByText('Property 1')).toBeNull();
    expect(within(stack).getByText('Property 2')).toBeVisible();
  });

  it('retains a delivered shoot only when the current editor still has unfinished assigned media', () => {
    const pendingVideo = { ...shoot(1, '2026-09-30', 'delivered'), hasPendingEditorWork: true };
    render(<UpcomingShootsCard shoots={[pendingVideo, shoot(2, '2026-09-30', 'delivered')]} role="editor" onSelect={vi.fn()} />);
    const stack = screen.getByRole('region', { name: 'Earlier unfinished shoots' });
    expect(within(stack).getByText('Property 1')).toBeVisible();
    expect(within(stack).queryByText('Property 2')).toBeNull();
  });

  it('updates when the same shoot IDs finalize or the role changes', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<UpcomingShootsCard shoots={[shoot(1, '2026-09-30', 'ready')]} role="photographer" onSelect={onSelect} />);
    expect(screen.getByRole('region', { name: 'Earlier unfinished shoots' })).toBeVisible();
    rerender(<UpcomingShootsCard shoots={[shoot(1, '2026-09-30', 'delivered')]} role="photographer" onSelect={onSelect} />);
    expect(screen.queryByRole('region', { name: 'Earlier unfinished shoots' })).toBeNull();
    rerender(<UpcomingShootsCard shoots={[shoot(1, '2026-09-30', 'ready')]} role="client" onSelect={onSelect} />);
    expect(screen.queryByRole('region', { name: 'Earlier unfinished shoots' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show compact shoot cards' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Previous shoots' }));
    expect(screen.getAllByText('Property 1').length).toBeGreaterThan(0);
  });

  it.each([false, true])('offers one compact control and persists staff preference (compact viewport %s)', (compact) => {
    viewport.compact = compact;
    const { container } = render(<UpcomingShootsCard shoots={[shoot(1, '2026-09-30', 'delivered'), shoot(2, '2026-10-01')]} role="editor" onSelect={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: 'Show compact shoot cards' });
    expect(screen.getAllByRole('button', { name: 'Show compact shoot cards' })).toHaveLength(1);
    expect(toggle.textContent).toBe(compact ? '' : 'Compact');
    fireEvent.click(toggle);
    expect(localStorage.getItem('dashboard-shoots-compact')).toBe('1');
    expect(container.querySelector('[data-compact-shoot="true"]')).not.toBeNull();
    expect(screen.queryByText('Example client')).toBeNull();
  });

  it('places the icon immediately before Previous on compact photographer dashboards', () => {
    viewport.compact = true;
    render(<UpcomingShootsCard shoots={[shoot(1, '2026-09-30', 'delivered')]} role="photographer" onSelect={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: 'Show compact shoot cards' });
    expect(toggle.nextElementSibling).toBe(screen.getByRole('button', { name: 'Previous shoots' }));
  });

  it('leaves the client layout full-sized even when staff compact preference is saved', () => {
    localStorage.setItem('dashboard-shoots-compact', '1');
    const { container } = render(<UpcomingShootsCard shoots={[shoot(1, '2026-10-01')]} role="client" onSelect={vi.fn()} />);
    expect(container.querySelector('[data-compact-shoot="true"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show full shoot cards' })).toBeNull();
  });
});
