import React, { useEffect, useState } from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStepTransition } from './BookingStepTransition';

const preference = vi.hoisted(() => ({ reduced: false }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => preference.reduced }));
const cancel = vi.fn();
const animate = vi.fn(() => ({ cancel }));
beforeEach(() => {
  preference.reduced = false;
  vi.clearAllMocks();
  vi.stubGlobal('scrollTo', vi.fn());
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('booking step navigation', () => {
  it('resets a previously scrolled dashboard container on initial entry without an initial slide or focus jump', () => {
    const main = document.createElement('main');
    document.body.append(main);
    main.scrollTop = 700;
    render(<BookingStepTransition step={1} title="Property details"><input aria-label="Street" /></BookingStepTransition>, { container: main });
    expect(main.scrollTop).toBe(0);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(animate).not.toHaveBeenCalled();
    expect(screen.getByRole('region')).not.toHaveFocus();
  });

  it('slides forward from the right and Back from the left without remounting the form or duplicating submissions', () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();
    const submit = vi.fn();
    function DraftForm() {
      const [value, setValue] = useState('');
      useEffect(() => { mounted(); return unmounted; }, []);
      return <form onSubmit={event => { event.preventDefault(); submit(value); }}><input aria-label="Draft notes" value={value} onChange={event => setValue(event.target.value)} /><button type="submit">Continue</button></form>;
    }
    const view = (step: number) => <BookingStepTransition step={step} title={`Booking step ${step}`}><DraftForm /></BookingStepTransition>;
    const { rerender, unmount } = render(view(1));
    const field = screen.getByLabelText('Draft notes');
    fireEvent.change(field, { target: { value: 'Keep this draft' } });
    field.focus();
    expect(animate).not.toHaveBeenCalled();

    rerender(view(2));
    expect(animate).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ transform: 'translateX(48px)' })]), expect.objectContaining({ duration: 240 }));
    expect(screen.getByRole('region', { name: 'Booking step 2' })).toHaveFocus();
    expect(screen.getByLabelText('Draft notes')).toBe(field);
    expect(field).toHaveValue('Keep this draft');
    expect(screen.getAllByRole('button', { name: 'Continue' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(submit).toHaveBeenCalledExactlyOnceWith('Keep this draft');

    rerender(view(1));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ transform: 'translateX(-48px)' })]), expect.anything());
    expect(screen.getByRole('region', { name: 'Booking step 1' })).toHaveFocus();
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
    unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(unmounted).toHaveBeenCalledTimes(1);
  });

  it('keeps reduced-motion navigation immediate, with focus and scroll reset but no animation', () => {
    preference.reduced = true;
    const view = (step: number) => <BookingStepTransition step={step} title={`Step ${step}`}><input aria-label="Notes" defaultValue="Saved" /></BookingStepTransition>;
    const { rerender } = render(view(1));
    const input = screen.getByLabelText('Notes');
    input.focus();
    rerender(view(2));
    expect(animate).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Step 2' })).toHaveFocus();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(screen.getByLabelText('Notes')).toBe(input);
  });
});
