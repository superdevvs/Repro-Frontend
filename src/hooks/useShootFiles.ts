import { useQuery } from '@tanstack/react-query';
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
  medium?: string;
  medium_url?: string;
  large?: string;
  large_url?: string;
  original?: string;
  original_url?: string;
  web_url?: string;
  placeholder_url?: string;
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
}

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

    const mapFiles = (json: any): MediaFile[] =>
      (json?.data || json || []).map((f: any) => ({
        id: String(f.id),
        shoot_id: f.shoot_id ?? f.shootId,
        shoot_service_id: f.shoot_service_id ?? f.shootServiceId ?? null,
        shootServiceId: f.shootServiceId ?? f.shoot_service_id ?? null,
        filename: f.filename || f.stored_filename,
        url: f.url || f.path,
        path: f.path,
        fileType: f.file_type || f.fileType,
        workflowStage: f.workflow_stage || f.workflowStage,
        isExtra: f.is_extra || false,
        thumb: f.thumb_url || f.thumb,
        thumb_url: f.thumb_url,
        thumbnail_url: f.thumbnail_url,
        medium: f.medium_url || f.medium,
        medium_url: f.medium_url,
        large: f.large_url || f.large,
        large_url: f.large_url,
        original: f.original_url || f.original || f.url || f.path,
        original_url: f.original_url,
        web_url: f.web_url,
        placeholder_url: f.placeholder_url,
        thumbnail_path: f.thumbnail_path,
        web_path: f.web_path,
        placeholder_path: f.placeholder_path,
        watermarked_storage_path: f.watermarked_storage_path,
        watermarked_thumbnail_path: f.watermarked_thumbnail_path,
        watermarked_web_path: f.watermarked_web_path,
        watermarked_placeholder_path: f.watermarked_placeholder_path,
        uses_watermark: Boolean(f.uses_watermark ?? f.usesWatermark),
        processed_at: f.processed_at,
        media_type: f.media_type,
        width: f.width,
        height: f.height,
        fileSize: f.file_size || f.fileSize,
        captured_at: f.captured_at,
        created_at: f.created_at,
        bracket_group: f.bracket_group,
        sequence: f.sequence,
        is_cover: f.is_cover || false,
        is_favorite: f.is_favorite || false,
        is_hidden: f.is_hidden || false,
        sort_order: f.sort_order ?? 0,
        comments: Array.isArray(f.comments) ? f.comments : [],
        comment_count: Number(f.comment_count ?? 0),
        latest_comment: f.latest_comment ?? null,
      }));

    return [...mapFiles(rawJson), ...mapFiles(editedJson)];
  } else {
    const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files?type=${type}`, { headers });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to load ${type} files`);
    }

    const json = res.ok ? await res.json() : { data: [] };
    return (json?.data || json || []).map((f: any) => ({
      id: String(f.id),
      shoot_id: f.shoot_id ?? f.shootId,
      shoot_service_id: f.shoot_service_id ?? f.shootServiceId ?? null,
      shootServiceId: f.shootServiceId ?? f.shoot_service_id ?? null,
      filename: f.filename || f.stored_filename,
      url: f.url || f.path,
      path: f.path,
      fileType: f.file_type || f.fileType,
      workflowStage: f.workflow_stage || f.workflowStage,
      isExtra: f.is_extra || false,
      thumb: f.thumb_url || f.thumb,
      thumb_url: f.thumb_url,
      thumbnail_url: f.thumbnail_url,
      medium: f.medium_url || f.medium,
      medium_url: f.medium_url,
      large: f.large_url || f.large,
      large_url: f.large_url,
      original: f.original_url || f.original || f.url || f.path,
      original_url: f.original_url,
      web_url: f.web_url,
      placeholder_url: f.placeholder_url,
      thumbnail_path: f.thumbnail_path,
      web_path: f.web_path,
      placeholder_path: f.placeholder_path,
      watermarked_storage_path: f.watermarked_storage_path,
      watermarked_thumbnail_path: f.watermarked_thumbnail_path,
      watermarked_web_path: f.watermarked_web_path,
      watermarked_placeholder_path: f.watermarked_placeholder_path,
      uses_watermark: Boolean(f.uses_watermark ?? f.usesWatermark),
      processed_at: f.processed_at,
      media_type: f.media_type,
      width: f.width,
      height: f.height,
      fileSize: f.file_size || f.fileSize,
      captured_at: f.captured_at,
      created_at: f.created_at,
      bracket_group: f.bracket_group,
      sequence: f.sequence,
      is_cover: f.is_cover || false,
      is_favorite: f.is_favorite || false,
      is_hidden: f.is_hidden || false,
      sort_order: f.sort_order ?? 0,
      comments: Array.isArray(f.comments) ? f.comments : [],
      comment_count: Number(f.comment_count ?? 0),
      latest_comment: f.latest_comment ?? null,
    }));
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
