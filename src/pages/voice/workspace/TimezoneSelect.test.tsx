import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimezoneSelect } from './TimezoneSelect';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Calls timezone dropdown', () => {
  it.each(['Asia/Calcutta', 'US/Eastern', 'Etc/GMT+5', 'UTC'])('retains the exact saved identifier %s without an edit', (value) => {
    const onChange = vi.fn();
    render(<TimezoneSelect aria-label="Timezone" value={value} onChange={onChange} />);
    expect(screen.getByRole('combobox')).toHaveValue(value);
    expect(screen.getByRole('option', { name: value })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers the browser catalog and keeps a required empty value invalid until selected', async () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockReturnValue(['Antarctica/Troll', 'America/New_York']);
    function Form() {
      const [value, setValue] = useState('');
      return <TimezoneSelect aria-label="Timezone" required value={value} onChange={event => setValue(event.target.value)} />;
    }
    render(<Form />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('');
    expect(select).toBeInvalid();
    expect(screen.getAllByRole('option', { name: 'America/New_York' })).toHaveLength(1);
    await userEvent.selectOptions(select, 'Antarctica/Troll');
    expect(select).toHaveValue('Antarctica/Troll');
    expect(select).toBeValid();
  });

  it('still offers UTC, common zones and the saved alias when the browser catalog is unavailable', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => { throw new RangeError('Unsupported key'); });
    render(<fieldset disabled><TimezoneSelect aria-label="Timezone" value="US/Eastern" /></fieldset>);
    expect(screen.getByRole('combobox')).toHaveValue('US/Eastern');
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('option', { name: 'UTC' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Asia/Kolkata' })).toBeInTheDocument();
  });
});
