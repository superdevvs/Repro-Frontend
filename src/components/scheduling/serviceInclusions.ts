export type UploadIntakeType = 'none' | 'photo' | 'video' | 'photo_video';

export interface ServiceInclusion {
  name: string;
  upload_intake_type: UploadIntakeType;
  uses_hdr_brackets: boolean;
}

export const INCLUSION_PRESETS: ServiceInclusion[] = [
  { name: 'HDR Photos', upload_intake_type: 'photo', uses_hdr_brackets: true },
  { name: 'Basic Social Video', upload_intake_type: 'video', uses_hdr_brackets: false },
  { name: 'Zillow 3D with Floor Plans', upload_intake_type: 'none', uses_hdr_brackets: false },
  { name: 'Matterport Tour', upload_intake_type: 'none', uses_hdr_brackets: false },
  { name: 'iGuide Tour', upload_intake_type: 'none', uses_hdr_brackets: false },
  { name: 'Floor Plans', upload_intake_type: 'none', uses_hdr_brackets: false },
];

export const UPLOAD_LABELS: Record<UploadIntakeType, string> = {
  none: 'No photos or videos', photo: 'Photos', video: 'Videos', photo_video: 'Photos and videos',
};

export function normalizeInclusions(value: unknown): ServiceInclusion[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.name !== 'string' || !Object.hasOwn(UPLOAD_LABELS, String(row.upload_intake_type))) return [];
    return [{ name: row.name, upload_intake_type: row.upload_intake_type as UploadIntakeType, uses_hdr_brackets: row.uses_hdr_brackets === true }];
  });
}

export function inclusionCapabilities(components: ServiceInclusion[]) {
  const photo = components.some(c => c.upload_intake_type === 'photo' || c.upload_intake_type === 'photo_video');
  const video = components.some(c => c.upload_intake_type === 'video' || c.upload_intake_type === 'photo_video');
  const upload_intake_type: UploadIntakeType = photo ? (video ? 'photo_video' : 'photo') : (video ? 'video' : 'none');
  return { upload_intake_type, uses_hdr_brackets: photo && components.some(c => c.uses_hdr_brackets && ['photo', 'photo_video'].includes(c.upload_intake_type)) };
}

export function inclusionError(components?: ServiceInclusion[] | null): string | null {
  if (!components) return null;
  const names = components.map(c => c.name.trim().toLowerCase());
  if (names.some(name => !name)) return 'Name each included service or remove the empty row.';
  if (new Set(names).size !== names.length) return 'Use a different name for each included service.';
  return null;
}
