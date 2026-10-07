import { format } from "date-fns";
import { calendarDay } from "@/lib/date";
import type { BackendSlot } from "@/types/availability";

/** Keep availability dates as YYYY-MM-DD so UTC midnight never becomes the previous local day. */
export const normalizeAvailabilityDate = (value?: string | null): string | null => {
  if (value == null) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value).trim());
  return match ? match[1] : null;
};

export const formatAvailabilityDate = (value: string, pattern: string): string => {
  const day = calendarDay(value);
  if (Number.isNaN(day.getTime())) return "";
  return format(day, pattern);
};

export const availabilityWeekday = (value: string): string => {
  const day = calendarDay(value);
  if (Number.isNaN(day.getTime())) return "";
  return day.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
};

export const availabilityDateButtonClass =
  "w-full justify-start text-left font-normal rounded-md border-input bg-background dark:border-white/10 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900";

export const availabilityDatePopoverClass =
  "z-[90] w-auto p-0 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl dark:border-white/10 dark:bg-slate-950";

export const dayViewStartHour = 8;
export const dayViewEndHour = 21;
export const dayViewHourCount = dayViewEndHour - dayViewStartHour;
export const dayViewTotalMinutes = (dayViewEndHour - dayViewStartHour) * 60;
export const weekViewLabelHours = [8, 10, 12, 14, 16, 18, 20];
export const weekViewEndHour = 21;
export const weekViewEndLabel = "9:00 PM";

export const normalizePhotographerNumericId = (id: string) => {
  const parsed = Number(id);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return Math.abs(
    id.split('').reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0)
  );
};

export const mapBackendSlots = (
  data: readonly unknown[] | null | undefined,
  photographerId: string
): BackendSlot[] => {
  const normalizedId = normalizePhotographerNumericId(photographerId);
  return (data || []).map((raw, index) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const rawId = row.id;
    const id =
      typeof rawId === "number" || typeof rawId === "string"
        ? rawId
        : `${normalizedId}-${row.shoot_id ?? 'slot'}-${row.date ?? row.day_of_week ?? ''}-${row.start_time ?? ''}-${row.end_time ?? ''}-${index}`;
    const photographerIdValue =
      typeof row.photographer_id === "number"
        ? row.photographer_id
        : Number(row.photographer_id ?? normalizedId) || normalizedId;
    return {
      id,
      photographer_id: photographerIdValue,
      date: normalizeAvailabilityDate((row.date as string | null | undefined) ?? null),
      day_of_week: (row.day_of_week as string | null | undefined) ?? null,
      start_time: String(row.start_time ?? ""),
      end_time: String(row.end_time ?? ""),
      status: row.status as string | undefined,
      isRandom: Boolean(row.isRandom),
      shoot_id: row.shoot_id != null && Number.isFinite(Number(row.shoot_id)) ? Number(row.shoot_id) : (row.shoot_details as BackendSlot['shoot_details'])?.id,
      shoot_details: row.shoot_details as BackendSlot['shoot_details'],
    };
  });
};

/** One card per exact booked visit, retaining richer authorized detail responses. */
export const mergeBookedSlots = (rows: readonly BackendSlot[]): BackendSlot[] => {
  const result: BackendSlot[] = [];
  for (const row of rows) {
    if (row.status !== 'booked') { result.push(row); continue; }
    const shootId = row.shoot_id ?? row.shoot_details?.id;
    const existing = result.findIndex((slot) => slot.status === 'booked'
      && slot.photographer_id === row.photographer_id
      && normalizeAvailabilityDate(slot.date) === normalizeAvailabilityDate(row.date)
      && slot.start_time.slice(0, 5) === row.start_time.slice(0, 5)
      && slot.end_time.slice(0, 5) === row.end_time.slice(0, 5)
      && (shootId != null ? (slot.shoot_id ?? slot.shoot_details?.id) === shootId : slot.id === row.id));
    if (existing < 0) { result.push(row); continue; }
    const previous = result[existing];
    result[existing] = {
      ...previous, ...row, id: previous.id,
      shoot_id: shootId ?? previous.shoot_id,
      shoot_details: previous.shoot_details || row.shoot_details ? {
        ...previous.shoot_details, ...Object.fromEntries(Object.entries(row.shoot_details ?? {}).filter(([, value]) => value != null && value !== '')),
        client: row.shoot_details?.client && previous.shoot_details?.client ? { ...previous.shoot_details.client, ...Object.fromEntries(Object.entries(row.shoot_details.client).filter(([, value]) => value != null && value !== '')) } : row.shoot_details?.client ?? previous.shoot_details?.client,
        services: [...new Map([...(previous.shoot_details?.services ?? []), ...(row.shoot_details?.services ?? [])].map(service => [service.id, service])).values()],
      } as BackendSlot['shoot_details'] : undefined,
    };
  }
  return result;
};

export const uiTimeToHhmm = (t?: string): string => {
  if (!t) return "";
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":");
    return `${String(parseInt(h, 10)).padStart(2, '0')}:${m}`;
  }
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return t;
  let hh = parseInt(m[1], 10);
  const mm = m[2];
  const mer = m[3].toUpperCase();
  if (mer === 'PM' && hh !== 12) hh += 12;
  if (mer === 'AM' && hh === 12) hh = 0;
  return `${String(hh).padStart(2, '0')}:${mm}`;
};

export const toHhMm = (t?: string) => {
  if (!t) return '';
  if (t.includes('AM') || t.includes('PM')) {
    const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const period = match[3].toUpperCase();
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${minutes}`;
    }
  }
  return t.slice(0, 5);
};

export { getInitials } from "@/lib/utils";
