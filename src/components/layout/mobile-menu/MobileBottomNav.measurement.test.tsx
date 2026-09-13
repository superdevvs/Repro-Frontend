import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileBottomNav } from './MobileBottomNav';

vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'dark' }) }));
vi.mock('./useMobileMenu', () => ({
  useMobileMenu: () => ({
    filteredItems: [
      { to: '/dashboard', label: 'Dashboard', icon: 'Home', isActive: true },
      { to: '/shoot-history', label: 'Shoots', icon: 'Clipboard' },
      { to: '/availability', label: 'Availability', icon: 'Calendar' },
    ],
  }),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('mobile navigation loading inset', () => {
  it('reports its visible height, remeasures after resize, and disconnects on unmount', () => {
    let navHeight = 64;
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => navHeight);
    let resize: ResizeObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    const reportHeight = vi.fn();
    const { unmount } = render(
      <MemoryRouter><MobileBottomNav toggleMenu={vi.fn()} onBottomNavHeightChange={reportHeight} /></MemoryRouter>,
    );
    const bar = screen.getByRole('navigation').parentElement;
    expect(observe).toHaveBeenCalledWith(bar);
    // The bar overlaps the bottom viewport edge by two pixels.
    expect(reportHeight).toHaveBeenLastCalledWith(62);

    navHeight = 90;
    act(() => { resize?.([], {} as ResizeObserver); });
    expect(reportHeight).toHaveBeenLastCalledWith(88);

    navHeight = 1;
    act(() => { resize?.([], {} as ResizeObserver); });
    expect(reportHeight).toHaveBeenLastCalledWith(0);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
