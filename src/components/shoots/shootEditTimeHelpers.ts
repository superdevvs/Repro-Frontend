import { formatTimeForDisplay } from '@/utils/availabilityUtils';

export const buildTimeOptions = (ensure?: string | null) => {
  const options: { value: string; label: string }[] = [];
  for (let hours = 8; hours <= 19; hours++) {
    for (let minutes = 0; minutes < 60; minutes += 5) {
      if (hours === 19 && minutes !== 0) continue;
      const value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      options.push({ value, label: formatTimeForDisplay(value) });
    }
  }
  if (ensure && !options.some((option) => option.value === ensure)) {
    const [hours, minutes] = ensure.split(':').map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      options.push({ value: ensure, label: formatTimeForDisplay(ensure) });
      options.sort((left, right) => left.value.localeCompare(right.value));
    }
  }
  return options;
};

export const normalizeTimeValue = (raw?: string | null): string | null => {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  const ampmMatch = value.match(/^(\d{1,2}):(\d{2})\s*([APap][Mm])$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const suffix = ampmMatch[3].toLowerCase();
    if (suffix === 'pm' && hours !== 12) hours += 12;
    if (suffix === 'am' && hours === 12) hours = 0;
    if (minutes >= 0 && minutes < 60 && hours >= 0 && hours < 24) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }
  const hhmmMatch = value.match(/^(\d{1,2}):(\d{2})(:\d{2})?$/);
  if (hhmmMatch) {
    const hours = parseInt(hhmmMatch[1], 10);
    const minutes = parseInt(hhmmMatch[2], 10);
    if (minutes >= 0 && minutes < 60 && hours >= 0 && hours < 24) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }
  return null;
};
