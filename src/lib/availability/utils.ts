import type { BackendSlot } from "@/types/availability";

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

const randomIdSuffix = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const mapBackendSlots = (
  data: readonly unknown[] | null | undefined,
  photographerId: string
): BackendSlot[] => {
  const normalizedId = normalizePhotographerNumericId(photographerId);
  return (data || []).map((raw, index) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const rawId = row.id;
    const id =
      typeof rawId === "number"
        ? rawId
        : Number(`${normalizedId}${index}${randomIdSuffix(100, 999)}`);
    const photographerIdValue =
      typeof row.photographer_id === "number"
        ? row.photographer_id
        : Number(row.photographer_id ?? normalizedId) || normalizedId;
    return {
      id,
      photographer_id: photographerIdValue,
      date: (row.date as string | null | undefined) ?? null,
      day_of_week: (row.day_of_week as string | null | undefined) ?? null,
      start_time: String(row.start_time ?? ""),
      end_time: String(row.end_time ?? ""),
      status: row.status as string | undefined,
    };
  });
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

export const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};
