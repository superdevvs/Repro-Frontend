import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverviewAccessDescription, OverviewAccessSection } from './OverviewAccessSection';

afterEach(cleanup);
describe('selected unit access notes', () => {
  it('changes the unit instructions alongside the unchanged building access details', () => {
    const props = { isEditMode: false, propertyDetails: { presenceOption: 'lockbox', lockboxCode: '2468' },
      presenceOption: 'lockbox' as const, setPresenceOption: vi.fn(), lockboxCode: '2468', setLockboxCode: vi.fn(),
      lockboxLocation: '', setLockboxLocation: vi.fn(), accessContactName: '', setAccessContactName: vi.fn(),
      accessContactPhone: '', setAccessContactPhone: vi.fn() };
    const view = (unitAccessNotes?: string) => <>
      <OverviewAccessSection {...props} />
      <OverviewAccessDescription propertyDetails={props.propertyDetails} unitAccessNotes={unitAccessNotes} />
    </>;
    const { rerender } = render(view('North stairwell, second door'));
    expect(screen.getByText('2468')).toBeInTheDocument();
    expect(screen.getByText(/North stairwell, second door/)).toBeInTheDocument();
    rerender(view('Meet the concierge'));
    expect(screen.queryByText(/North stairwell, second door/)).not.toBeInTheDocument();
    expect(screen.getByText(/Meet the concierge/)).toBeInTheDocument();
    expect(screen.getByText('2468')).toBeInTheDocument();
    rerender(view());
    expect(screen.queryByText('Unit access:')).not.toBeInTheDocument();
    expect(screen.getByText('2468')).toBeInTheDocument();
    expect(screen.queryByLabelText('Access instructions')).not.toBeInTheDocument();
  });

  it('hides the lower row for empty or whitespace-only instructions', () => {
    const { container } = render(<OverviewAccessDescription
      propertyDetails={{ presenceOption: 'lockbox', lockboxCode: '2468', lockboxLocation: ' \n ' }}
      unitAccessNotes={' \t '}
    />);
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps shared instructions and selected-unit notes distinct', () => {
    render(<OverviewAccessDescription
      propertyDetails={{ presenceOption: 'lockbox', lockboxLocation: ' Inside the gate ' }}
      unitAccessNotes="Second door upstairs"
    />);
    const instructions = screen.getByLabelText('Access instructions');
    expect(instructions).toHaveTextContent('Access: Inside the gate');
    expect(instructions).toHaveTextContent('Unit access: Second door upstairs');
  });

  it('does not show stale lockbox instructions when the client is present', () => {
    const { rerender } = render(<OverviewAccessDescription
      propertyDetails={{ presenceOption: 'self', lockboxLocation: 'Old gate location' }}
      unitAccessNotes="Use the side entrance"
    />);
    expect(screen.queryByText(/Old gate location/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Access instructions')).toHaveTextContent('Use the side entrance');
    rerender(<OverviewAccessDescription propertyDetails={{ presenceOption: 'self', lockboxLocation: 'Old gate location' }} />);
    expect(screen.queryByLabelText('Access instructions')).not.toBeInTheDocument();
  });
});
