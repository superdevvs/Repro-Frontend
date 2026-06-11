// Route-repair integration test (task 10.4, optional).
//
// Task 10.3 resolved the stray `/shoots` navigation problem two ways:
//
//   (1) App.tsx now declares a safe redirect route alongside `/shoots/:id`:
//         <Route path="/shoots" element={<Navigate to="/shoot-history" replace />} />
//       so any stray navigation to the bare `/shoots` path lands on the working
//       Shoot History page instead of an un-routed/blank screen.
//
//   (2) `UpcomingShoots` "View all" now navigates to `/shoot-history` (the
//       working destination), and each row navigates to `/shoots/${id}`.
//
// This test verifies the *resolved* destination renders cleanly and logs no
// console errors. To avoid the full App's heavy provider tree, it renders a
// focused MemoryRouter containing just the relevant routes:
//   - the `/shoots` → Navigate(`/shoot-history`, replace) redirect, and
//   - a stub `/shoot-history` element standing in for the real page.
// It then asserts that navigating to `/shoots` lands on the shoot-history
// destination and that no `console.error` was emitted during render.
//
// It additionally asserts that `UpcomingShoots`' "View all" control invokes
// navigate('/shoot-history') (the working route, never the broken bare
// `/shoots`) using a mocked `useNavigate`.
//
// _Requirements: 11.2, 11.5_

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks for UpcomingShoots' "View all" assertion.
//
// UpcomingShoots pulls in a few app hooks/contexts. We mock the ones that are
// irrelevant to the navigation assertion so the component renders in isolation,
// and we capture navigate() calls via a mocked react-router useNavigate.
// ---------------------------------------------------------------------------
const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('@/context/ShootsContext', () => ({
  // No upcoming shoots needed; the "View all" button renders regardless.
  useShoots: () => ({ shoots: [] }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

import { UpcomingShoots } from '@/components/dashboard/UpcomingShoots';

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
});

// A lightweight stand-in for the real Shoot History page so we don't drag in
// its data/provider dependencies. The route wiring (redirect → destination) is
// what we're verifying here.
function ShootHistoryStub() {
  return <div data-testid="shoot-history-page">Shoot History</div>;
}

function RouteHarness({ initialPath }: { initialPath: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        {/* Mirrors App.tsx: bare /shoots safely redirects to the working page. */}
        <Route path="/shoots" element={<Navigate to="/shoot-history" replace />} />
        <Route path="/shoot-history" element={<ShootHistoryStub />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Feature: booking-scheduling-fixes — /shoots route repair (Req 11.2, 11.5)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('redirects a stray /shoots navigation to the working /shoot-history destination with no console errors', () => {
    render(<RouteHarness initialPath="/shoots" />);

    // The redirect resolved to the working Shoot History destination.
    expect(screen.getByTestId('shoot-history-page')).toBeInTheDocument();

    // The resolved destination rendered without emitting any console errors.
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('renders the shoot-history destination directly with no console errors (control)', () => {
    render(<RouteHarness initialPath="/shoot-history" />);

    expect(screen.getByTestId('shoot-history-page')).toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('UpcomingShoots "View all" navigates to the working /shoot-history route, never the broken bare /shoots', async () => {
    const user = userEvent.setup();
    render(<UpcomingShoots />);

    await user.click(screen.getByRole('button', { name: /view all/i }));

    expect(navigateSpy).toHaveBeenCalledWith('/shoot-history');
    expect(navigateSpy).not.toHaveBeenCalledWith('/shoots');
  });
});
