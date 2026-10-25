import { useEffect, useMemo } from "react";
import { MapPin } from "lucide-react";
import { Map, MapControls, Marker, useMap } from "@/components/ui/map";
import { Button } from "@/components/ui/button";
import type { Availability, Photographer } from "@/types/availability";
import { formatAvailabilityDate } from "@/lib/availability/utils";

type Point = [number, number];

function coordinates(slot: Availability): Point | null {
  const lat = slot.shootDetails?.latitude;
  const lng = slot.shootDetails?.longitude;
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? [longitude, latitude]
    : null;
}

function FitLocations({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(points.map(([lng, lat]) => [lat, lng]), { padding: [32, 32], maxZoom: 14 });
  }, [map, points]);
  return null;
}

export default function AvailabilityScheduleMap({ slots, photographers, onShoot, formatTime }: {
  slots: Availability[];
  photographers: Photographer[];
  onShoot: (id: number) => void;
  formatTime: (value: string) => string;
}) {
  const visits = useMemo(() => {
    const seen = new Set<string>();
    return slots.filter(slot => {
      if (slot.status !== "booked") return false;
      const key = `${slot.photographerId}:${slot.date}:${slot.shoot_id ?? slot.shootDetails?.id ?? slot.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  }, [slots]);
  const mapped = useMemo(() => visits.flatMap(slot => {
    const point = coordinates(slot);
    return point ? [{ slot, point }] : [];
  }), [visits]);
  const points = useMemo(() => mapped.map(visit => visit.point), [mapped]);
  const personName = (id: string) => photographers.find(person => person.id === id)?.name || "Photographer";

  return (
    <section aria-label="Shoot locations" className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2 px-1 py-1 text-xs text-muted-foreground">
        <h2 className="font-medium text-foreground">Shoot locations</h2>
        <span>{mapped.length} of {visits.length} visits mapped</span>
      </div>
      {points.length ? (
        <Map center={points[0]} zoom={11} className="relative z-0 h-[380px] w-full overflow-hidden rounded-lg sm:h-[480px]">
          <FitLocations points={points} />
          <MapControls />
          {mapped.map(({ slot, point }) => {
            const shootId = slot.shoot_id ?? slot.shootDetails?.id;
            return (
              <Marker key={`${slot.photographerId}:${slot.date}:${slot.id}`} position={point}>
                <strong>{personName(slot.photographerId)}</strong>
                <p>{slot.shootDetails?.address || "Scheduled shoot"}</p>
                <p>{formatAvailabilityDate(slot.date, "MMM d")} · {formatTime(slot.startTime)}–{formatTime(slot.endTime)}</p>
                {shootId && <Button size="sm" variant="outline" onClick={() => onShoot(shootId)}>Open shoot</Button>}
              </Marker>
            );
          })}
        </Map>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg bg-muted/40 px-6 text-center">
          <MapPin className="mb-1 h-7 w-7 text-muted-foreground" />
          <h3 className="text-sm font-medium">No mapped shoots in this period</h3>
          <p className="max-w-xs text-xs text-muted-foreground">Choose another date or photographer. Scheduled properties appear here when their location is available.</p>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {visits.map(slot => {
          const shootId = slot.shoot_id ?? slot.shootDetails?.id;
          return (
            <button key={`${slot.photographerId}:${slot.date}:${slot.id}`} type="button" disabled={!shootId} onClick={() => shootId && onShoot(shootId)} className="rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default">
              <span className="block text-sm font-medium">{personName(slot.photographerId)}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{formatAvailabilityDate(slot.date, "MMM d")} · {formatTime(slot.startTime)}–{formatTime(slot.endTime)}</span>
              <span className="mt-1 block break-words text-xs">{slot.shootDetails?.address || "Address unavailable"}</span>
              {!coordinates(slot) && <span className="mt-1 block text-xs text-muted-foreground">Location unavailable</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
