import { createRef, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { AvailabilityPanelContent } from "./AvailabilityPanelContent";
import { AvailabilityWeekGroups } from "./AvailabilityWeekGroups";
import { groupWeekStarts } from "./availabilityWeekGrouping";
import { WeekView } from "./AvailabilityWeekView";
import type { AvailabilityCalendarBodyProps } from "./AvailabilityCalendarBody";
import type { Availability } from "@/types/availability";

afterEach(cleanup);
const day = new Date(2026, 9, 25);
const slot = (id: string, startTime = "09:00", endTime = "17:00", photographerId = id): Availability => ({
  id, startTime, endTime, photographerId, date: "2026-10-25", status: "available",
});
const people = ['Ava', 'Ben', 'Cam', 'Dan', 'Eve'].map((name, i) => ({id: String(i + 1), name, avatar: ''}));

it("groups by start boundaries while retaining exact times and distinct entries for one photographer", () => {
  const groups = groupWeekStarts([slot('1'), slot('2', '10:00'), slot('3', '07:00', '08:30'), slot('4', '20:30', '21:00'),
    {...slot('booking', '09:30', '10:15', '1'), status: 'booked'}]);
  expect(groups[0].entries.map(entry => entry.id)).toEqual(['3', '1', 'booking']);
  expect(groups[0].people).toHaveLength(2);
  expect(groups[0].people.find(entry => entry.photographerId === '1')?.status).toBe('booked');
  expect(groups[1].entries[0].startTime).toBe('10:00');
  expect(groups[6].entries[0].id).toBe('4');
  expect(groups.flatMap(group => group.entries)).toHaveLength(5);
});

it("opens overflow photographers and hands the chosen entry to its schedule drawer", async () => {
  const onSelect = vi.fn();
  function Harness() {
    const [selected, setSelected] = useState<Availability | null>(null);
    return <><AvailabilityWeekGroups day={day} slots={people.map(person => slot(person.id))} photographers={people} formatTime={value => value}
      onSelect={value => { onSelect(value); setSelected(value); }} />
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <AvailabilityPanelContent aria-describedby={undefined}><DialogTitle>Schedule details</DialogTitle><button>Selected schedule</button></AvailabilityPanelContent>
      </Dialog></>;
  }
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.getByText('+2')).toBeVisible();
  await user.click(screen.getByRole('button', {name: /starts before 10:00, 5 photographers/}));
  await user.click(screen.getByRole('button', {name: /Eve/}));
  await waitFor(() => expect(screen.getByRole('dialog', {name: 'Schedule details'})).toBeVisible());
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({id: '5', startTime: '09:00', endTime: '17:00'}));
  expect(screen.getByRole('button', {name: 'Selected schedule'})).toHaveFocus();
});

it("retains all seven date actions and selects a photographer when a grouped entry opens", async () => {
  const setDate = vi.fn(), setSelectedPhotographer = vi.fn(), setMobileTab = vi.fn(), setSelectedSlotId = vi.fn();
  const props = {
    isMobile: true, date: day, currentMonth: day, viewMode: 'week', selectedPhotographer: 'all', photographers: people,
    backendSlots: [], allBackendSlots: [{id: 123, photographer_id: 1, date: '2026-10-25', start_time: '10:00', end_time: '11:00', status: 'booked'}],
    setDate, setSelectedPhotographer, setMobileTab, setSelectedSlotId, selectedSlotId: null, setExpandedBookingDetails: vi.fn(),
    to12HourDisplay: (value: string) => value, dayViewScrollRef: createRef(), toast: vi.fn(),
  } as unknown as AvailabilityCalendarBodyProps;
  render(<WeekView {...props} />);
  const user = userEvent.setup();
  expect(screen.getByRole('region', {name: 'Weekly availability timeline'})).toBeVisible();
  for (const name of ['Sunday, October 25', 'Monday, October 26', 'Tuesday, October 27', 'Wednesday, October 28', 'Thursday, October 29', 'Friday, October 30', 'Saturday, October 31']) {
    expect(screen.getByRole('button', {name})).toBeVisible();
  }
  await user.click(screen.getByRole('button', {name: /1 photographer$/}));
  await user.click(screen.getByRole('button', {name: /Ava/}));
  await waitFor(() => expect(setMobileTab).toHaveBeenCalledWith('details'));
  expect(setSelectedPhotographer).toHaveBeenCalledWith('1');
  expect(setSelectedSlotId).toHaveBeenCalledWith('123');
  expect(setDate).toHaveBeenCalledWith(day);
});
