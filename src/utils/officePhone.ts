/** Client office phone, separate from the personal phone number. */

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? value as Record<string, unknown> : null;

const text = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

export function readOfficePhone(source: unknown): string {
  const record = asRecord(source);
  if (!record) return '';
  return text(record.office_phone ?? record.officePhone);
}

export function hasShowOfficePhoneFlag(source: unknown): boolean {
  const record = asRecord(source);
  if (!record) return false;
  return 'show_office_phone_on_tour' in record || 'showOfficePhoneOnTour' in record;
}

/** Omitted flag defaults to shown. The API applies that default when a number is saved. */
export function readShowOfficePhoneOnTour(source: unknown): boolean {
  const record = asRecord(source);
  if (!record || !hasShowOfficePhoneFlag(record)) return true;
  const raw = record.show_office_phone_on_tour ?? record.showOfficePhoneOnTour;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  }
  return true;
}

export function telHref(phone: string): string {
  const compact = phone.replace(/[^\d+]/g, '');
  return `tel:${compact || phone.trim()}`;
}

/**
 * Branded-tour public payloads include office_phone only when a number is
 * present and the tour flag is true. Hide it if a payload still carries an
 * explicit false flag.
 */
export function brandedTourOfficePhone(source: unknown): string {
  const phone = readOfficePhone(source);
  if (!phone) return '';
  if (hasShowOfficePhoneFlag(source) && !readShowOfficePhoneOnTour(source)) return '';
  return phone;
}
