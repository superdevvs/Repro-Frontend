import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvailabilityCompactToolbar } from "./AvailabilityCompactToolbar";

afterEach(cleanup);

function setup(overrides: Partial<React.ComponentProps<typeof AvailabilityCompactToolbar>> = {}) {
  const props = {
    photographers: [{ id: "41", name: "Jay Snap" }], selectedPhotographer: "41",
    canManagePhotographerSelection: true, canEditAvailability: true,
    date: new Date(2026, 9, 23), viewMode: "week" as const, showingMap: false,
    onSelectPhotographer: vi.fn(), onViewModeChange: vi.fn(), onToggleMap: vi.fn(),
    onDateChange: vi.fn(), onNavigate: vi.fn(), onToday: vi.fn(), onBlock: vi.fn(),
    onTeam: vi.fn(), onDetails: vi.fn(), onAddSchedule: vi.fn(), onDefaultSchedule: vi.fn(), onSync: vi.fn(),
    ...overrides,
  };
  const view = render(<AvailabilityCompactToolbar {...props} />);
  return { props, ...view };
}

describe("compact Availability controls", () => {
  it("opens scheduling flows from the whole-team menu so the drawer can choose a photographer", async () => {
    const user = userEvent.setup();
    const { props } = setup({ selectedPhotographer: "all" });
    await user.click(screen.getByRole("button", { name: "Availability menu" }));
    await user.click(screen.getByRole("button", { name: "Add schedule" }));
    expect(props.onAddSchedule).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Availability menu" }));
    await user.click(screen.getByRole("button", { name: "Default schedule" }));
    expect(props.onDefaultSchedule).toHaveBeenCalledOnce();
  });

  it("retains access to existing schedule, team and sync actions through the menu", async () => {
    const user = userEvent.setup();
    const { props } = setup();
    for (const [label, callback] of [
      ["Team availability", props.onTeam], ["Schedule details", props.onDetails],
      ["Add schedule", props.onAddSchedule], ["Default schedule", props.onDefaultSchedule],
      ["Calendar sync", props.onSync],
    ] as const) {
      await user.click(screen.getByRole("button", { name: "Availability menu" }));
      await user.click(screen.getByRole("button", { name: label }));
      expect(callback).toHaveBeenCalledOnce();
      expect(screen.queryByRole("dialog", { name: "Calendar tools" })).not.toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Block time" }));
    expect(props.onBlock).toHaveBeenCalledOnce();
  });

  it("does not expose team or editing controls to a read-only photographer", async () => {
    const user = userEvent.setup();
    setup({ canManagePhotographerSelection: false, canEditAvailability: false });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Jay Snap")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Block time" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Availability menu" }));
    expect(screen.queryByRole("button", { name: "Team availability" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add schedule" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schedule details" })).toBeVisible();
  });

  it("identifies the map selection and keeps date navigation available for its current period", () => {
    const { props } = setup({ showingMap: true, date: new Date(2026, 9, 31) });
    expect(screen.getByRole("button", { name: "Map view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Choose date, Oct 25 – 31" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(props.onNavigate).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(props.onViewModeChange).toHaveBeenCalledWith("day");
    expect(props.onDateChange).not.toHaveBeenCalled();
  });
});
