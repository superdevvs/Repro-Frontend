import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import { getImpersonatedUserId } from '@/services/api';

const getToken = (sessionToken?: string | null) => {
  const localToken =
    (typeof window !== 'undefined' && (localStorage.getItem('authToken') || localStorage.getItem('token'))) ||
    null;
  return localToken || sessionToken || undefined;
};

export interface MediaFile {
  id: string;
  shoot_id?: string | number;
  shoot_service_id?: string | number | null;
  shootServiceId?: string | number | null;
  filename: string;
  url?: string;
  path?: string;
  fileType?: string;
  workflowStage?: string;
  isExtra?: boolean;
  // Image size URLs from backend
  thumb?: string;
  thumb_url?: string;
  thumbnail_url?: string;
  /** ~1000px rendition used for desktop grid tiles. */
  grid_url?: string;
  medium?: string;
  medium_url?: string;
  large?: string;
  large_url?: string;
  original?: string;
  original_url?: string;
  web_url?: string;
  placeholder_url?: string;
  preview_images?: string[];
  previewImages?: string[];
  // Processed image paths (for RAW files)
  thumbnail_path?: string;
  web_path?: string;
  placeholder_path?: string;
  // Watermarked size paths (for unpaid client views)
  watermarked_storage_path?: string;
  watermarked_thumbnail_path?: string;
  watermarked_web_path?: string;
  watermarked_placeholder_path?: string;
  uses_watermark?: boolean;
  processed_at?: string;
  media_type?: string;
  // Size info
  width?: number;
  height?: number;
  fileSize?: number;
  // Metadata for grouping
  captured_at?: string;
  created_at?: string;
  bracket_group?: number;
  sequence?: number;
  is_cover?: boolean;
  is_favorite?: boolean;
  is_hidden?: boolean;
  sort_order?: number;
  comments?: Array<{
    author?: string | null;
    comment: string;
    timestamp?: string | null;
  }>;
  comment_count?: number;
  latest_comment?: {
    author?: string | null;
    comment: string;
    timestamp?: string | null;
  } | null;
  // Virus-scan state machine (Req 14/15). The backend exposes the canonical
  // `scan_status` string on every shoot-file payload so the admin Dashboard
  // can render a scan-status badge (Req 15.5) and gate the retry control
  // (Req 15.8). The frontend maps `quarantined` → "scanning" for display.
  scan_status?: ScanStatus | null;
  scanStatus?: ScanStatus | null;
  // AI editing provenance (fal.ai / Autoenhance results created from the AI
  // Editing workspace) so media cards can render an "AI" tag.
  is_ai_edited?: boolean;
  isAiEdited?: boolean;
  ai_editing_job_id?: number | string | null;
  aiEditingJobId?: number | string | null;
  ai_editing_metadata?: Record<string, unknown> | null;
  aiEditingMetadata?: Record<string, unknown> | null;
  media_state?: string;
  media_error?: string;
}

export type ScanStatus = 'quarantined' | 'clean' | 'infected' | 'failed';

const SCAN_STATUSES: ReadonlySet<ScanStatus> = new Set([
  'quarantined',
  'clean',
  'infected',
  'failed',
]);

const normalizeScanStatus = (value: unknown): ScanStatus | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const lower = value.toLowerCase();
  return SCAN_STATUSES.has(lower as ScanStatus) ? (lower as ScanStatus) : null;
};

type ShootMediaPayload = Omit<Partial<MediaFile>, 'id' | 'filename'> & {
  id?: string | number;
  filename?: string;
  stored_filename?: string;
  shootId?: string | number;
  file_type?: string;
  workflow_stage?: string;
  is_extra?: boolean | number;
  usesWatermark?: boolean;
  file_size?: number;
};

const isMediaPayloadRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const extractMediaPayloads = (json: unknown): Record<string, unknown>[] => {
  const candidate = isMediaPayloadRecord(json) && Array.isArray(json.data) ? json.data : json;
  return Array.isArray(candidate) ? candidate.filter(isMediaPayloadRecord) : [];
};

