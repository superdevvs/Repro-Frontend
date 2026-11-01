/** Display North American numbers consistently without truncating other formats. */
export const formatTourPhoneNumber = (value?: string | null): string => {
  const raw = value?.trim() || '';
  if (!raw || !/^[+\d\s().-]+$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  const hasCountryCode = digits.length === 11 && digits.startsWith('1');
  if (!hasCountryCode && (digits.length !== 10 || raw.startsWith('+'))) return raw;
  const local = hasCountryCode ? digits.slice(1) : digits;
  return `${hasCountryCode ? '+1 ' : ''}(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
};

export const formatTourPrice = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';

  const raw = String(value).trim();
  if (!raw) return '';

  const hasCurrencySymbol = /^[$€£]/.test(raw);
  const numericValue = raw.replace(/[$,]/g, '').trim();

  if (!numericValue || Number.isNaN(Number(numericValue))) {
    return hasCurrencySymbol || !/^\d/.test(raw) ? raw : `$${raw}`;
  }

  return `$${Number(numericValue).toLocaleString()}`;
};

export const normalizeTourDescription = (description: unknown): string => {
  if (description === null || description === undefined) return '';
  return String(description).trim();
};
