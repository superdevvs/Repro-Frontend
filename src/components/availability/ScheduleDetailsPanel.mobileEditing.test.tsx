import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { ScheduleDetailsPanel } from "./ScheduleDetailsPanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function createProps(): React.ComponentProps<typeof ScheduleDetailsPanel> {
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
  return props;
}

it("renders the working weekly editor in the mobile details drawer", () => {
  const props = createProps();
  render(<ScheduleDetailsPanel {...props} />);
  expect(screen.getByRole("textbox", { name: "Default start time" })).toHaveValue("09:00");
  fireEvent.change(screen.getByRole("textbox", { name: "Default start time" }), { target: { value: "10:00" } });
  expect(props.updateCurrentWeeklySchedule).toHaveBeenCalledTimes(7);
  for (let index = 0; index < 7; index += 1) expect(props.updateCurrentWeeklySchedule).toHaveBeenCalledWith(index, "startTime", "10:00");
  fireEvent.click(screen.getByRole("button", { name: "Save default schedule" }));
  expect(props.saveWeeklySchedule).toHaveBeenCalledOnce();
});

it("keeps recurring occurrences distinct when the mobile month drawer changes dates", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const props = createProps();
  props.editingWeeklySchedule = false;
  props.viewMode = "month";
  props.date = undefined;
  const occurrence = (date: string) => ({
    id: "weekly-1", photographerId: "41", date, startTime: "09:00", endTime: "17:00",
    status: "available" as const, origin: "weekly" as const,
  });
  props.getMonthAvailabilities = () => [occurrence("2026-10-19"), occurrence("2026-10-26")];
  const { rerender } = render(<ScheduleDetailsPanel {...props} />);
  expect(screen.getByText("Oct 19, 2026")).toBeInTheDocument();
  expect(screen.getByText("Oct 26, 2026")).toBeInTheDocument();
  rerender(<ScheduleDetailsPanel {...props} getMonthAvailabilities={() => [occurrence("2026-11-02")]} />);
  expect(screen.queryByText("Oct 19, 2026")).not.toBeInTheDocument();
  expect(screen.queryByText("Oct 26, 2026")).not.toBeInTheDocument();
  expect(screen.getByText("Nov 2, 2026")).toBeInTheDocument();
  expect(consoleError.mock.calls.flat().join(" ")).not.toContain("same key");
});
