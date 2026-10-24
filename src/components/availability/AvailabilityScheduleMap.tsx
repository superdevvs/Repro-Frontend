import { useEffect, useMemo, useRef } from "react";
import { MapPin } from "lucide-react";
import { Map, MapControls, Marker, type MapHandle } from "@/components/ui/map";
import { AvailabilityAvatarStack } from "./AvailabilityAvatarStack";
import type { PhotographerDay } from "./calendarModel";

export default function AvailabilityScheduleMap({
  days,
  onShoot,
  formatTime,
}: {
  days: PhotographerDay[];
  onShoot: (id: number) => void;
  formatTime: (time: string) => string;
}) {
  const map = useRef<MapHandle>(null);
  const visits = useMemo(
    () =>
      days.flatMap((day) =>
        day.bookings.map((booking) => ({ booking, person: day.photographer })),
      ),
    [days],
  );
  const mapped = visits.filter(
    ({ booking }) =>
      typeof booking.shootDetails?.latitude === "number" &&
      typeof booking.shootDetails?.longitude === "number" &&
      Math.abs(booking.shootDetails.latitude) <= 90 &&
      Math.abs(booking.shootDetails.longitude) <= 180,
  );
  const points = mapped.map(
    ({ booking }) =>
      [booking.shootDetails!.longitude!, booking.shootDetails!.latitude!] as [
        number,
        number,
      ],
  );
  const positionsKey = JSON.stringify(points);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (points.length)
        map.current?.recenter(points, { maxZoom: 14, padding: 35 });
    });
    return () => cancelAnimationFrame(frame);
    // Recenter only when locations change, not when unrelated controls update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey]);
  return (
    <section className="p-3 sm:p-5" aria-label="Selected day map">
      <div className="availability-section-title">
        <h2>Shoot locations</h2>
        <span>
          {mapped.length} of {visits.length} visits mapped
        </span>
      </div>
      {points.length ? (
        <Map
          ref={map}
          center={points[0]}
          zoom={11}
          className="h-[380px] w-full overflow-hidden rounded-2xl sm:h-[480px]"
        >
          <MapControls />
          {mapped.map(({ booking, person }) => (
            <Marker
              key={`${person.id}-${booking.id}`}
              position={[
                booking.shootDetails!.longitude!,
                booking.shootDetails!.latitude!,
              ]}
            >
              <strong>{person.name}</strong>
              <p>{booking.shootDetails?.address}</p>
              <p>
                {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
              </p>
              <button
                onClick={() =>
                  onShoot(booking.shoot_id ?? booking.shootDetails!.id)
                }
              >
                Open shoot
              </button>
            </Marker>
          ))}
        </Map>
      ) : (
        <div className="availability-empty">
          <MapPin />
          <h2>No mapped shoots for this date</h2>
          <p>
            Scheduled properties appear here when their location is available.
          </p>
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {visits.map(({ booking, person }) => (
          <button
            key={`${person.id}-${booking.id}`}
            className="availability-person-card flex items-center gap-3 text-left"
            onClick={() => {
              const id = booking.shoot_id ?? booking.shootDetails?.id;
              if (id) onShoot(id);
            }}
          >
            <AvailabilityAvatarStack photographers={[person]} />
            <span className="min-w-0">
              <strong className="block text-sm">
                {person.name} · {formatTime(booking.startTime)}
              </strong>
              <small className="mt-1 block break-words text-muted-foreground">
                {booking.shootDetails?.address || "Address unavailable"}
              </small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
