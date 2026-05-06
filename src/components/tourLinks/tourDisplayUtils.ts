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
