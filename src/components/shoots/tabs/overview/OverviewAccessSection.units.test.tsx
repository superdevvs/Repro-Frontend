import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverviewAccessSection } from './OverviewAccessSection';

afterEach(cleanup);
describe('selected unit access notes', () => {
  it('changes the unit instructions alongside the unchanged building access details', () => {
    const props = { isEditMode: false, propertyDetails: { presenceOption: 'lockbox', lockboxCode: '2468' },
      presenceOption: 'lockbox' as const, setPresenceOption: vi.fn(), lockboxCode: '2468', setLockboxCode: vi.fn(),
      lockboxLocation: '', setLockboxLocation: vi.fn(), accessContactName: '', setAccessContactName: vi.fn(),
      accessContactPhone: '', setAccessContactPhone: vi.fn() };
    const { rerender } = render(<OverviewAccessSection {...props} unitAccessNotes="North stairwell, second door" />);
    expect(screen.getByText('2468')).toBeInTheDocument();
    expect(screen.getByText(/North stairwell, second door/)).toBeInTheDocument();
    rerender(<OverviewAccessSection {...props} unitAccessNotes="Meet the concierge" />);
    expect(screen.queryByText(/North stairwell, second door/)).not.toBeInTheDocument();
    expect(screen.getByText(/Meet the concierge/)).toBeInTheDocument();
    expect(screen.getByText('2468')).toBeInTheDocument();
    rerender(<OverviewAccessSection {...props} />);
    expect(screen.queryByText('Unit access:')).not.toBeInTheDocument();
    expect(screen.getByText('2468')).toBeInTheDocument();
  });
});
