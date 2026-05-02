import { format, isValid, parseISO } from 'date-fns';

export const formatDateForWallClockInput = (value?: unknown): string => {
  if (!value) return '';

  const stringValue = String(value).trim();
  const dateOnlyMatch = stringValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnlyMatch) return dateOnlyMatch[1];

  const parsed = parseISO(stringValue);
  return isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : '';
};

export const formatTimeForWallClockInput = (value?: unknown): string => {
  if (!value) return '';

  const stringValue = String(value).trim();
  const timeMatch = stringValue.match(/[T\s](\d{1,2}):(\d{2})(?::\d{2})?/);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  const parsed = parseISO(stringValue);
  return isValid(parsed) ? format(parsed, 'HH:mm') : '';
};

export const buildWallClockIso = (dateValue?: string, timeValue?: string): string | null => {
  if (!dateValue) return null;

  const dateMatch = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return null;

  const timeMatch = (timeValue || '10:00').match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  const hours = timeMatch ? Number(timeMatch[1]) : 10;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${dateMatch[1]}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
};
