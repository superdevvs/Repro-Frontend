import type { Availability } from "@/types/availability";
import type { AvailabilityCalendarBodyProps } from "./AvailabilityCalendarBody";

type SelectionActions = Pick<AvailabilityCalendarBodyProps,
  "isMobile" | "setSelectedPhotographer" | "setDate" | "setSelectedSlotId" | "setExpandedBookingDetails" | "setMobileTab">;

/** Calendar entries must select their owner before opening the owner's schedule. */
export function selectCalendarPhotographer(
  actions: SelectionActions,
  photographerId: string,
  day: Date,
  slot?: Availability,
) {
  actions.setSelectedPhotographer(String(photographerId));
  actions.setDate(day);
  actions.setSelectedSlotId(slot?.id ?? null);
  if (slot?.status === "booked" && slot.shootDetails) {
    actions.setExpandedBookingDetails(previous => new Set(previous).add(slot.id));
  }
  if (actions.isMobile) actions.setMobileTab?.("details");
}
