import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SchedulingForm } from './SchedulingForm';

const mocks = vi.hoisted(() => ({ mobile: false, getDayAvailability: vi.fn() }));
vi.mock('@/components/auth', () => ({ useAuth: () => ({ user: { role: 'salesRep' } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mocks.mobile }));
vi.mock('@/utils/availabilityProvider', () => ({ getDayAvailability: mocks.getDayAvailability }));

beforeEach(() => {
  mocks.getDayAvailability.mockReset();
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const photographers = [{ id: '1150', name: 'Lee Tomassetti' }];
const selectedServices: [] = [];
const serviceSchedules = {};

it.each([
  { mobile: false, initialTime: '' },
  { mobile: true, initialTime: '' },
  { mobile: false, initialTime: '10:00 AM' },
  { mobile: true, initialTime: '10:00 AM' },
])('selects and confirms a standalone draft time without checking or changing assignments (mobile=$mobile, initialTime=$initialTime)', ({ mobile, initialTime }) => {
  mocks.mobile = mobile;
  const changeTime = vi.fn();
  const changePhotographer = vi.fn();
  const changeServicePhotographers = vi.fn();
  const changeServiceSchedules = vi.fn();
  const submit = vi.fn();
  function Draft() {
    const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 16, 12));
    const [time, setTime] = useState(initialTime);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    return <>
      <SchedulingForm date={date} setDate={setDate} time={time}
        setTime={value => { changeTime(value); setTime(value); }}
        formErrors={formErrors} setFormErrors={setFormErrors} handleSubmit={submit} goBack={vi.fn()}
        address="627-631 North Broad Street" city="Woodbury" state="NJ" zip="08096"
        photographer="1150" photographers={photographers} setPhotographer={changePhotographer}
        selectedServices={selectedServices} servicePhotographers={{}} setServicePhotographers={changeServicePhotographers}
        serviceSchedules={serviceSchedules} setServiceSchedules={changeServiceSchedules} />
      <output data-testid="draft-time">{time}</output>
    </>;
  }
  render(<Draft />);
  expect(screen.getByText('Choose a time for this appointment using the picker below.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Choose manually' }));
  expect(screen.queryByText('No available times for this schedule.')).not.toBeInTheDocument();
  for (const label of ['hour', 'minute', 'period']) {
    expect(screen.getByRole('listbox', { name: `Select ${label}` })).toHaveAttribute('aria-disabled', 'false');
  }
  if (mobile) {
    fireEvent.click(screen.getByRole('button', { name: 'Type time' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Exact time' }), { target: { value: '1:00 PM' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  } else {
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Select period' })).getByRole('option', { name: 'PM' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Select hour' })).getByRole('option', { name: '1' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Select minute' })).getByRole('option', { name: '00' }));
  }
  expect(changeTime).not.toHaveBeenCalled(); // The picker still requires OK to update the draft.
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(changeTime).toHaveBeenCalledExactlyOnceWith('01:00 PM');
  expect(screen.getByTestId('draft-time')).toHaveTextContent('01:00 PM');
  expect(changePhotographer).not.toHaveBeenCalled();
  expect(changeServicePhotographers).not.toHaveBeenCalled();
  expect(changeServiceSchedules).not.toHaveBeenCalled();
  expect(mocks.getDayAvailability).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
});
