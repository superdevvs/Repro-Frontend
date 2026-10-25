import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { ScheduleDetailsPanel } from "./ScheduleDetailsPanel";

afterEach(cleanup);

it("renders the working weekly editor in the mobile details drawer", () => {
  const saveWeeklySchedule = vi.fn(async () => undefined);
  const updateCurrentWeeklySchedule = vi.fn();
  const props: React.ComponentProps<typeof ScheduleDetailsPanel> = {
    variant: "mobile", viewMode: "day", date: new Date(2026, 9, 23), selectedPhotographer: "41",
    getPhotographerName: () => "Jay", getSelectedDateAvailabilities: () => [], getWeekAvailabilities: () => [], getMonthAvailabilities: () => [],
    canEditAvailability: true, editingWeeklySchedule: true, setEditingWeeklySchedule: vi.fn(),
    getCurrentWeeklySchedule: () => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => ({day, active: index < 5, startTime: "09:00", endTime: "17:00"})),
    updateCurrentWeeklySchedule, weeklyScheduleNote: "", setWeeklyScheduleNote: vi.fn(),
    handleEditAvailability: vi.fn(), openDefaultSchedule: vi.fn(), saveWeeklySchedule,
    handleDeleteAvailability: vi.fn(), handleMarkUnavailable: vi.fn(), notifyDemoAvailabilityRestriction: vi.fn(),
    backendSlots: [], allBackendSlots: [], selectedSlotId: null, setSelectedSlotId: vi.fn(),
    expandedBookingDetails: new Set(), setExpandedBookingDetails: vi.fn(), setEditedAvailability: vi.fn(),
    setIsEditDialogOpen: vi.fn(), setIsWeeklyScheduleDialogOpen: vi.fn(), setSelectedShootId: vi.fn(),
    setShootDetailsModalOpen: vi.fn(), to12HourDisplay: value => value || "",
  };
  render(<ScheduleDetailsPanel {...props} />);
  expect(screen.getByRole("textbox", { name: "Default start time" })).toHaveValue("09:00");
  fireEvent.change(screen.getByRole("textbox", { name: "Default start time" }), { target: { value: "10:00" } });
  expect(updateCurrentWeeklySchedule).toHaveBeenCalledTimes(7);
  for (let index = 0; index < 7; index += 1) expect(updateCurrentWeeklySchedule).toHaveBeenCalledWith(index, "startTime", "10:00");
  fireEvent.click(screen.getByRole("button", { name: "Save default schedule" }));
  expect(saveWeeklySchedule).toHaveBeenCalledOnce();
});
