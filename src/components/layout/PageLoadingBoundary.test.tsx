import React, { StrictMode, useEffect, useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageLoadingBoundary } from './PageLoadingBoundary';
import { usePageLoading } from '@/hooks/use-page-loading';

const imageObserver = vi.hoisted(() => ({ callback: undefined as undefined | ((pending: boolean) => void), disconnect: vi.fn() }));
vi.mock('@/lib/observe-page-images', () => ({
  observePageImages: (_root: HTMLElement, callback: (pending: boolean) => void) => {
    imageObserver.callback = callback;
    return imageObserver.disconnect;
  },
}));

function PageWork({ loading, name = 'Page content' }: { loading: boolean; name?: string }) {
  usePageLoading(loading);
  return <button>{name}</button>;
}

const settle = () => act(() => { vi.advanceTimersByTime(151); });
const overlay = () => screen.queryByRole('status', { name: 'Loading page' });

beforeEach(() => { vi.useFakeTimers(); imageObserver.disconnect.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('PageLoadingBoundary', () => {
  it('keeps the page mounted under a blur and blocks interaction until every initial task finishes', () => {
    const view = (first: boolean, second: boolean) => (
      <PageLoadingBoundary><PageWork loading={first} /><PageWork loading={second} name="Second section" /></PageLoadingBoundary>
    );
    const { rerender, container } = render(view(true, true));
    const content = screen.getByText('Page content');
    expect(content).toBeInTheDocument();
    expect(content.closest('[inert]')).not.toBeNull();
    expect(overlay()).toHaveClass('backdrop-blur-md');
    expect(overlay()?.querySelector('svg')).toHaveClass('h-28', 'sm:h-36');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    settle();
    rerender(view(false, true));
    settle();
    expect(overlay()).toBeInTheDocument();
    rerender(view(false, false));
    settle();
    expect(overlay()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page content' })).toBe(content);
    expect(content.closest('[inert]')).toBeNull();
  });

  it('waits for a request started by a mount effect even when the first render is not loading', () => {
    function MountFetch({ finished }: { finished: boolean }) {
      const [started, setStarted] = useState(false);
      useEffect(() => { setStarted(true); }, []);
      return <PageWork loading={started && !finished} />;
    }
    const { rerender } = render(<PageLoadingBoundary><MountFetch finished={false} /></PageLoadingBoundary>);
    settle();
    expect(overlay()).toBeInTheDocument();
    rerender(<PageLoadingBoundary><MountFetch finished /></PageLoadingBoundary>);
    settle();
    expect(overlay()).not.toBeInTheDocument();
  });

  it('does not block a ready page again for refreshes or user actions', () => {
    const { rerender } = render(<PageLoadingBoundary><PageWork loading={false} /></PageLoadingBoundary>);
    settle();
    rerender(<PageLoadingBoundary><PageWork loading /></PageLoadingBoundary>);
    settle();
    expect(overlay()).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('releases removed blockers so an error or empty state can be displayed', () => {
    const { rerender } = render(<PageLoadingBoundary><PageWork loading /></PageLoadingBoundary>);
    rerender(<PageLoadingBoundary><p>Could not load this page. Try again.</p></PageLoadingBoundary>);
    settle();
    expect(overlay()).not.toBeInTheDocument();
    expect(screen.getByText('Could not load this page. Try again.')).toBeVisible();
  });

  it('starts a new readiness cycle for a different route without inheriting old blockers', () => {
    const { rerender } = render(<PageLoadingBoundary key="a"><PageWork loading /></PageLoadingBoundary>);
    rerender(<PageLoadingBoundary key="b"><PageWork loading /></PageLoadingBoundary>);
    settle();
    expect(overlay()).toBeInTheDocument();
    rerender(<PageLoadingBoundary key="b"><PageWork loading={false} /></PageLoadingBoundary>);
    settle();
    expect(overlay()).not.toBeInTheDocument();
  });

  it('waits for visible images and disconnects observation after the initial page is ready', () => {
    render(<PageLoadingBoundary><PageWork loading={false} /></PageLoadingBoundary>);
    act(() => imageObserver.callback?.(true));
    settle();
    expect(overlay()).toBeInTheDocument();
    act(() => imageObserver.callback?.(false));
    settle();
    expect(overlay()).not.toBeInTheDocument();
    expect(imageObserver.disconnect).toHaveBeenCalledTimes(1);
  });

  it('supports Strict Mode effect cleanup and the reduced-motion static logo', () => {
    const { rerender } = render(<StrictMode><PageLoadingBoundary><PageWork loading /></PageLoadingBoundary></StrictMode>);
    expect(overlay()?.querySelector('image[href="/brand/re/loading-static.svg"]')).toHaveClass('motion-reduce:block');
    rerender(<StrictMode><PageLoadingBoundary><PageWork loading={false} /></PageLoadingBoundary></StrictMode>);
    settle();
    expect(overlay()).not.toBeInTheDocument();
  });

  it('does not uncover a page when an image starts loading just before the quiet timer fires', () => {
    render(<PageLoadingBoundary><PageWork loading={false} /></PageLoadingBoundary>);
    act(() => {
      imageObserver.callback?.(true);
      vi.advanceTimersByTime(151);
    });
    expect(overlay()).toBeInTheDocument();
    act(() => imageObserver.callback?.(false));
    settle();
    expect(overlay()).not.toBeInTheDocument();
  });

  it('allows page components to render safely without a dashboard boundary', () => {
    render(<PageWork loading />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('reschedules settling when image start and finish updates are batched around a due timer', () => {
    render(<PageLoadingBoundary><PageWork loading={false} /></PageLoadingBoundary>);
    act(() => {
      imageObserver.callback?.(true);
      vi.advanceTimersByTime(151);
      imageObserver.callback?.(false);
    });
    expect(overlay()).toBeInTheDocument();
    settle();
    expect(overlay()).not.toBeInTheDocument();
  });
});
