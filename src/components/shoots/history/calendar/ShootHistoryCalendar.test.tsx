import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext';
import { ShootHistoryCalendar, type ShootHistoryCalendarProps } from './ShootHistoryCalendar';
import type { CalendarViewMode } from './calendarModel';
import { calendarShoot } from './calendarFixtures.test-helper';

const mocks = vi.hoisted(() => ({ theme: 'dark', mobile: false }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: mocks.theme }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mocks.mobile }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: (query: string) => query.includes('min-width: 1280') && !mocks.mobile }));

function Calendar({ initialView = 'week', ...props }: Partial<ShootHistoryCalendarProps> & { initialView?: CalendarViewMode }) {
  const [date, setDate] = useState('2026-09-28');
  const [view, setView] = useState<CalendarViewMode>(initialView);
  return <UserPreferencesProvider><ShootHistoryCalendar shoots={[calendarShoot()]} date={date} view={view} onDateChange={setDate} onViewChange={setView} onShootSelect={vi.fn()} hideClientDetails={false} canViewPrices {...props} /></UserPreferencesProvider>;
}

beforeEach(() => { vi.clearAllMocks(); mocks.mobile = false; mocks.theme = 'dark'; localStorage.clear(); });
afterEach(cleanup);

describe('real Shoot History calendar', () => {
  it('renders Month/Week/Day and navigates the active date unit', () => {
    render(<Calendar />);
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('29 September 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('October 2026');
  });

  it('uses actual time preferences and invokes the existing Overview callback with the original shoot', () => {
    localStorage.setItem('user_preferences', JSON.stringify({ timeFormat: '24h' }));
    const shoot = calendarShoot(); const select = vi.fn();
    render(<Calendar shoots={[shoot]} onShootSelect={select} />);
    const buttons = screen.getAllByRole('button', { name: 'Open 10 Oak Lane, 09:30, Scheduled' });
    fireEvent.click(buttons[0]);
    expect(select).toHaveBeenCalledWith(shoot);
    fireEvent.click(screen.getByRole('button', { name: 'Open shoot overview' }));
    expect(select).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('preserves privileged details but strips client and price information for restricted viewers', () => {
    const { rerender } = render(<Calendar />);
    expect(screen.getByText('Private client')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    rerender(<Calendar hideClientDetails canViewPrices={false} />);
    expect(screen.queryByText('Private client')).not.toBeInTheDocument();
    expect(screen.queryByText(/private@example/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.getByText('iGuide')).toBeInTheDocument();
    const root = screen.getByTestId('shoot-history-calendar');
    expect(root.innerHTML).not.toContain('Private client');
    expect(root.innerHTML).not.toContain('$725');
  });

  it('moves the selected day and brief to a clicked shoot before invoking Overview', () => {
    const tuesday = calendarShoot({ id: '2', scheduledDate: '2026-09-29', location: { ...calendarShoot().location, address: '20 Pine Road' } });
    const select = vi.fn();
    render(<Calendar shoots={[calendarShoot(), tuesday]} onShootSelect={select} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open 20 Pine Road, 9:30 AM, Scheduled' }));
    expect(screen.getByRole('button', { name: /29 September 2026, 1 shoot/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('region', { name: 'Selected shoot' })).getByRole('heading', { name: '20 Pine Road' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /29 September 2026 agenda/ })).toBeInTheDocument();
    expect(select).toHaveBeenCalledExactlyOnceWith(tuesday);
  });

  it('opens near the selected day work without stealing focus or resetting a manual scroll on rerender', () => {
    const earlyTuesday = calendarShoot({ id: '2', scheduledDate: '2026-09-29', time: '00:15' });
    const shoots = [calendarShoot(), earlyTuesday];
    const { rerender } = render(<Calendar shoots={shoots} />);
    const rail = screen.getByTestId('calendar-timeline-scroll');
    expect(rail.scrollTop).toBe(9 * 88); // half-hour context before Monday 09:30, rail starts at midnight
    const theme = screen.getByRole('button', { name: 'Today' });
    theme.focus();
    rail.scrollTop = 180;
    rerender(<Calendar shoots={[...shoots]} />);
    expect(rail.scrollTop).toBe(180);
    expect(theme).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: /29 September 2026, 1 shoot/ }));
    expect(rail.scrollTop).toBe(0);
    expect(screen.getAllByRole('button', { name: 'Open 10 Oak Lane, 12:15 AM, Scheduled' }).length).toBeGreaterThan(0);
  });

  it('keeps all dense same-day records available through the full agenda', () => {
    const shoots = Array.from({ length: 15 }, (_, index) => calendarShoot({ id: String(index + 1), time: '09:00' }));
    render(<Calendar shoots={shoots} />);
    fireEvent.click(screen.getByRole('button', { name: /15 overlapping shoots/ }));
    const agenda = screen.getByRole('region', { name: /28 September 2026 agenda/ });
    expect(within(agenda).getAllByRole('button')).toHaveLength(15);
    expect(agenda).toHaveFocus();
  });

  it('shows undated and untimed records explicitly and keeps them clickable', () => {
    const shoots = [calendarShoot({ id: '1', time: '' }), calendarShoot({ id: '2', scheduledDate: '', time: '' })];
    const select = vi.fn();
    render(<Calendar shoots={shoots} onShootSelect={select} />);
    const noDate = screen.getByRole('region', { name: 'Date not set' });
    expect(document.querySelector('.shc-untimed')).toBeNull();
    fireEvent.click(within(noDate).getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Time not set, 1 shoot' }));
    const noTime = screen.getByRole('dialog', { name: 'Shoots with time not set' });
    fireEvent.click(within(noTime).getByRole('button', { name: /Open 10 Oak Lane/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(select.mock.calls.map(call => call[0].id)).toEqual(['2', '1']);
  });

  it('uses month spillover cells and +more selects the complete agenda on a phone', () => {
    mocks.mobile = true;
    const shoots = Array.from({ length: 5 }, (_, index) => calendarShoot({ id: String(index + 1) }));
    render(<Calendar initialView="month" shoots={shoots} />);
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /31 August 2026, 0 shoots/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 5 shoots for 28 September 2026' }));
    expect(within(screen.getByRole('region', { name: /28 September 2026 agenda/ })).getAllByRole('button')).toHaveLength(5);
  });

  it('does not show stale clickable records while loading or after a range error and retries explicitly', () => {
    const retry = vi.fn();
    const { rerender } = render(<Calendar loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading shoots');
    expect(screen.queryByRole('button', { name: /Open 10 Oak Lane/ })).not.toBeInTheDocument();
    rerender(<Calendar error="Connection interrupted" onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Connection interrupted');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /Open 10 Oak Lane/ })).not.toBeInTheDocument();
  });

  it('inherits the dashboard theme without duplicate theme controls', () => {
    const { rerender } = render(<Calendar shoots={[]} filters={<label>Parent search<input aria-label="Search shoots" /></label>} />);
    expect(screen.getByRole('status')).toHaveTextContent('No shoots match');
    expect(screen.getByRole('textbox', { name: 'Search shoots' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Light' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dark' })).not.toBeInTheDocument();
    expect(screen.getByTestId('shoot-history-calendar')).toHaveAttribute('data-theme', 'dark');
    mocks.theme = 'light';
    rerender(<Calendar shoots={[]} />);
    expect(screen.getByTestId('shoot-history-calendar')).toHaveAttribute('data-theme', 'light');
  });

  it('scopes untimed counts to the visible timeline and keeps Month entries in the grid', () => {
    const shoots = [calendarShoot({ time: '' }), calendarShoot({ id: '2', scheduledDate: '2026-09-29', time: '' })];
    const { rerender } = render(<Calendar shoots={shoots} />);
    expect(screen.getByRole('button', { name: 'Time not set, 2 shoots' })).toBeInTheDocument();
    mocks.mobile = true;
    rerender(<Calendar shoots={shoots} />);
    expect(screen.getByRole('button', { name: 'Time not set, 1 shoot' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.queryByRole('button', { name: /^Time not set,/ })).not.toBeInTheDocument();
    expect(document.querySelector('.shc-month button[data-shoot-id="2"]')).not.toBeNull();
  });
  it('marks the calendar for viewport fill on desktop so week grid and day list can scroll', () => {
    mocks.mobile = false;
    render(<Calendar />);
    expect(screen.getByTestId('shoot-history-calendar')).toHaveClass('is-viewport-fill');
    expect(screen.getByTestId('shoot-history-calendar')).toHaveAttribute('data-fill-viewport', 'true');
  });

  it('keeps the legacy max-height timeline on phones without viewport fill', () => {
    mocks.mobile = true;
    render(<Calendar />);
    expect(screen.getByTestId('shoot-history-calendar')).not.toHaveClass('is-viewport-fill');
    expect(screen.getByTestId('calendar-timeline-scroll')).toBeInTheDocument();
  });

});
