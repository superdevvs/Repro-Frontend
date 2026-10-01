import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import { EarlierShootsStack } from './EarlierShootsStack';

const shoot = (id: number, overrides: Partial<DashboardShootSummary> = {}): DashboardShootSummary => ({
  id, addressLine: `${id} Cedar Grove Lane`, scheduledLocalDate: '2026-09-30',
  dayLabel: 'Yesterday', timeLabel: '10:00 AM', startTime: '2026-09-30T14:00:00Z',
  scheduleTimezone: 'America/New_York', cityStateZip: 'Columbia, MD', status: 'editing',
  workflowStatus: 'editing', clientName: 'Private client', isFlagged: false,
  services: [{ label: 'Listing video', type: 'video' }], photographer: { id: 4, name: 'Jaz Singh' },
  ...overrides,
});

let reducedMotion = false;
let hidden = false;
let intersection: (entries: { isIntersecting: boolean }[]) => void;
let disconnect = vi.fn<() => void>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T16:00:00Z'));
  reducedMotion = false;
  hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query.includes('reduced-motion') ? reducedMotion : query.includes('hover'),
    media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  disconnect = vi.fn<() => void>();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof intersection) { intersection = callback; }
    observe() { intersection([{ isIntersecting: true }]); }
    disconnect() { disconnect(); }
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const advance = (ms = 5000) => act(() => { vi.advanceTimersByTime(ms); });
const activeAddress = () => screen.getByRole('heading', { level: 4 }).textContent;
const pointer = (element: Element, type: string, x: number, y: number) => {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType: 'touch', pointerId: 1, clientX: x, clientY: y });
  fireEvent(element, event);
};

