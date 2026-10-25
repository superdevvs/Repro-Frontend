import React, { useRef, useState } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { Sheet, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AvailabilityPanelContent } from "./AvailabilityPanelContent";
import { AvailabilityCalendarBody, type AvailabilityCalendarBodyProps } from "./AvailabilityCalendarBody";
import { AvailabilityPhotographerSelect } from "./AvailabilityPhotographerSelect";
import { ScheduleDetailsPanel } from "./ScheduleDetailsPanel";
import { buildSelectedDateAvailabilities, buildWeekAvailabilities, buildMonthAvailabilities } from "@/lib/availability/selectors";
import type { BackendSlot } from "@/types/availability";

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

const day = new Date(2026, 9, 25);
const photographers = [{ id: '41', name: 'Ava Stone' }, { id: '42', name: 'Ben Reed' }, { id: '43', name: 'Cam Park' }];
const rows: BackendSlot[] = photographers.map((person, index) => ({
  id: 100 + index, photographer_id: Number(person.id), date: '2026-10-25', start_time: '09:00', end_time: '17:00', status: 'available',
}));

function Harness({ viewMode, isMobile = true }: { viewMode: 'day' | 'week' | 'month'; isMobile?: boolean }) {
  const [date, setDate] = useState<Date | undefined>(day);
  const [currentMonth, setCurrentMonth] = useState(day);
  const [selectedPhotographer, setSelectedPhotographer] = useState('all');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [expandedBookingDetails, setExpandedBookingDetails] = useState(new Set<string>());
  const [mobileTab, setMobileTab] = useState<'calendar' | 'details'>('calendar');
  const backendSlots = rows.filter(row => String(row.photographer_id) === selectedPhotographer);
  const deps = { selectedPhotographer, backendSlots, allBackendSlots: rows };
  const getSelectedDateAvailabilities = () => buildSelectedDateAvailabilities(deps, date);
  const getWeekAvailabilities = () => buildWeekAvailabilities(deps, date);
  const getMonthAvailabilities = () => buildMonthAvailabilities(deps, date);
  const calendar: AvailabilityCalendarBodyProps = {
    viewMode, isMobile, date, setDate, currentMonth, setCurrentMonth, selectedPhotographer, setSelectedPhotographer,
    photographers, backendSlots, allBackendSlots: rows, selectedSlotId, setSelectedSlotId, expandedBookingDetails, setExpandedBookingDetails,
    setMobileTab, getSelectedDateAvailabilities, to12HourDisplay: time => time || '',
    dayViewScrollRef: useRef(null), dayViewTimeScrollRef: useRef(null), dayViewScrollChanging: useRef(false),
    dayViewScrollTimeout: useRef(null), dayViewLastChangeTime: useRef(0), dayViewIsProgrammaticScroll: useRef(false),
    setRightClickedDate: vi.fn(), setRightClickedTime: vi.fn(), setIsWeeklyScheduleDialogOpen: vi.fn(),
    setIsBlockDialogOpen: vi.fn(), setBlockSchedule: vi.fn(), toast: vi.fn(),
  };
  const details: React.ComponentProps<typeof ScheduleDetailsPanel> = {
    variant: isMobile ? 'mobile' : 'desktop', viewMode, date, selectedPhotographer,
    getPhotographerName: id => photographers.find(person => person.id === id)?.name || 'Unknown',
    getSelectedDateAvailabilities, getWeekAvailabilities, getMonthAvailabilities,
    canEditAvailability: true, editingWeeklySchedule: false, setEditingWeeklySchedule: vi.fn(),
    getCurrentWeeklySchedule: () => [], updateCurrentWeeklySchedule: vi.fn(), weeklyScheduleNote: '', setWeeklyScheduleNote: vi.fn(),
    handleEditAvailability: vi.fn(), openDefaultSchedule: vi.fn(), saveWeeklySchedule: vi.fn(), handleDeleteAvailability: vi.fn(),
    handleMarkUnavailable: vi.fn(), notifyDemoAvailabilityRestriction: vi.fn(), backendSlots, allBackendSlots: rows,
    selectedSlotId, setSelectedSlotId, expandedBookingDetails, setExpandedBookingDetails, setEditedAvailability: vi.fn(),
    setIsEditDialogOpen: vi.fn(), setIsWeeklyScheduleDialogOpen: vi.fn(), setSelectedShootId: vi.fn(), setShootDetailsModalOpen: vi.fn(),
    to12HourDisplay: time => time || '',
  };
  const panel = <><AvailabilityPhotographerSelect canManagePhotographerSelection photographers={photographers}
    selectedPhotographer={selectedPhotographer} allowAll={false} onSelect={id => { setSelectedPhotographer(id); setSelectedSlotId(null); }} />
    <ScheduleDetailsPanel {...details} /></>;
  return <><AvailabilityCalendarBody {...calendar} />{isMobile ? <Sheet open={mobileTab === 'details'} onOpenChange={open => setMobileTab(open ? 'details' : 'calendar')}>
    <AvailabilityPanelContent aria-describedby={undefined}><SheetHeader><SheetTitle>Schedule details</SheetTitle></SheetHeader>{panel}</AvailabilityPanelContent>
  </Sheet> : <section aria-label="Schedule details">{panel}</section>}</>;
}

