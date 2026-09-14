import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileBottomNav } from './MobileBottomNav';

type MenuState = { filteredItems: Array<{ to: string; label: string; icon: string; isActive?: boolean }>; isLoading: boolean };
const menuState: MenuState = { filteredItems: [], isLoading: true };

vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'dark' }) }));
vi.mock('./useMobileMenu', () => ({ useMobileMenu: () => menuState }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const renderNav = (reportHeight = vi.fn()) => {
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
  render(<MemoryRouter><MobileBottomNav toggleMenu={vi.fn()} onBottomNavHeightChange={reportHeight} /></MemoryRouter>);
  return reportHeight;
};

describe('mobile bottom navigation visibility', () => {
  it('renders nothing while permissions are still loading and reports a zero inset', () => {
    // Before permissions resolve every item is hidden, which used to leave a
    // bar with three empty slots and a lone circular menu button floating at
    // the bottom of every role's loading screen.
    menuState.filteredItems = [];
    menuState.isLoading = true;

    const reportHeight = renderNav();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(reportHeight).toHaveBeenLastCalledWith(0);
  });

  it('renders nothing when the role has no destinations to show', () => {
    menuState.filteredItems = [];
    menuState.isLoading = false;

    renderNav();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the bar with a labelled Menu control once items exist', () => {
    menuState.filteredItems = [
      { to: '/dashboard', label: 'Dashboard', icon: 'Home', isActive: true },
      { to: '/shoot-history', label: 'Shoots', icon: 'Clipboard' },
      { to: '/availability', label: 'Availability', icon: 'Calendar' },
    ];
    menuState.isLoading = false;

    renderNav();

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    const menu = screen.getByRole('button', { name: /open menu/i });
    // The control reads as a menu like every other slot: icon plus caption.
    expect(menu).toHaveTextContent('Menu');
  });
});
