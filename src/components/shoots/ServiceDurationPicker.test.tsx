import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceDurationPicker } from './ServiceDurationPicker';

afterEach(cleanup);
describe('service appointment duration', () => {
  it.each([undefined, null, 30, 85, 180])('keeps a saved %s-minute value or defaults to an hour', value => {
    const onChange = vi.fn();
    render(<ServiceDurationPicker serviceName="Photos" value={value} onChange={onChange} />);
    const picker = screen.getByRole('combobox', { name: 'Shoot duration for Photos' });
    expect(picker).toHaveValue(String(value ?? 60));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(picker, { target: { value: '30' } });
    expect(onChange).toHaveBeenCalledWith(30);
    expect(screen.getAllByRole('option').every(option => Number((option as HTMLOptionElement).value) >= 30 && Number((option as HTMLOptionElement).value) <= 240)).toBe(true);
  });
});
