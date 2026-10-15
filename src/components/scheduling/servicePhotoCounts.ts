type PhotoCountService = {
  category?: string | null;
  upload_intake_type?: string | null;
  photo_count?: number | null;
  pricing_type?: string;
  sqft_ranges?: ReadonlyArray<{ photo_count?: number | null }>;
};

const positiveCount = (value?: number | null) => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Catalog fields are independent of a booking's quantity or upload permissions. */
export function serviceUsesPhotoCounts(service: PhotoCountService): boolean {
  return ['photo', 'photo_video'].includes(service.upload_intake_type ?? '')
    || positiveCount(service.photo_count)
    || Boolean(service.sqft_ranges?.some(range => positiveCount(range.photo_count)))
    || /photo|\bpackages?\b|\bbundles?\b/i.test(service.category ?? '');
}

export function servicePhotoCountLabel(service: PhotoCountService): string | null {
  const ranges = service.sqft_ranges ?? [];
  if (service.pricing_type === 'variable' && ranges.length) {
    if (!ranges.every(range => positiveCount(range.photo_count))) return null;
    const counts = ranges.map(range => range.photo_count as number);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    return min === max ? String(min) : `${min}–${max}`;
  }
  return positiveCount(service.photo_count) ? String(service.photo_count) : null;
}