it.each(['day', 'week', 'month'] as const)('selects the photographer and loads their schedule from the mobile %s calendar', async viewMode => {
  const user = userEvent.setup();
  render(<Harness viewMode={viewMode} />);
  if (viewMode === 'week') {
    await user.click(screen.getByRole('button', { name: /starts before 10:00, 3 photographers/ }));
    await user.click(screen.getByRole('button', { name: /Ava Stone/ }));
  } else {
    await user.click(screen.getByRole('button', { name: 'View Ava Stone schedule on October 25' }));
  }
  const drawer = await screen.findByRole('dialog', { name: 'Schedule details' });
  expect(within(drawer).getByRole('combobox', { name: 'Photographer' })).toHaveTextContent('Ava Stone');
  expect(within(drawer).getByText("Ava Stone's Schedule")).toBeVisible();
  expect(within(drawer).getByText(/09:00.*17:00/)).toBeVisible();
  expect(within(drawer).queryByText('Select a photographer')).not.toBeInTheDocument();
  await user.click(within(drawer).getByRole('combobox', { name: 'Photographer' }));
  await user.click(screen.getByRole('option', { name: 'Ben Reed' }));
  expect(within(drawer).getByRole('combobox', { name: 'Photographer' })).toHaveTextContent('Ben Reed');
  expect(within(drawer).getByText("Ben Reed's Schedule")).toBeVisible();
});

it.each(['day', 'week', 'month'] as const)('updates desktop %s details when a team avatar is activated', async viewMode => {
  const user = userEvent.setup();
  render(<Harness viewMode={viewMode} isMobile={false} />);
  const avatar = screen.getByRole('button', { name: 'View Ava Stone schedule on October 25' });
  avatar.focus();
  await user.keyboard('{Enter}');
  const panel = screen.getByRole('region', { name: 'Schedule details' });
  expect(within(panel).getByRole('combobox', { name: 'Photographer' })).toHaveTextContent('Ava Stone');
  expect(within(panel).getByText("Ava Stone's Schedule")).toBeVisible();
});

it('opens a photographer hidden by the month overflow without losing the selected date', async () => {
  const user = userEvent.setup();
  render(<Harness viewMode="month" />);
  await user.click(screen.getByRole('button', { name: 'Show 1 more photographers for October 25' }));
  expect(screen.queryByRole('dialog', { name: 'Schedule details' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Cam Park' }));
  const drawer = await screen.findByRole('dialog', { name: 'Schedule details' });
  await waitFor(() => expect(within(drawer).getByRole('combobox', { name: 'Photographer' })).toHaveTextContent('Cam Park'));
  expect(within(drawer).getByText("Cam Park's Schedule")).toBeVisible();
  expect(within(drawer).getByText('Oct 25, 2026')).toBeVisible();
});

it.each(['week', 'month'] as const)('keeps a date-only %s tap on the team calendar instead of opening an empty drawer', async viewMode => {
  const user = userEvent.setup();
  render(<Harness viewMode={viewMode} />);
  await user.click(screen.getByRole('button', { name: 'Sunday, October 25' }));
  expect(screen.queryByRole('dialog', { name: 'Schedule details' })).not.toBeInTheDocument();
});
