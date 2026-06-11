// Edit_Picker bounds + inline-422 behavior — component-level (task 3.6, optional).
//
// Companion to `editPickerBounds.test.ts` (which exercises the pure cores). This
// file renders a small React harness that mirrors how `ShootEditModal` wires the
// Edit_Picker so the behavior is verified through the DOM with
// @testing-library/react:
//
//   (1) Out-of-bounds time selections are rendered DISABLED (outside the
//       Availability_Provider `workingHours` window OR within a blocked
//       interval) and cannot be chosen, while in-bounds selections stay enabled
//       and selectable — the same `isTimeOutsideDayAvailability` predicate the
//       real picker passes as `isTimeDisabled` (Req 2.1).
//
//   (2) A backend 422 carrying `errors.start_time` surfaces an inline schedule
//       error in the panel while the user's OTHER unsaved edits (here, a notes
//       field and the time the user had selected) are preserved — mapping the
//       response with `extractStartTimeScheduleError`, exactly as
//       `ShootEditModal.submitApproval` does (Req 2.4).
//
// **Validates: Requirements 2.1, 2.4**

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';

import type { DayAvailability } from '@/utils/availabilityProvider';
import {
  extractStartTimeScheduleError,
  isTimeOutsideDayAvailability,
  type ShootUpdateErrorBody,
} from '@/utils/editPickerBounds';

afterEach(cleanup);

type TimeOption = { value: string; label: string };

const OPTIONS: TimeOption[] = [
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '12:30', label: '12:30 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
];

const DAY_9_TO_6_WITH_LUNCH: DayAvailability = {
  workingHours: { start: '09:00', end: '18:00' },
  blocked: [{ start: '12:00', end: '13:00' }],
  fromConfig: true,
  timezone: 'Asia/Kolkata',
};

/**
 * Minimal harness reproducing the Edit_Picker wiring from `ShootEditModal`:
 *  - the disabling predicate is `isTimeOutsideDayAvailability(editDayAvailability, value)`,
 *    the same function the real `ServiceTimePicker` receives as `isTimeDisabled`;
 *  - the inline schedule error is set from a 422 via `extractStartTimeScheduleError`
 *    without touching any other unsaved edit (the time + notes fields).
 */
function EditPickerHarness({
  day,
  submit,
}: {
  day: DayAvailability | null;
  /** Returns the (status, body) the backend would respond with on save. */
  submit: () => { status: number; body: ShootUpdateErrorBody | null };
}) {
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const handleSave = () => {
    const { status, body } = submit();
    const inline = extractStartTimeScheduleError(status, body);
    if (inline) {
      // Surface inline WITHOUT discarding other unsaved edits: only the
      // schedule-error string changes; selectedTime/notes are left intact.
      setScheduleError(inline);
      return;
    }
    setScheduleError(null);
  };

  return (
    <div>
      <div data-testid="selected-time">{selectedTime}</div>

      <ul aria-label="time-options">
        {OPTIONS.map((opt) => {
          const disabled = day ? isTimeOutsideDayAvailability(day, opt.value) : false;
          return (
            <li key={opt.value}>
              <button
                type="button"
                aria-label={`time-${opt.value}`}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  setSelectedTime(opt.value);
                }}
              >
                {opt.label}
              </button>
            </li>
          );
        })}
      </ul>

      <label>
        Notes
        <textarea
          aria-label="shoot-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <button type="button" onClick={handleSave}>
        Save
      </button>

      {scheduleError ? (
        <p role="alert" data-testid="schedule-error">
          {scheduleError}
        </p>
      ) : null}
    </div>
  );
}

const noopSubmit = () => ({ status: 200, body: null });

describe('Edit_Picker disables out-of-bounds selections (Req 2.1)', () => {
  it('renders out-of-bounds times as disabled and in-bounds times as enabled', () => {
    render(<EditPickerHarness day={DAY_9_TO_6_WITH_LUNCH} submit={noopSubmit} />);
    const list = screen.getByRole('list', { name: 'time-options' });

    // Outside the 09:00–18:00 window.
    expect(within(list).getByLabelText('time-08:00')).toBeDisabled();
    expect(within(list).getByLabelText('time-19:00')).toBeDisabled();
    // Inside the lunch block [12:00, 13:00).
    expect(within(list).getByLabelText('time-12:00')).toBeDisabled();
    expect(within(list).getByLabelText('time-12:30')).toBeDisabled();

    // In-bounds (and the block's end is re-opened).
    expect(within(list).getByLabelText('time-09:00')).toBeEnabled();
    expect(within(list).getByLabelText('time-13:00')).toBeEnabled();
    expect(within(list).getByLabelText('time-18:00')).toBeEnabled();
  });

  it('does not change the selected time when an out-of-bounds option is clicked', async () => {
    const user = userEvent.setup();
    render(<EditPickerHarness day={DAY_9_TO_6_WITH_LUNCH} submit={noopSubmit} />);

    expect(screen.getByTestId('selected-time')).toHaveTextContent('09:00');

    // Disabled buttons swallow the click — selection is unchanged.
    await user.click(screen.getByLabelText('time-19:00'));
    expect(screen.getByTestId('selected-time')).toHaveTextContent('09:00');

    // An in-bounds option is selectable.
    await user.click(screen.getByLabelText('time-13:00'));
    expect(screen.getByTestId('selected-time')).toHaveTextContent('13:00');
  });
});

describe('Edit_Picker surfaces a 422 inline while preserving unsaved edits (Req 2.4)', () => {
  it('shows the inline schedule error from a 422 and keeps other unsaved edits', async () => {
    const user = userEvent.setup();
    const submit = vi.fn(() => ({
      status: 422,
      body: {
        message: 'The given data was invalid.',
        errors: { start_time: ['Selected time is outside available hours.'] },
      } as ShootUpdateErrorBody,
    }));

    render(<EditPickerHarness day={DAY_9_TO_6_WITH_LUNCH} submit={submit} />);

    // The user makes unsaved edits: pick an in-bounds time and type notes.
    await user.click(screen.getByLabelText('time-13:00'));
    await user.type(screen.getByLabelText('shoot-notes'), 'Gate code 4321');
    expect(screen.getByTestId('selected-time')).toHaveTextContent('13:00');

    // Save returns a 422 keyed on start_time.
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Inline error appears...
    const alert = await screen.findByTestId('schedule-error');
    expect(alert).toHaveTextContent('Selected time is outside available hours.');

    // ...and the other unsaved edits are preserved (not discarded by the error).
    expect(screen.getByTestId('selected-time')).toHaveTextContent('13:00');
    expect(screen.getByLabelText('shoot-notes')).toHaveValue('Gate code 4321');
  });

  it('does not surface an inline schedule error for a non-start_time 422', async () => {
    const user = userEvent.setup();
    const submit = vi.fn(() => ({
      status: 422,
      body: { errors: { address: ['The address field is required.'] } } as ShootUpdateErrorBody,
    }));

    render(<EditPickerHarness day={DAY_9_TO_6_WITH_LUNCH} submit={submit} />);

    await user.type(screen.getByLabelText('shoot-notes'), 'Lockbox on door');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByTestId('schedule-error')).not.toBeInTheDocument();
    // Unsaved edits remain intact regardless.
    expect(screen.getByLabelText('shoot-notes')).toHaveValue('Lockbox on door');
  });
});