export const normalizeShootMediaFile = (payload: Record<string, unknown>): MediaFile => {
  const value = payload as ShootMediaPayload;
  return ({
  id: String(value.id),
  shoot_id: value.shoot_id ?? value.shootId,
  shoot_service_id: value.shoot_service_id ?? value.shootServiceId ?? null,
  shootServiceId: value.shootServiceId ?? value.shoot_service_id ?? null,
  filename: value.filename || value.stored_filename || 'unknown',
  url: value.url || value.path,
  path: value.path,
  fileType: value.file_type || value.fileType,
  workflowStage: value.workflow_stage || value.workflowStage,
  isExtra: Boolean(value.is_extra ?? value.isExtra),
  thumb: value.thumb_url || value.thumb,
  thumb_url: value.thumb_url,
  thumbnail_url: value.thumbnail_url,
  grid_url: value.grid_url,
  medium: value.medium_url || value.medium,
  medium_url: value.medium_url,
  large: value.large_url || value.large,
  large_url: value.large_url,
  original: value.original_url || value.original || value.url || value.path,
  original_url: value.original_url,
  web_url: value.web_url,
  placeholder_url: value.placeholder_url,
  preview_images: Array.isArray(value.preview_images) ? value.preview_images.filter(Boolean) : [],
  previewImages: Array.isArray(value.previewImages ?? value.preview_images)
    ? (value.previewImages ?? value.preview_images).filter(Boolean)
    : [],
  thumbnail_path: value.thumbnail_path,
  web_path: value.web_path,
  placeholder_path: value.placeholder_path,
  watermarked_storage_path: value.watermarked_storage_path,
  watermarked_thumbnail_path: value.watermarked_thumbnail_path,
  watermarked_web_path: value.watermarked_web_path,
  watermarked_placeholder_path: value.watermarked_placeholder_path,
  uses_watermark: Boolean(value.uses_watermark ?? value.usesWatermark),
  processed_at: value.processed_at,
  media_type: value.media_type,
  width: value.width,
  height: value.height,
  fileSize: value.file_size ?? value.fileSize,
  captured_at: value.captured_at,
  created_at: value.created_at,
  bracket_group: value.bracket_group,
  sequence: value.sequence,
  is_cover: Boolean(value.is_cover),
  is_favorite: Boolean(value.is_favorite),
  is_hidden: Boolean(value.is_hidden),
  sort_order: value.sort_order ?? 0,
  comments: Array.isArray(value.comments) ? value.comments : [],
  comment_count: Number(value.comment_count ?? 0),
  latest_comment: value.latest_comment ?? null,
  scan_status: normalizeScanStatus(value.scan_status ?? value.scanStatus),
  scanStatus: normalizeScanStatus(value.scan_status ?? value.scanStatus),
  is_ai_edited: Boolean(value.is_ai_edited ?? value.isAiEdited),
  isAiEdited: Boolean(value.isAiEdited ?? value.is_ai_edited),
  ai_editing_job_id: value.ai_editing_job_id ?? value.aiEditingJobId ?? null,
  aiEditingJobId: value.aiEditingJobId ?? value.ai_editing_job_id ?? null,
  ai_editing_metadata: value.ai_editing_metadata ?? value.aiEditingMetadata ?? null,
  aiEditingMetadata: value.aiEditingMetadata ?? value.ai_editing_metadata ?? null,
  media_state: value.media_state,
    media_error: value.media_error,
  });
};

export const mergeAcceptedShootFiles = (
  queryClient: QueryClient,
  shootId: string | number,
  type: 'raw' | 'edited',
  files: MediaFile[],
) => {
  if (files.length === 0) return;

  queryClient.setQueriesData<MediaFile[]>({
    predicate: (query) =>
      query.queryKey[0] === 'shootFiles'
      && String(query.queryKey[1]) === String(shootId)
      && (query.queryKey[2] === type || query.queryKey[2] === 'all'),
  }, (current = []) => {
    const acceptedIds = new Set(files.map((file) => String(file.id)));
    return [...files, ...current.filter((file) => !acceptedIds.has(String(file.id)))];
  });
};

const fetchShootFiles = async (
  shootId: string | number,
  type: 'raw' | 'edited' | 'all',
  token?: string
): Promise<MediaFile[]> => {
  const authToken = token || getToken();
  if (!authToken) {
    throw new Error('Missing auth token');
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${authToken}`,
    'Accept': 'application/json',
  };
  
  // Add impersonation header if impersonating
  const impersonatedUserId = getImpersonatedUserId();
  if (impersonatedUserId) {
    headers['X-Impersonate-User-Id'] = impersonatedUserId;
    console.log('[useShootFiles] Impersonation header added:', impersonatedUserId);
  }

  if (type === 'all') {
    // Fetch both types in parallel
    const [rawRes, editedRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/shoots/${shootId}/files?type=raw`, { headers }),
      fetch(`${API_BASE_URL}/api/shoots/${shootId}/files?type=edited`, { headers }),
    ]);

    const rawJson = rawRes.ok ? await rawRes.json() : { data: [] };
    const editedJson = editedRes.ok ? await editedRes.json() : { data: [] };

    const mapFiles = (json: unknown): MediaFile[] =>
      extractMediaPayloads(json).map(normalizeShootMediaFile);

    return [...mapFiles(rawJson), ...mapFiles(editedJson)];
  } else {
    const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files?type=${type}`, { headers });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to load ${type} files`);
    }

    const json: unknown = res.ok ? await res.json() : { data: [] };
    return extractMediaPayloads(json).map(normalizeShootMediaFile);
  }
};

export const useShootFiles = (
  shootId: string | number | null | undefined,
  type: 'raw' | 'edited' | 'all' = 'all',
  options?: { enabled?: boolean; cacheKey?: string | number | null }
) => {
  const { session, user, isImpersonating } = useAuth();
  
  // Include impersonated user ID in query key to ensure cache is user-specific
  const impersonatedUserId = getImpersonatedUserId();

  return useQuery({
    queryKey: ['shootFiles', shootId, type, impersonatedUserId, isImpersonating ? user?.id : null, options?.cacheKey ?? null],
    queryFn: () => fetchShootFiles(shootId!, type, getToken(session?.accessToken)),
    enabled: Boolean(shootId) && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

