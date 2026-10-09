import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TimeSelect } from './time-select';
import { parseTimeInput } from './time-select-utils';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn(() => ({ matches: false })) });
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('time selection', () => {
  it('parses noon, midnight, and 24-hour input but rejects malformed periods', () => {
    expect(parseTimeInput('12:00 AM')).toBe(0);
    expect(parseTimeInput('12:00 PM')).toBe(720);
    expect(parseTimeInput('14:35')).toBe(875);
    for (const input of ['00:30 PM', '13:00 AM', '24:00', '10:60', 'garbage']) expect(parseTimeInput(input)).toBeNull();
  });
  it('does not emit changes on mount or external updates', () => {
    const change = vi.fn();
    const { rerender } = render(<TimeSelect value="10:30 AM" onChange={change} />);
    rerender(<TimeSelect value="14:30" onChange={change} />);
    expect(change).not.toHaveBeenCalled();
  });
  it('selects only valid combinations, finding an available minute when hour changes', () => {
    const change = vi.fn();
    render(<TimeSelect value="10:30 AM" availableTimes={['10:30 AM', '11:45 AM']} onChange={change} />);
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Select hour' })).getByRole('option', { name: '11' }));
    expect(change).toHaveBeenLastCalledWith('11:45 AM');
    expect(within(screen.getByRole('listbox', { name: 'Select minute' })).getByRole('option', { name: '30' }).hasAttribute('disabled')).toBe(true);
  });
  it('keeps typing secondary and checks manual time availability', () => {
    const change = vi.fn();
    render(<TimeSelect value="10:30 AM" availableTimes={['10:30 AM', '02:35 PM']} onChange={change} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Type time' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '14:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert').textContent).toContain('unavailable');
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '14:35' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(change).toHaveBeenLastCalledWith('02:35 PM');
  });
  it('treats an empty availability list as no available times', () => {
    const change = vi.fn();
    render(<TimeSelect availableTimes={[]} onChange={change} />);
    expect(screen.getByRole('status').textContent).toContain('No available');
    expect(screen.getByRole('button', { name: 'Type time' }).hasAttribute('disabled')).toBe(true);
    expect(change).not.toHaveBeenCalled();
  });
  it('supports keyboard selection and controlled clearing without re-emitting defaults', () => {
    const change = vi.fn();
    function Fixture() { const [value, setValue] = useState('10:30 AM'); return <TimeSelect value={value} onChange={v => { setValue(v); change(v); }} />; }
    render(<Fixture />);
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Select minute' }), { key: 'ArrowDown' });
    expect(change).toHaveBeenLastCalledWith('10:35 AM');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(change).toHaveBeenLastCalledWith('');
    expect(screen.getByText('Select time')).toBeTruthy();
    expect(change).toHaveBeenCalledTimes(2);
  });
  it('settles native scrolling to the nearest available minute', () => {
    vi.useFakeTimers();
    const change = vi.fn();
    render(<TimeSelect value="10:30 AM" availableTimes={['10:30 AM', '10:40 AM']} onChange={change} />);
    const wheel = screen.getByRole('listbox', { name: 'Select minute' });
    fireEvent.wheel(wheel, { deltaY: 40 });
    fireEvent.scroll(wheel, { target: { scrollTop: 40 } });
    act(() => vi.advanceTimersByTime(200));
    expect(change).toHaveBeenLastCalledWith('10:40 AM');
  });
  it('does not silently replace an existing unavailable time while aligning wheels', () => {
    vi.useFakeTimers();
    const change = vi.fn();
    render(<TimeSelect value="10:35 AM" availableTimes={['10:30 AM']} onChange={change} />);
    fireEvent.scroll(screen.getByRole('listbox', { name: 'Select minute' }), { target: { scrollTop: 40 } });
    act(() => vi.advanceTimersByTime(200));
    expect(change).not.toHaveBeenCalled();
  });
  it('honors disabled and 24-hour mode', () => {
    const change = vi.fn();
    render(<TimeSelect value="14:30" hour24 disabled onChange={change} />);
    expect(screen.queryByRole('listbox', { name: 'Select period' })).toBeNull();
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Select minute' }), { key: 'ArrowDown' });
    expect(change).not.toHaveBeenCalled();
  });
});
