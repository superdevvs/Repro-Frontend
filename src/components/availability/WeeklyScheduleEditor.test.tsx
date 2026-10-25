import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";
import type { WeeklyScheduleItem } from "@/types/availability";

const initial = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => ({
  day, active: index < 5, startTime: '09:00', endTime: '17:00',
}));
function Harness({ onSave = vi.fn(), saving = false }) {
  const [days, setDays] = useState<WeeklyScheduleItem[]>(initial);
  return <WeeklyScheduleEditor editingWeeklySchedule setEditingWeeklySchedule={vi.fn()}
    getCurrentWeeklySchedule={() => days} updateCurrentWeeklySchedule={(index, field, value) =>
      setDays(previous => previous.map((day, i) => i === index ? { ...day, [field]: value } : day))}
    weeklyScheduleNote="" setWeeklyScheduleNote={vi.fn()} handleEditAvailability={vi.fn()}
    saveWeeklySchedule={async () => onSave(days)} savingWeeklySchedule={saving}
    selectedPhotographer="41" getPhotographerName={() => 'Jay'} canEditAvailability backendSlots={[]} />;
}
describe('Default schedule drawer editor', () => {
  it('saves different hours per weekday and preserves inactive days', async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText('Monday start'), { target: { value: '10:30' } });
    fireEvent.change(screen.getByLabelText('Tuesday end'), { target: { value: '15:00' } });
    await user.click(screen.getByRole('checkbox', { name: 'Wednesday' }));
    expect(screen.getByLabelText('Wednesday start')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save default schedule' }));
    expect(onSave).toHaveBeenCalledWith(expect.arrayContaining([
      { day: 'Mon', active: true, startTime: '10:30', endTime: '17:00' },
      { day: 'Tue', active: true, startTime: '09:00', endTime: '15:00' },
      { day: 'Wed', active: false, startTime: '09:00', endTime: '17:00' },
    ]));
    expect(screen.getByLabelText('Saturday end')).toBeDisabled();
  });
  it('prevents changes and cancellation while saving', () => {
    render(<Harness saving />);
    expect(screen.getByLabelText('Monday start')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Monday' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });
});
