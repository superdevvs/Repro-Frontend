import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShootEmptyState } from './ShootEmptyState';

const permission = vi.hoisted(() => ({ can: vi.fn(), isLoading: false }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => permission }));
afterEach(cleanup);
beforeEach(() => { permission.can.mockReset().mockReturnValue(true); permission.isLoading = false; });

describe('shoot empty-state actions', () => {
  it('offers booking only in an eligible view with booking permission', () => {
    const { rerender } = render(<MemoryRouter><ShootEmptyState allowBooking /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Create New Shoot' })).toHaveAttribute('href', '/book-shoot');
    expect(permission.can).toHaveBeenCalledWith('book-shoot', 'create');
    permission.can.mockReturnValue(false);
    rerender(<MemoryRouter><ShootEmptyState allowBooking /></MemoryRouter>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    permission.can.mockReturnValue(true);
    rerender(<MemoryRouter><ShootEmptyState /></MemoryRouter>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('waits for permissions before exposing booking', () => {
    permission.isLoading = true;
    render(<MemoryRouter><ShootEmptyState allowBooking /></MemoryRouter>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('resets filters instead of suggesting creation for a filtered result', () => {
    const reset = vi.fn();
    render(<MemoryRouter><ShootEmptyState filtered allowBooking onReset={reset} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'No shoots match these filters' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps requested navigation available independently of booking', () => {
    permission.can.mockReturnValue(false);
    const requested = vi.fn();
    render(<MemoryRouter><ShootEmptyState onViewRequested={requested} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'View Requested' }));
    expect(requested).toHaveBeenCalledOnce();
  });
});
