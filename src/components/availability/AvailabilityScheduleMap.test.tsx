import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Availability } from "@/types/availability";
import AvailabilityScheduleMap from "./AvailabilityScheduleMap";

const { mapHandle } = vi.hoisted(() => ({ mapHandle: { fitBounds: vi.fn() } }));
vi.mock("@/components/ui/map", () => ({
  Map: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  Marker: ({ position, children }: { position: [number, number]; children: React.ReactNode }) => <div data-testid="pin" data-position={JSON.stringify(position)}>{children}</div>,
  MapControls: () => null,
  useMap: () => mapHandle,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const visit: Availability = {
  id: "slot-1", photographerId: "41", date: "2026-10-23", startTime: "10:30", endTime: "11:30", status: "booked", shoot_id: 101,
  shootDetails: { id: 101, title: "Residential shoot", shoot_status: "scheduled", address: "18 Maple Avenue", latitude: "38.9", longitude: "-77.03" },
};
const props = { photographers: [{ id: "41", name: "Jay Snap" }], formatTime: (time: string) => time, onShoot: vi.fn() };

describe("Availability map", () => {
  it("maps authorized booking coordinates, deduplicates visits and opens the correct shoot", () => {
    render(<AvailabilityScheduleMap {...props} slots={[visit, { ...visit, id: "same-shoot-duplicate" }, { ...visit, id: "weekly", status: "available" }]} />);
    expect(screen.getAllByTestId("pin")).toHaveLength(1);
    expect(screen.getByTestId("pin")).toHaveAttribute("data-position", "[-77.03,38.9]");
    expect(screen.getByText("1 of 1 visits mapped")).toBeVisible();
    expect(mapHandle.fitBounds).toHaveBeenCalledWith([[38.9, -77.03]], { padding: [32, 32], maxZoom: 14 });
    fireEvent.click(screen.getByRole("button", { name: "Open shoot" }));
    expect(props.onShoot).toHaveBeenCalledWith(101);
  });

  it("keeps unmapped shoots accessible without inventing locations", () => {
    render(<AvailabilityScheduleMap {...props} slots={[
      { ...visit, shootDetails: { ...visit.shootDetails!, latitude: null, longitude: null } },
      { ...visit, id: "invalid", shoot_id: 102, shootDetails: { ...visit.shootDetails!, id: 102, latitude: 91 } },
    ]} />);
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
    expect(screen.getByText("0 of 2 visits mapped")).toBeVisible();
    expect(screen.getAllByText("Location unavailable")).toHaveLength(2);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("clears the old map when a changed photographer or date has no bookings", () => {
    const { rerender } = render(<AvailabilityScheduleMap {...props} slots={[visit]} />);
    expect(screen.getByTestId("map")).toBeVisible();
    rerender(<AvailabilityScheduleMap {...props} slots={[]} />);
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
    expect(screen.queryByText("18 Maple Avenue")).not.toBeInTheDocument();
    expect(screen.getByText("No mapped shoots in this period")).toBeVisible();
  });
});
