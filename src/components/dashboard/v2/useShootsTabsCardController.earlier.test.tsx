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
  it('counts earlier work once and never duplicates it when Previous opens', () => {
    const { result } = renderHook(() => useShootsTabsCardController(props));
    expect(result.current.earlierShoots.map(s => s.id)).toEqual([1, 2]);
    expect(result.current.paginatedGroups.flatMap(g => g.shoots).map(s => s.id)).toEqual([3]);
    expect(result.current.upcomingCount).toBe(3);
    act(() => result.current.setShowPastDays(true));
    expect(result.current.paginatedGroups.flatMap(g => g.shoots).map(s => s.id)).toEqual([4, 3]);
    expect(result.current.upcomingCount).toBe(4);
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
  });
});
