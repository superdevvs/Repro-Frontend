import { Ban, Camera, ChevronRight, Clock, Settings2 } from "lucide-react";
import type { Availability } from "@/types/availability";
import { AvailabilityAvatarStack } from "./AvailabilityAvatarStack";
import { clockTime, freeDuration, type PhotographerDay } from "./calendarModel";

export type CalendarFilters = {
  open: boolean;
  booked: boolean;
  blocked: boolean;
};
export function AvailabilityDayCards({
  days,
  formatTime,
  canEdit,
  filters,
  onBlock,
  onShoot,
  onEdit,
  onManage,
}: {
  days: PhotographerDay[];
  formatTime: (time: string) => string;
  canEdit: boolean;
  filters: CalendarFilters;
  onBlock: (personId: string, from: string, to: string) => void;
  onShoot: (id: number) => void;
  onEdit: (slot: Availability) => void;
  onManage: (id: string) => void;
}) {
  return (
    <div className="availability-day-cards">
      {days.map((day) => {
        const timeline = [
          ...(filters.open
            ? day.free.map((window, index) => ({
                id: `free-${index}`,
                start: clockTime(window.start),
                end: clockTime(window.end),
                type: "free" as const,
                slot: null,
              }))
            : []),
          ...[
            ...(filters.booked ? day.bookings : []),
            ...(filters.blocked ? day.blocks : []),
          ].map((slot) => ({
            id: slot.id,
            start: slot.startTime,
            end: slot.endTime,
            type: slot.status,
            slot,
          })),
        ].sort((a, b) => a.start.localeCompare(b.start));
        return (
          <article
            className="availability-person-card"
            key={day.photographer.id}
            aria-label={`${day.photographer.name}'s schedule`}
          >
            <div className="availability-person-heading">
              <AvailabilityAvatarStack photographers={[day.photographer]} />
              <div className="availability-person-name">
                <h3>{day.photographer.name}</h3>
                <p>
                  {day.working.length
                    ? day.working
                        .map(
                          (w) =>
                            `${formatTime(clockTime(w.start))}–${formatTime(clockTime(w.end))}`,
                        )
                        .join(" · ")
                    : "No working hours"}
                </p>
              </div>
              <span className="availability-free-label">
                {freeDuration(day.freeMinutes)}
                <small>open</small>
              </span>
            </div>
            <div className="availability-person-meta">
              <span>
                {day.bookings.length} scheduled{" "}
                {day.bookings.length === 1 ? "visit" : "visits"}
              </span>
              {canEdit && (
                <button
                  onClick={() => onManage(day.photographer.id)}
                  aria-label={`Manage ${day.photographer.name}'s schedules`}
                >
                  <Settings2 />
                  Manage
                </button>
              )}
            </div>
            <div className="availability-timeline">
              {timeline.length ? (
                timeline.map((row) => {
                  const shoot =
                    row.slot?.shoot_id ?? row.slot?.shootDetails?.id;
                  const title =
                    row.type === "free"
                      ? "Available"
                      : row.type === "booked"
                        ? row.slot?.shootDetails?.services
                            ?.map((s) => s.name)
                            .join(" · ") || "Scheduled shoot"
                        : "Blocked time";
                  const detail =
                    row.type === "free"
                      ? `${formatTime(row.start)}–${formatTime(row.end)}`
                      : row.type === "booked"
                        ? row.slot?.shootDetails?.address ||
                          row.slot?.shootTitle ||
                          "Property details unavailable"
                        : row.slot?.note ||
                          `${formatTime(row.start)}–${formatTime(row.end)}`;
                  const interactive =
                    row.type === "booked" ? Boolean(shoot) : canEdit;
                  return (
                    <div
                      className="availability-timeline-row"
                      key={`${row.type}-${row.id}`}
                    >
                      <time>{formatTime(row.start)}</time>
                      <button
                        disabled={!interactive}
                        className={`availability-slot availability-slot-${row.type}`}
                        onClick={() => {
                          if (row.type === "free")
                            onBlock(day.photographer.id, row.start, row.end);
                          else if (shoot) onShoot(shoot);
                          else if (row.slot) onEdit(row.slot);
                        }}
                        aria-label={`${title}, ${detail}, ${day.photographer.name}`}
                      >
                        {row.type === "booked" ? (
                          <Camera />
                        ) : row.type === "unavailable" ? (
                          <Ban />
                        ) : (
                          <Clock />
                        )}
                        <span>
                          <strong>{title}</strong>
                          <small>{detail}</small>
                          {row.type === "booked" && (
                            <small>
                              {formatTime(row.start)}–{formatTime(row.end)} ·{" "}
                              {row.slot?.shootDetails?.shoot_status?.replaceAll(
                                "_",
                                " ",
                              ) || "Booked"}
                            </small>
                          )}
                        </span>
                        {interactive && (
                          <ChevronRight className="availability-slot-chevron" />
                        )}
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="availability-empty-note">
                  {day.rules.length || day.blocks.length || day.bookings.length
                    ? "No items match these filters."
                    : "No schedule added for this date."}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
