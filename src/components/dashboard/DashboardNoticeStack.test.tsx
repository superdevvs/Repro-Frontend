import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardNoticeStack } from './DashboardNoticeStack';

const motionState = vi.hoisted(() => ({ reduced: false }));

vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => motionState.reduced,
}));

const layerFor = (text: string) => screen.getByText(text).closest('section')?.parentElement as HTMLElement;

describe('DashboardNoticeStack', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    motionState.reduced = false;
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function measuredHeight() {
      const ownHeight = Number(this.dataset.noticeHeight || 0);
      const childHeight = Number((this.firstElementChild as HTMLElement | null)?.dataset.noticeHeight || 0);
      return ownHeight || childHeight;
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('equalizes layer heights and advances the visible notice every five seconds', () => {
    render(
      <DashboardNoticeStack equalizeLayerHeights label="Account notices">
        <section data-notice-height="80">Verify your email</section>
        <section data-notice-height="112">1 new delivery</section>
      </DashboardNoticeStack>,
    );

    const deck = screen.getByRole('group', { name: 'Account notices' });
    const emailLayer = layerFor('Verify your email');
    const deliveryLayer = layerFor('1 new delivery');

    expect(emailLayer).toHaveStyle({ height: '112px' });
    expect(deliveryLayer).toHaveStyle({ height: '112px' });
    expect(emailLayer).not.toHaveAttribute('aria-hidden');
    expect(deliveryLayer).toHaveAttribute('aria-hidden', 'true');
    expect((emailLayer as HTMLElement & { inert: boolean }).inert).toBe(false);
    expect((deliveryLayer as HTMLElement & { inert: boolean }).inert).toBe(true);

    act(() => vi.advanceTimersByTime(5000));

    expect(emailLayer).toHaveAttribute('aria-hidden', 'true');
    expect(deliveryLayer).not.toHaveAttribute('aria-hidden');
    expect((emailLayer as HTMLElement & { inert: boolean }).inert).toBe(true);
    expect((deliveryLayer as HTMLElement & { inert: boolean }).inert).toBe(false);
    expect(deck).toHaveAttribute('aria-roledescription', 'notice deck');
  });

  it('pauses rotation during pointer interaction and resumes after leaving', () => {
    render(
      <DashboardNoticeStack label="Account notices">
        <section data-notice-height="96">Verify your email</section>
        <section data-notice-height="96">1 new delivery</section>
      </DashboardNoticeStack>,
    );

    const deck = screen.getByRole('group', { name: 'Account notices' });
    const emailLayer = layerFor('Verify your email');
    const deliveryLayer = layerFor('1 new delivery');

    fireEvent.pointerEnter(deck);
    act(() => vi.advanceTimersByTime(10_000));
    expect(emailLayer).not.toHaveAttribute('aria-hidden');

    fireEvent.pointerLeave(deck);
    act(() => vi.advanceTimersByTime(5000));
    expect(deliveryLayer).not.toHaveAttribute('aria-hidden');

    fireEvent.focusIn(deck);
    act(() => vi.advanceTimersByTime(10_000));
    expect(deliveryLayer).not.toHaveAttribute('aria-hidden');

    fireEvent.focusOut(deck);
    act(() => vi.advanceTimersByTime(5000));
    expect(emailLayer).not.toHaveAttribute('aria-hidden');
  });

  it('keeps reduced-motion decks static while preserving manual controls', () => {
    motionState.reduced = true;
    render(
      <DashboardNoticeStack label="Account notices">
        <section data-notice-height="96">Verify your email</section>
        <section data-notice-height="96">1 new delivery</section>
      </DashboardNoticeStack>,
    );

    const emailLayer = layerFor('Verify your email');
    const deliveryLayer = layerFor('1 new delivery');
    act(() => vi.advanceTimersByTime(10_000));
    expect(emailLayer).not.toHaveAttribute('aria-hidden');

    fireEvent.click(screen.getByRole('button', { name: 'Show notice 2 of 2' }));
    expect(deliveryLayer).not.toHaveAttribute('aria-hidden');
  });

  it('renders one notice without deck controls and hides an empty notice area', () => {
    const { container, rerender } = render(
      <DashboardNoticeStack label="Account notices">
        <section data-notice-height="96">Delivery only</section>
      </DashboardNoticeStack>,
    );

    expect(screen.getByText('Delivery only')).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Account notices' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show notice/i })).not.toBeInTheDocument();

    rerender(<DashboardNoticeStack label="Account notices">{null}</DashboardNoticeStack>);
    expect(container.firstElementChild).toHaveClass('hidden');
  });
});