describe('EarlierShootsStack', () => {
  it('rotates every five seconds without replacing the controls or card container', () => {
    render(<EarlierShootsStack shoots={[shoot(1), shoot(2)]} role="admin" onSelect={vi.fn()} />);
    const next = screen.getByRole('button', { name: 'Next unfinished shoot' });
    const card = screen.getByRole('article');
    advance(4999);
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
    advance(1);
    expect(activeAddress()).toBe('2 Cedar Grove Lane');
    expect(screen.getByRole('button', { name: 'Next unfinished shoot' })).toBe(next);
    expect(screen.getByRole('article')).toBe(card);
    advance();
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
  });

  it('resets the single rotation timer after manual navigation and honors explicit pause', () => {
    render(<EarlierShootsStack shoots={[shoot(1), shoot(2), shoot(3)]} role="admin" onSelect={vi.fn()} />);
    advance(3000);
    fireEvent.click(screen.getByRole('button', { name: 'Next unfinished shoot' }));
    advance(2000);
    expect(activeAddress()).toBe('2 Cedar Grove Lane');
    fireEvent.click(screen.getByRole('button', { name: 'Pause automatic switching' }));
    advance(20000);
    expect(activeAddress()).toBe('2 Cedar Grove Lane');
    fireEvent.click(screen.getByRole('button', { name: 'Start automatic switching' }));
    advance();
    expect(activeAddress()).toBe('3 Cedar Grove Lane');
  });

  it('keeps the selected shoot across reordering and safely advances when it disappears', () => {
    const onSelect = vi.fn();
    const { rerender, unmount } = render(<EarlierShootsStack shoots={[shoot(1), shoot(2), shoot(3)]} role="admin" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 Cedar Grove Lane' }));
    rerender(<EarlierShootsStack shoots={[shoot(3), shoot(2), shoot(1)]} role="admin" onSelect={onSelect} />);
    expect(activeAddress()).toBe('2 Cedar Grove Lane');
    rerender(<EarlierShootsStack shoots={[shoot(3), shoot(1)]} role="admin" onSelect={onSelect} />);
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
    fireEvent.click(screen.getByRole('button', { name: 'Open 1 Cedar Grove Lane' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    rerender(<EarlierShootsStack shoots={[]} role="admin" onSelect={onSelect} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses for hover, keyboard focus, hidden document, and an offscreen stack', () => {
    render(<EarlierShootsStack shoots={[shoot(1), shoot(2)]} role="admin" onSelect={vi.fn()} />);
    const region = screen.getByRole('region');
    fireEvent.pointerEnter(region);
    advance();
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
    fireEvent.pointerLeave(region);
    fireEvent.focus(region);
    advance();
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
    fireEvent.blur(region, { relatedTarget: document.body });
    act(() => { hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
    advance();
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
    act(() => { hidden = false; document.dispatchEvent(new Event('visibilitychange')); intersection([{ isIntersecting: false }]); });
    advance();
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
    act(() => intersection([{ isIntersecting: true }]));
    advance();
    expect(activeAddress()).toBe('2 Cedar Grove Lane');
  });

  it('pauses while an existing shoot modal is open and resumes after it closes', async () => {
    render(<EarlierShootsStack shoots={[shoot(1), shoot(2)]} role="admin" onSelect={vi.fn()} />);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'open');
    await act(async () => { document.body.append(dialog); });
    advance(15000);
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
    await act(async () => { dialog.remove(); });
    advance();
    expect(activeAddress()).toBe('2 Cedar Grove Lane');
  });

  it('pauses during touch, swipes horizontally, and preserves vertical scrolling', () => {
    render(<EarlierShootsStack shoots={[shoot(1), shoot(2), shoot(3)]} role="admin" onSelect={vi.fn()} />);
    const card = screen.getByRole('article');
    pointer(card, 'pointerdown', 200, 50);
    advance(10000);
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
    pointer(card, 'pointerup', 100, 55);
    expect(activeAddress()).toBe('2 Cedar Grove Lane');
    pointer(card, 'pointerdown', 200, 50);
    pointer(card, 'pointerup', 190, 180);
    expect(activeAddress()).toBe('2 Cedar Grove Lane');
    advance();
    expect(activeAddress()).toBe('3 Cedar Grove Lane');
  });

  it('supports arrow and space keys, including wrapping around the stack', () => {
    render(<EarlierShootsStack shoots={[shoot(1), shoot(2)]} role="admin" onSelect={vi.fn()} />);
    const region = screen.getByRole('region');
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(activeAddress()).toBe('2 Cedar Grove Lane');
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
    fireEvent.keyDown(region, { key: ' ' });
    expect(screen.getByRole('button', { name: 'Start automatic switching' })).toBeInTheDocument();
    advance();
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
  });

  it('defaults reduced-motion users to paused and disables controls for one record', () => {
    reducedMotion = true;
    const { rerender } = render(<EarlierShootsStack shoots={[shoot(1), shoot(2)]} role="admin" onSelect={vi.fn()} />);
    advance(15000);
    expect(activeAddress()).toBe('1 Cedar Grove Lane');
    expect(screen.getByRole('button', { name: 'Start automatic switching' })).toBeInTheDocument();
    rerender(<EarlierShootsStack shoots={[shoot(1)]} role="admin" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next unfinished shoot' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start automatic switching' })).toBeDisabled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('windows the dots while keeping every record reachable by arrows', () => {
    render(<EarlierShootsStack shoots={Array.from({ length: 9 }, (_, index) => shoot(index + 1))} role="admin" onSelect={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /^Show / })).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Previous unfinished shoot' }));
    expect(activeAddress()).toBe('9 Cedar Grove Lane');
    expect(screen.getByRole('button', { name: 'Show 9 Cedar Grove Lane' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: /^Show / })).toHaveLength(5);
  });

  it('opens the existing handler without leaking client/payment details, and never renders for clients', () => {
    const ready = shoot(1, { workflowStatus: 'ready', paymentStatus: 'unpaid' });
    const onSelect = vi.fn();
    const { rerender } = render(<EarlierShootsStack shoots={[ready]} role="editing_manager" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review 1 Cedar Grove Lane' }));
    expect(onSelect).toHaveBeenCalledWith(ready);
    expect(screen.queryByText('Private client')).not.toBeInTheDocument();
    expect(screen.queryByText(/unpaid/i)).not.toBeInTheDocument();
    rerender(<EarlierShootsStack shoots={[ready]} role="editor" onSelect={onSelect} />);
    expect(screen.getByText(/Listing video/)).toBeInTheDocument();
    expect(screen.queryByText('Jaz Singh')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open 1 Cedar Grove Lane' })).toBeInTheDocument();
    rerender(<EarlierShootsStack shoots={[ready]} role="client" onSelect={onSelect} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('uses the booked market day rather than the browser instant for the date label', () => {
    render(<EarlierShootsStack shoots={[shoot(1, { scheduledLocalDate: '2026-09-30', startTime: '2026-10-01T00:30:00Z' })]} role="admin" onSelect={vi.fn()} />);
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('· Sep 30 • 10:00 AM')).toBeInTheDocument();
  });

  it.each(['client', 'unknown', undefined])('does not render for unsupported role %s', (role) => {
    render(<EarlierShootsStack shoots={[shoot(1)]} role={role} onSelect={vi.fn()} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('describes the unfinished editor assignment instead of a delivered whole shoot', () => {
    render(<EarlierShootsStack shoots={[shoot(1, { workflowStatus: 'client_delivered', hasPendingEditorWork: true })]} role="editor" onSelect={vi.fn()} />);
    expect(screen.getByText('Editing in progress')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open 1 Cedar Grove Lane' })).toBeInTheDocument();
  });
});
