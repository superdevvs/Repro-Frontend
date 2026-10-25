import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { WeeklyScheduleDialog, type NewWeeklyScheduleState } from "./WeeklyScheduleDialog";

vi.mock("../AvailabilityTimeField", () => ({ AvailabilityTimeField: () => <span>Time control</span> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Harness({ ready = true, onClose = vi.fn() }: { ready?: boolean; onClose?: () => void }) {
  const [selected, setSelected] = useState("all");
  const [schedule, setSchedule] = useState<NewWeeklyScheduleState>({ startTime: "09:00", endTime: "17:00", status: "available", recurring: false, days: [true, true, true, true, true, false, false], note: "" });
  const date = new Date(2026, 9, 26);
  return <WeeklyScheduleDialog open onOpenChange={onClose} newWeeklySchedule={schedule} setNewWeeklySchedule={setSchedule}
    specificDateFrom={date} setSpecificDateFrom={vi.fn()} specificDateTo={date} setSpecificDateTo={vi.fn()} specificScheduleDates={[date]}
    selectedPhotographer={selected} isAvailabilityReady={ready} photographerPicker={<select aria-label="Photographer" value={selected} onChange={event => setSelected(event.target.value)}><option value="all">Select photographer</option><option value="41">Jay Snap</option></select>}
    getPhotographerName={() => "Jay Snap"} checkTimeOverlap={() => false} date={date} authHeaders={() => ({})} refreshPhotographerSlots={async () => undefined} toast={vi.fn()} />;
}

it("requires a photographer inside Add Schedule and saves for that person", async () => {
  const request = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", request);
  const onClose = vi.fn();
  render(<Harness onClose={onClose} />);
  const save = screen.getByRole("button", { name: "Add Schedule" });
  expect(save).toBeDisabled();
  fireEvent.click(save);
  expect(request).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox", { name: "Photographer" }), { target: { value: "41" } });
  expect(save).toBeEnabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Schedule note" }), { target: { value: "Morning coverage" } });
  fireEvent.click(save);
  await waitFor(() => expect(onClose).toHaveBeenCalledWith(false));
  expect(request).toHaveBeenCalledOnce();
  expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toMatchObject({ photographer_id: 41, availabilities: [{ date: "2026-10-26", start_time: "09:00", end_time: "17:00", note: "Morning coverage" }] });
});

it("saves a weekly repeat for only the selected weekdays with its note", async () => {
  const request = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", request);
  render(<Harness />);
  fireEvent.change(screen.getByRole("combobox", { name: "Photographer" }), { target: { value: "41" } });
  fireEvent.click(screen.getByRole("button", { name: "Repeat weekly" }));
  fireEvent.click(screen.getByRole("button", { name: "Monday" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Schedule note" }), { target: { value: "Weekly cover" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Schedule" }));
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  const payload = JSON.parse(String(request.mock.calls[0][1]?.body));
  expect(payload.availabilities.map((slot: {day_of_week: string}) => slot.day_of_week)).toEqual(["tuesday", "wednesday", "thursday", "friday"]);
  expect(payload.availabilities.every((slot: {note: string}) => slot.note === "Weekly cover")).toBe(true);
});

it("waits for the chosen photographer's availability before permitting a save", () => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  const { rerender } = render(<Harness ready={false} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Photographer" }), { target: { value: "41" } });
  expect(screen.getByRole("button", { name: "Add Schedule" })).toBeDisabled();
  expect(request).not.toHaveBeenCalled();
  rerender(<Harness ready />);
  expect(screen.getByRole("button", { name: "Add Schedule" })).toBeEnabled();
});
