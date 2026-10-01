import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import { useShootsTabsCardController } from './useShootsTabsCardController';

vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => false }));
vi.mock('@/services/weatherService', () => ({ getWeatherForLocation: vi.fn().mockResolvedValue(null) }));
vi.mock('@/state/weatherProviderStore', () => ({ subscribeToWeatherProvider: () => () => {} }));
vi.mock('@/contexts/UserPreferencesContext', () => ({ useUserPreferences: () => ({
  formatDate: (value: string) => value,
  formatTime: (value: string) => value,
  formatTemperature: (value: string) => value,
}) }));

const shoot = (id: number, day: string, workflowStatus = 'scheduled'): DashboardShootSummary => ({
  id, addressLine: `Property ${id}`, scheduledLocalDate: day, dayLabel: day,
  scheduleTimezone: 'America/New_York', timeLabel: '10:00 AM', workflowStatus, status: workflowStatus,
  services: [], isFlagged: false,
} as DashboardShootSummary);
const records = [shoot(1, '2026-09-30', 'ready'), shoot(2, '2026-09-29', 'uploaded'), shoot(3, '2026-10-01'), shoot(4, '2026-09-30', 'delivered')];
const props = { role: 'admin', upcomingShoots: records, requestedShoots: [], onSelect: vi.fn() };

beforeEach(() => { vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-01T15:00:00Z'));localStorage.clear(); });
afterEach(() => { cleanup();vi.useRealTimers(); });

describe('shoot tabs earlier partition integration', () => {
  it('restores the date-grouped earlier list on Previous and counts each shoot once', () => {
    const { result } = renderHook(() => useShootsTabsCardController(props));
    expect(result.current.earlierShoots.map(s => s.id)).toEqual([1, 2]);
    expect(result.current.paginatedGroups.flatMap(g => g.shoots).map(s => s.id)).toEqual([3]);
    expect(result.current.upcomingCount).toBe(3);
    expect(result.current.hasPastDays).toBe(true);
    act(() => result.current.setShowPastDays(true));
    expect(result.current.earlierShoots).toEqual([]);
    expect(result.current.paginatedGroups.flatMap(g => g.shoots).map(s => s.id)).toEqual([1, 4, 2, 3]);
    expect(result.current.upcomingCount).toBe(4);
    act(() => result.current.setShowPastDays(false));
    expect(result.current.earlierShoots.map(s => s.id)).toEqual([1, 2]);
    expect(result.current.paginatedGroups.flatMap(g => g.shoots).map(s => s.id)).toEqual([3]);
    expect(result.current.upcomingCount).toBe(3);
  });

  it('keeps Previous available when every earlier shoot is unfinished and there are no current shoots', () => {
    const { result } = renderHook(() => useShootsTabsCardController({ ...props, upcomingShoots: records.slice(0, 2) }));
    expect(result.current.hasPastDays).toBe(true);
    expect(result.current.paginatedGroups).toEqual([]);
    expect(result.current.earlierShoots.map(s => s.id)).toEqual([1, 2]);
    act(() => result.current.setShowPastDays(true));
    expect(result.current.earlierShoots).toEqual([]);
    expect(result.current.paginatedGroups.flatMap(g => g.shoots).map(s => s.id)).toEqual([1, 2]);
    expect(result.current.upcomingCount).toBe(2);
  });

  it('preserves the original three-most-recent-days limit for expanded Previous', () => {
    const upcomingShoots = [records[0], records[1], shoot(5, '2026-09-28'), shoot(6, '2026-09-27'), records[2]];
    const { result } = renderHook(() => useShootsTabsCardController({ ...props, upcomingShoots }));
    expect(result.current.earlierShoots).toHaveLength(4);
    act(() => result.current.setShowPastDays(true));
    expect(result.current.paginatedGroups.flatMap(g => g.shoots).map(s => s.id)).toEqual([1, 2, 5, 3]);
    expect(result.current.upcomingCount).toBe(4);
  });

  it('reclassifies the date groups at market midnight while Previous is expanded', () => {
    vi.setSystemTime(new Date('2026-10-01T03:59:30Z'));
    const upcomingShoots = [records[0]];
    const { result } = renderHook(() => useShootsTabsCardController({ ...props, upcomingShoots }));
    expect(result.current.hasPastDays).toBe(false);
    expect(result.current.upcomingGroups[0].isToday).toBe(true);
    act(() => result.current.setShowPastDays(true));
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.hasPastDays).toBe(true);
    expect(result.current.upcomingGroups[0].isPast).toBe(true);
    expect(result.current.earlierShoots).toEqual([]);
    act(() => result.current.setShowPastDays(false));
    expect(result.current.paginatedGroups).toEqual([]);
    expect(result.current.earlierShoots.map(s => s.id)).toEqual([1]);
  });

  it('retains the original client Previous behavior without a stack', () => {
    const { result } = renderHook(() => useShootsTabsCardController({ ...props, role: 'client' }));
    expect(result.current.earlierShoots).toEqual([]);
    expect(result.current.upcomingCount).toBe(1);
    act(() => result.current.setShowPastDays(true));
    expect(result.current.paginatedGroups.flatMap(g => g.shoots)).toHaveLength(4);
  });

  it('partitions only the current editing-manager workflow bucket', () => {
    const tabs = [{ id: 'upcoming', label: 'Upcoming', shoots: [records[2]] }, { id: 'uploaded', label: 'Uploaded', shoots: [records[1]] }, { id: 'ready', label: 'Ready', shoots: [records[0]] }];
    const { result } = renderHook(() => useShootsTabsCardController({ ...props, role: 'editing_manager', mode: 'editing_manager', customTabs: tabs }));
    expect(result.current.editingManagerEarlierShoots).toEqual([]);
    expect(result.current.editingManagerPaginatedGroups.flatMap(g => g.shoots).map(s => s.id)).toEqual([3]);
    act(() => result.current.setActiveTab('uploaded'));
    expect(result.current.editingManagerEarlierShoots.map(s => s.id)).toEqual([2]);
    expect(result.current.editingManagerPaginatedGroups).toEqual([]);
    act(() => result.current.setActiveTab('ready'));
    expect(result.current.editingManagerEarlierShoots.map(s => s.id)).toEqual([1]);
  });

  it('applies filters before partitioning and drops a finalized shoot on data refresh', () => {
    const { result, rerender } = renderHook(({ shoots }) => useShootsTabsCardController({ ...props, upcomingShoots: shoots }), { initialProps: { shoots: records } });
    act(() => result.current.setDraftFilters(previous => ({ ...previous, address: 'Property 1' })));
    act(() => result.current.applyFilters());
    expect(result.current.earlierShoots.map(s => s.id)).toEqual([1]);
    expect(result.current.upcomingCount).toBe(1);
    rerender({ shoots: records.map(s => s.id === 1 ? { ...s, workflowStatus: 'delivered', status: 'delivered' } : s) });
    expect(result.current.earlierShoots).toEqual([]);
    expect(result.current.upcomingCount).toBe(0);
    expect(result.current.hasPastDays).toBe(true);
    act(() => result.current.setShowPastDays(true));
    expect(result.current.paginatedGroups.flatMap(g => g.shoots).map(s => s.id)).toEqual([1]);
    expect(result.current.upcomingCount).toBe(1);
  });
});
