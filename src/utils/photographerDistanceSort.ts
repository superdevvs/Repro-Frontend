/** Only finite non-negative mileage is sortable; failed/empty results are unknown. */
export const photographerDistanceMiles = (value: unknown): number | undefined => {
  if (value == null || (typeof value === 'string' && value.trim() === '') || typeof value === 'boolean') return undefined;
  const miles = Number(value);
  return Number.isFinite(miles) && miles >= 0 ? miles : undefined;
};

export const comparePhotographerDistance = (
  first: { name: string; distance?: unknown },
  second: { name: string; distance?: unknown },
): number => {
  const a = photographerDistanceMiles(first.distance);
  const b = photographerDistanceMiles(second.distance);
  if (a === undefined && b !== undefined) return 1;
  if (b === undefined && a !== undefined) return -1;
  if (a !== undefined && b !== undefined && a !== b) return a - b;
  return first.name.localeCompare(second.name);
};
