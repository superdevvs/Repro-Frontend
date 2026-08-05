import type { EditingJob } from '@/services/autoenhanceService';
import type { StudioShootRef } from '@/components/studio/types';

export interface ShootWithEditing {
  id: number;
  address: string;
  status: string;
  workflowStatus?: string;
  photo_count?: number;
  raw_photo_count?: number;
  edited_photo_count?: number;
  client_name?: string;
  created_at: string;
  thumbnail?: string | null;
  auto_edit_enabled?: boolean;
}

export interface MediaFile {
  id: number;
  filename: string;
  url?: string;
  path?: string;
  thumb_url?: string;
  medium_url?: string;
  large_url?: string;
  original_url?: string;
  fileType?: string;
  workflowStage?: string;
  created_at?: string;
  isEdited?: boolean;
  isAiEdited?: boolean;
}

export interface AttachedImage {
  id: string;
  file: File;
  previewUrl: string;
}

export type ViewMode = 'activity' | 'chat' | 'select-shoot' | 'select-files' | 'configure';
export type WorkspaceMode = 'photo' | 'video' | 'chat';
export type JobStatus = EditingJob['status'];
export type StatusFilter = 'all' | JobStatus;
export type EnhancementModeId = 'enhance' | 'sky_replace' | 'vertical_correction' | 'window_pull';
export type StudioSubtab = 'studio' | 'photo' | 'video';
export type PhotoCapability = 'workspace' | 'batch';
export type VideoCapability = 'listing' | 'cleanup' | 'reel';

export interface RouteTarget {
  subtab: StudioSubtab;
  photoMode?: EnhancementModeId;
  photoCapability?: PhotoCapability;
  videoCapability?: VideoCapability;
  shoot?: StudioShootRef;
}

export const editingTypeLabels: Record<string, string> = {
  enhance: 'Enhance',
  enhance_custom: 'Custom Autoenhance',
  sky_replace: 'Sky Replacement',
  hdr_merge: 'HDR Bracket Merge',
  vertical_correction: 'Vertical Correction',
  window_pull: 'Window Pull',
};

export const STEPPER_STEPS = [
  { id: 'select-shoot', label: 'Shoot', description: 'Pick a property' },
  { id: 'select-files', label: 'Photos', description: 'Choose source images' },
  { id: 'configure', label: 'Configure', description: 'Mode, options & submit' },
];

export const MAX_BATCH_SIZE = 100;
export const COMBINABLE_MODE_IDS = new Set<string>([
  'enhance',
  'sky_replace',
  'vertical_correction',
  'window_pull',
]);
export const UNSUPPORTED_MODE_IDS = new Set<string>(['hdr_merge']);

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valueAt(record: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function stringAt(record: UnknownRecord, keys: string[]): string | undefined {
  const value = valueAt(record, keys);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberAt(record: UnknownRecord, keys: string[]): number | undefined {
  const value = valueAt(record, keys);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function recordAt(record: UnknownRecord, key: string): UnknownRecord | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

function responseItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  return Array.isArray(payload.data) ? payload.data : [];
}

export function normalizeShoots(payloads: unknown[]): ShootWithEditing[] {
  const shootsById = new Map<number, ShootWithEditing>();

  payloads.flatMap(responseItems).forEach((value) => {
    if (!isRecord(value)) return;
    const id = numberAt(value, ['id']);
    if (id === undefined) return;

    const client = recordAt(value, 'client');
    const user = recordAt(value, 'user');
    const files = value.files;
    const previewImages = value.preview_images;
    const workflowStatus = stringAt(value, ['workflowStatus', 'workflow_status', 'status']);
    const status = stringAt(value, ['status']) || 'pending';

    shootsById.set(id, {
      id,
      address: stringAt(value, ['address']) || `Shoot #${id}`,
      status,
      workflowStatus,
      photo_count:
        numberAt(value, ['photo_count', 'photoCount', 'files_count'])
        ?? (Array.isArray(files) ? files.length : 0),
      raw_photo_count: numberAt(value, ['raw_photo_count', 'rawPhotoCount']),
      edited_photo_count: numberAt(value, ['edited_photo_count', 'editedPhotoCount']),
      client_name:
        (client ? stringAt(client, ['name']) : undefined)
        || stringAt(value, ['client_name'])
        || (user ? stringAt(user, ['name']) : undefined),
      created_at: stringAt(value, ['created_at', 'createdAt']) || new Date().toISOString(),
      thumbnail:
        stringAt(value, ['thumbnail', 'hero_image', 'heroImage', 'cover_image'])
        || (Array.isArray(previewImages) && typeof previewImages[0] === 'string' ? previewImages[0] : null),
      auto_edit_enabled: value.auto_edit_enabled === true,
    });
  });

  return Array.from(shootsById.values()).sort(
    (first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
  );
}

const ALLOWED_MEDIA_EXTENSION = /\.(jpg|jpeg|png|gif|webp|tiff|tif|heic|heif|nef|cr2|cr3|crw|arw|dng|raf|orf|rw2|nrw|sr2|srf|pef|x3f|3fr|fff|iiq|mrw|mef|kdc|dcr|erf|nrw|rwl)$/i;

export function normalizeMediaFiles(payloads: unknown[]): MediaFile[] {
  const filesById = new Map<number, MediaFile>();

  payloads.forEach((payload, payloadIndex) => {
    responseItems(payload).forEach((value) => {
      if (!isRecord(value)) return;
      const filename = stringAt(value, ['filename', 'stored_filename']) || '';
      if (!ALLOWED_MEDIA_EXTENSION.test(filename)) return;

      const id = numberAt(value, ['id']);
      if (id === undefined || (filesById.has(id) && payloadIndex === 1)) return;

      const stage = (stringAt(value, ['workflow_stage', 'workflowStage']) || '').toLowerCase();
      const mediaType = (stringAt(value, ['media_type', 'mediaType']) || '').toLowerCase();
      const isAiEdited = value.is_ai_edited === true;
      const isEdited =
        isAiEdited
        || mediaType === 'edited'
        || mediaType === 'final'
        || stage === 'completed'
        || stage === 'edited';

      filesById.set(id, {
        id,
        filename: filename || `file-${id}`,
        url: stringAt(value, ['url']),
        path: stringAt(value, ['path']),
        thumb_url: stringAt(value, ['thumb_url', 'thumb', 'thumbnail_url']),
        medium_url: stringAt(value, ['medium_url', 'medium', 'web_url']),
        large_url: stringAt(value, ['large_url', 'large', 'original_url']),
        original_url: stringAt(value, ['original_url', 'original']),
        fileType: stringAt(value, ['fileType', 'file_type']),
        workflowStage: stage,
        created_at: stringAt(value, ['created_at', 'createdAt']),
        isEdited,
        isAiEdited,
      });
    });
  });

  return Array.from(filesById.values());
}

export function getApiErrorMessage(
  error: unknown,
  fallback: string,
  responseKeys: string[] = ['message'],
): string {
  if (!isRecord(error)) return fallback;
  const response = recordAt(error, 'response');
  const data = response ? recordAt(response, 'data') : undefined;
  if (data) {
    const responseMessage = stringAt(data, responseKeys);
    if (responseMessage) return responseMessage;
  }
  return stringAt(error, ['message']) || fallback;
}
