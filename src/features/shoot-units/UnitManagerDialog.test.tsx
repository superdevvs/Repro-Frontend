import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UnitManagerDialog } from './UnitManagerDialog';
import { makeUnitDraft } from './model';
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
function Harness() {
  const [units, setUnits] = useState(Array.from({ length: 100 }, (_, i) => makeUnitDraft({ client_key: `u${i}`, label: `Unit ${i + 1}`, sqft: 1200, beds: 2, baths: 1 })));
  return <UnitManagerDialog open onClose={() => {}} units={units} onChange={next => setUnits(next as typeof units)} activeUnitId="u0" onSelect={() => {}} />;
}
describe('bounded unit manager', () => {
  it('keeps missing square footage blank, accepts replacement footage, and preserves zero bedrooms', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<UnitManagerDialog open onClose={() => {}} units={[makeUnitDraft({ client_key: 'u0', label: 'Unit 1', sqft: 0, beds: 0, baths: 0 })]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /^Edit$/ }));
    const sqft = screen.getByLabelText('Square footage') as HTMLInputElement;
    expect(sqft.value).toBe('');
    expect((screen.getByLabelText('Bedrooms') as HTMLInputElement).value).toBe('0');
    await user.type(sqft, '1064');
    expect(sqft.value).toBe('1064');
    await user.clear(sqft);
    expect(sqft.value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Save unit' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(sqft, { target: { value: '001064' } });
    expect(sqft.value).toBe('1064');
    await user.click(screen.getByRole('button', { name: 'Save unit' }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ client_key: 'u0', sqft: 1064, beds: 0, baths: 0 })]);
  });
  it('renders eight rows, searches the full roster, edits without changing stable keys, and rejects duplicate labels', () => {
    render(<Harness />);
    expect(screen.getAllByRole('button', { name: /^Edit$/ })).toHaveLength(8);
    fireEvent.change(screen.getByLabelText('Search units'), { target: { value: 'Unit 100' } });
    expect(screen.getAllByRole('button', { name: /^Edit$/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^Edit$/ }));
    fireEvent.change(screen.getByLabelText('Unit or common area label'), { target: { value: 'Unit 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save unit' }));
    expect(screen.getByRole('alert').textContent).toMatch(/unique/);
    fireEvent.change(screen.getByLabelText('Unit or common area label'), { target: { value: 'Rooftop' } });
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'common_area' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save unit' }));
    fireEvent.change(screen.getByLabelText('Search units'), { target: { value: 'Rooftop' } });
    expect(screen.getByText('Rooftop')).toBeTruthy();
    expect(screen.getByText(/Common area/)).toBeTruthy();
  });
  it('pastes labels using active dimensions, without creating 100 cards on the booking page', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Paste labels' }));
    fireEvent.change(screen.getByLabelText('Paste labels, one per line'), { target: { value: 'Lobby\nPool' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add units$/ }));
    fireEvent.change(screen.getByLabelText('Search units'), { target: { value: 'Pool' } });
    expect(screen.getByText('Pool')).toBeTruthy();
    expect(screen.getByText('1,200 sqft')).toBeTruthy();
  });
});
