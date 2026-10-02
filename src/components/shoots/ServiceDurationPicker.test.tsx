import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceDurationPicker } from './ServiceDurationPicker';

afterEach(cleanup);
describe('service appointment duration', () => {
  it.each([undefined, null, 5, 15, 30, 85, 270, 300])('keeps saved %s minutes until edited', value => {
    const onChange = vi.fn();
    render(<ServiceDurationPicker serviceName="Photos" value={value} onChange={onChange} />);
    const picker = screen.getByRole('slider', { name: 'Shoot duration for Photos' });
    expect(picker).toHaveValue(String(value ?? 60));
    expect(picker).toHaveAttribute('step', '5');
    expect(screen.getByText(`${value ?? 60} min`)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(picker, { target: { value: value === 15 ? '20' : '15' } });
    expect(onChange).toHaveBeenCalledWith(value === 15 ? 20 : 15);
  });
  it('accepts whole-minute custom83 and rejects blank, fractional or out-of-range edits', () => {
    const changed = vi.fn();
    function Example() {
      const [value, setValue] = useState(15);
      return <ServiceDurationPicker serviceName="Photos" value={value} onChange={next => { changed(next); setValue(next); }} />;
    }
    render(<Example />);
    fireEvent.click(screen.getByRole('button', { name: 'Set custom duration for Photos' }));
    const input = screen.getByRole('spinbutton', { name: 'Custom duration for Photos' });
    for (const value of ['', '4', '301', '15.5']) fireEvent.change(input, { target: { value } });
    expect(changed).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(input, { target: { value: '83' } });
    expect(changed).toHaveBeenLastCalledWith(83);
    expect(screen.getByText('83 min')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '85' } });
    expect(changed).toHaveBeenLastCalledWith(85);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
  it('loads and refreshes custom snapshots without emitting edits', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ServiceDurationPicker serviceName="Photos" value={15} onChange={onChange} />);
    rerender(<ServiceDurationPicker serviceName="Photos" value={83} onChange={onChange} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(83);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
    rerender(<ServiceDurationPicker serviceName="Photos" value={45} onChange={onChange} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(45);
    expect(onChange).not.toHaveBeenCalled();
  });
  it('respects server limits and disables both controls during save', () => {
    render(<ServiceDurationPicker serviceName="Photos" value={15} onChange={vi.fn()} disabled
      durationSource={{ booking_duration_defaults: { default_minutes: 15, min_minutes: 10, max_minutes: 100 } }} />);
    expect(screen.getByRole('slider')).toHaveAttribute('min', '10');
    expect(screen.getByRole('slider')).toHaveAttribute('max', '100');
    expect(screen.getByRole('slider')).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
