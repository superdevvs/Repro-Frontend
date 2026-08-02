import { apiClient } from './api';

/**
 * Studio service (ai-editing-studio-revamp).
 *
 * Mirrors `studioMetricsService`/`listingVideoService` conventions: every call
 * goes through the shared `apiClient`, whose baseURL already ends in `/api`, so
 * paths here are namespace-relative (`/studio/queue` → `GET /api/studio/queue`).
 * The dashboard Bearer token is attached by the request interceptor.
 *
 * Response shapes match the implemented Laravel controllers under
 * `/api/studio/*` (`StudioSearchController`, `StudioQueueController`,
 * `StudioProjectController`, `StudioSourceController`,
 * `StudioTemplateController`, `StudioBrandController`,
 * `StudioDeepLinkController`, `StudioMetricsController::summary`), which all
 * wrap payloads as `{ success, data, meta? }`.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.8
 */

/** Every Studio_Destination reachable through Integrated_Studio_Navigation. */
export const STUDIO_DESTINATION_IDS = [
  'command-center',
  'projects',
  'queue',
  'metrics',
  'templates',
  'brand',
  'photo-enhancement',
  'twilight',
  'video-cleanup',
  'listing-video',
  'reel-generator',
  'batch-ai-jobs',
] as const;

export type StudioDestinationId = (typeof STUDIO_DESTINATION_IDS)[number];

/** The six launchable workflows (a subset of the destination ids). */
export const STUDIO_WORKFLOW_IDS = [
  'photo-enhancement',
  'twilight',
  'video-cleanup',
  'listing-video',
  'reel-generator',
  'batch-ai-jobs',
] as const;

export type WorkflowId = (typeof STUDIO_WORKFLOW_IDS)[number];

export type StudioRecordType = 'project' | 'shoot' | 'template' | 'workflow' | 'ai_job';

export interface StudioDeepLink {
  destination: StudioDestinationId;
  recordType?: StudioRecordType;
  recordId?: string;
  /** Present on project/create deep-links so the latest workflow can be preselected. */
  workflowId?: string;
}

export interface StudioDeepLinkResolution {
  ok: boolean;
  destination: StudioDestinationId;
  record?: Record<string, unknown> | null;
  /** `studio_record_not_found` / `studio_record_forbidden` when `ok` is false. */
  errorCode?: string;
  errorMessage?: string;
}

export interface SearchResult {
  recordType: StudioRecordType;
  recordId: string;
  title: string;
  context: string;
  deepLink: StudioDeepLink;
}

export interface SearchResultGroup {
  recordType: StudioRecordType;
  label: string;
  results: SearchResult[];
}

export type StudioQueueStatus =
  | 'pending'
  | 'processing'
  | 'stitching'
  | 'queued'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface QueueRecordContext {
  type: 'project' | 'shoot';
  id: string;
  label: string | null;
}

export interface QueueRecordEta {
  estimateSeconds: number;
  calculatedAt: string;
}

export interface QueueRecord {
  /** Globally unique, namespaced id (e.g. `photo-12`). (Req 16.3) */
  id: string;
  /** Associated AI_Job id. (Req 16.3) */
  aiJobId: string;
  jobType: 'photo' | 'video';
  workflowTitle: string;
  context: QueueRecordContext | null;
  /** Project or Shoot context label. */
  contextLabel: string | null;
  thumbnailUrl: string | null;
  status: StudioQueueStatus | string;
  /** `null` => indeterminate (Req 7.10); otherwise 0–100 (Req 16.4). */
  progress: number | null;
  /** `null` => "ETA unavailable" (Req 7.11, 16.5). */
  eta: QueueRecordEta | null;
  /** Present when failed (Req 7.15). */
  failureReason: string | null;
  /** Terminal timestamp used for the retention window (Req 7.14). */
  terminalAt: string | null;
  /** Server-managed update token (Req 10.10, 16.8). */
  version: string;
  deepLink: StudioDeepLink;
}

export interface QueueResponse {
  records: QueueRecord[];
  retentionHours: number;
  calculatedAt: string;
}

/** Trailing 30-day Measurement_Window metrics (Req 8, 16.6). */
export interface MetricsSummary {
  projectsProcessed: number;
  aiJobsCompleted: number;
  /** 0–100, 0 when the denominator is 0 (Req 8.4, 8.5). */
  successRate: number;
  mediaOutputs: number;
  windowStart: string;
  windowEnd: string;
}

export interface StudioProjectSummary {
  id: string;
  name: string;
  address: string | null;
  sourceType: 'shoot' | 'upload' | string;
  shootId: number | null;
  workflowId: string;
  status: string;
  thumbnailRef: string | null;
  latestWorkflowId: string;
  latestWorkflow: string;
  latestStatus: string;
  lastActivityAt: string;
  mediaCount: number;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
  deepLink: StudioDeepLink;
}

export interface StudioProjectMedia {
  id: number;
  mediaRef: string;
  kind: 'source' | 'output' | string;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StudioProjectJob {
  id: string;
  aiJobId: string;
  jobType: 'photo' | 'video' | 'reel';
  workflowId: string;
  workflowTitle: string;
  status: string;
  updatedAt: string | null;
  completedAt: string | null;
}

export interface StudioProjectDetail extends StudioProjectSummary {
  media: StudioProjectMedia[];
  jobs: StudioProjectJob[];
}

export interface CreateProjectInput {
  workflowId: WorkflowId;
  sourceType: 'shoot' | 'upload';
  shootId?: number | null;
  /** Shoot-file ids when `sourceType` is `shoot`. */
  fileIds?: number[];
  /** Storage refs returned by `upload` when `sourceType` is `upload`. */
  mediaRefs?: string[];
  name?: string;
  address?: string;
  templateId?: string | null;
  workflowConfig?: Record<string, unknown>;
  provider?: 'autoenhance' | 'fal';
  targetSeconds?: 30 | 40 | 45;
  bracketSize?: 3 | 5;
}

export interface CreateProjectResult {
  projectId: string;
  /** Populated only when the submission created exactly one AI_Job. */
  aiJobId: string | null;
  aiJobIds: string[];
  jobs: { id: string; type: string }[];
  deepLink: StudioDeepLink;
  version: number;
}

export interface StudioShootRef {
  id: number;
  propertyIdentifier: string;
  address: string | null;
  location: string | null;
  label: string;
  thumbnailUrl: string | null;
  updatedAt: string | null;
}

export interface SourceMedia {
  id: number;
  shootId: number;
  filename: string;
  mimeType: string | null;
  mediaType: 'image' | 'video' | 'raw' | string;
  fileSize: number;
  workflowStage: string | null;
  workflow: WorkflowId | string;
  previewUrl: string;
  thumbnailUrl: string;
}

export interface UploadedMedia {
  id: string;
  mediaRef: string;
  storagePath: string;
  url: string;
  previewUrl: string;
  filename: string;
  mimeType: string;
  mediaType: string;
  fileSize: number;
  workflow: WorkflowId | string;
  uploadedAt: string;
  /** Local id used for per-file progress reporting. */
  clientFileId: string;
}

export interface UploadViolation {
  constraint: string;
  message: string;
  actual?: string;
  actualBytes?: number;
  maxBytes?: number;
}

export interface RejectedUpload {
  filename: string;
  violations: UploadViolation[];
  /** Local id used for per-file progress reporting and retry. */
  clientFileId: string;
}

export interface UploadResult {
  accepted: UploadedMedia[];
  rejected: RejectedUpload[];
}

export type UploadProgressHandler = (fileId: string, pct: number) => void;

export interface Template {
  id: string;
  name: string;
  workflowId: WorkflowId | string;
  config: Record<string, unknown>;
  version: number;
  createdBy: number;
  createdAt: string | null;
  updatedAt: string | null;
  projectDefaults: {
    templateId: string;
    workflowId: string;
    workflowConfig: Record<string, unknown>;
  };
}

export interface TemplateInput {
  /** Omitted for create; required (with `version`) for update. */
  id?: string;
  name: string;
  workflowId: WorkflowId;
  config: Record<string, unknown>;
  /** Committed version, required when updating (optimistic concurrency). */
  version?: number;
}

export interface BrandState {
  teamId: number;
  settings: Record<string, unknown>;
  version: number;
  updatedBy: number | null;
  updatedAt: string | null;
}

export interface BrandStateInput {
  settings: Record<string, unknown>;
  /** Committed version being replaced (0 when brand state has never been saved). */
  version: number;
}

/** Clamp any server- or upload-derived progress value to 0–100 (Req 4.8, 16.4). */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Clamp an AI_Job Progress_Value that may be absent. A missing value stays
 * `null` so the Live_Queue renders an indeterminate state instead of a
 * fabricated number (Req 7.10); any present value is clamped to 0–100
 * (Req 16.4).
 */
export function clampNullableProgress(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === '') return null;

  return clampProgress(Number(value));
}

/** Stable local id for a file in an upload batch, used for per-file progress. */
export function uploadFileId(file: File, index: number): string {
  return `${index}:${file.name}`;
}

/** Maps a `CreateProjectInput` + idempotency key onto the API request body. */
export function createProjectPayload(
  input: CreateProjectInput,
  idempotencyKey: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    request_id: idempotencyKey,
    workflow_id: input.workflowId,
    source_type: input.sourceType,
    workflow_config: input.workflowConfig ?? {},
  };

  if (input.sourceType === 'shoot') {
    payload.shoot_id = input.shootId ?? null;
    payload.file_ids = input.fileIds ?? [];
  } else {
    payload.media_refs = input.mediaRefs ?? [];
  }
  if (input.name !== undefined) payload.name = input.name;
  if (input.address !== undefined) payload.address = input.address;
  if (input.templateId !== undefined && input.templateId !== null) {
    payload.template_id = input.templateId;
  }
  if (input.provider !== undefined) payload.provider = input.provider;
  if (input.targetSeconds !== undefined) payload.target_seconds = input.targetSeconds;
  if (input.bracketSize !== undefined) payload.bracket_size = input.bracketSize;

  return payload;
}

/**
 * Studio controllers always answer with `{ success, data, meta? }`; this unwraps
 * that envelope while tolerating an already-unwrapped payload.
 */
const unwrap = <T>(payload: unknown, fallback: T): T => {
  if (payload && typeof payload === 'object') {
    const wrapped = payload as { data?: T; success?: boolean };
    if ('data' in wrapped || 'success' in wrapped) {
      return (wrapped.data ?? fallback) as T;
    }
  }

  return (payload as T) ?? fallback;
};

/** Normalizes a queue record so progress stays within 0–100 or stays null. */
const normalizeQueueRecord = (record: QueueRecord): QueueRecord => ({
  ...record,
  progress: clampNullableProgress(record.progress),
  eta: record.eta ?? null,
  failureReason: record.failureReason ?? null,
  terminalAt: record.terminalAt ?? null,
  contextLabel: record.contextLabel ?? record.context?.label ?? null,
});

export const studioService = {
  /**
   * Validates a deep-link against the requester's authorization. Missing or
   * unauthorized records resolve to `ok: false` with the server error code so
   * the UI can render an Error_State without exposing restricted data
   * (Req 1.8, 1.9, 16.9).
   */
  async resolveDeepLink(link: StudioDeepLink): Promise<StudioDeepLinkResolution> {
    try {
      const response = await apiClient.post('/studio/deep-links/resolve', {
        destination: link.destination,
        ...(link.recordType ? { recordType: link.recordType } : {}),
        ...(link.recordId ? { recordId: link.recordId } : {}),
      });
      const data = response.data?.data ?? response.data;

      return {
        ok: true,
        destination: (data?.destination ?? link.destination) as StudioDestinationId,
        record: data?.record ?? null,
      };
    } catch (error) {
      const response = (error as { response?: { data?: Record<string, any> } }).response;
      const serverError = response?.data?.error;
      if (!response) throw error;

      return {
        ok: false,
        destination: link.destination,
        record: null,
        errorCode: serverError?.code ?? 'studio_deep_link_unresolved',
        errorMessage: serverError?.message ?? response?.data?.message ?? undefined,
      };
    }
  },

  /** Studio-scoped unified search returning grouped results (Req 6.1–6.3, 16.2). */
  async search(query: string): Promise<SearchResultGroup[]> {
    const response = await apiClient.get('/studio/search', { params: { q: query } });
    const groups = unwrap<SearchResultGroup[]>(response.data, []);

    return (groups ?? []).map((group) => ({
      ...group,
      results: group.results ?? [],
    }));
  },

  /** Live_Queue records plus the server retention window (Req 7.1–7.15, 16.3–16.5). */
  async getQueue(): Promise<QueueRecord[]> {
    const response = await apiClient.get('/studio/queue');
    const records = unwrap<QueueRecord[]>(response.data, []);

    return (records ?? []).map(normalizeQueueRecord);
  },

  /** Same as `getQueue` but preserves the response meta (retention/calculatedAt). */
  async getQueueWithMeta(): Promise<QueueResponse> {
    const response = await apiClient.get('/studio/queue');
    const records = unwrap<QueueRecord[]>(response.data, []);

    return {
      records: (records ?? []).map(normalizeQueueRecord),
      retentionHours: Number(response.data?.meta?.retentionHours ?? 0),
      calculatedAt: response.data?.meta?.calculatedAt ?? new Date().toISOString(),
    };
  },

  async getQueueRecord(id: string): Promise<QueueRecord> {
    const response = await apiClient.get(`/studio/queue/${id}`);

    return normalizeQueueRecord(unwrap<QueueRecord>(response.data, {} as QueueRecord));
  },

  /** Trailing 30-day metrics for the Metrics_Strip (Req 8.1–8.8, 16.6). */
  async getMetricsSummary(): Promise<MetricsSummary> {
    const response = await apiClient.get('/studio/metrics/summary');

    return unwrap<MetricsSummary>(response.data, {} as MetricsSummary);
  },

  /** Authorized Projects ordered by server-side activity (Req 9.1, 9.2, 13.15). */
  async listProjects(): Promise<StudioProjectSummary[]> {
    const response = await apiClient.get('/studio/projects');

    return unwrap<StudioProjectSummary[]>(response.data, []) ?? [];
  },

  async getProject(projectId: string): Promise<StudioProjectDetail> {
    const response = await apiClient.get(`/studio/projects/${projectId}`);

    return unwrap<StudioProjectDetail>(response.data, {} as StudioProjectDetail);
  },

  /**
   * Creates a Project (and its AI_Jobs) from a Shoot or uploaded media. The
   * `idempotencyKey` is sent as `request_id`, so retrying the same submission
   * returns the original result instead of duplicating jobs (Req 3.8, 13.14, 16.11).
   */
  async createProject(
    input: CreateProjectInput,
    idempotencyKey: string,
  ): Promise<CreateProjectResult> {
    const response = await apiClient.post(
      '/studio/projects',
      createProjectPayload(input, idempotencyKey),
    );
    const data = unwrap<CreateProjectResult>(response.data, {} as CreateProjectResult);

    return {
      ...data,
      aiJobId: data.aiJobId ?? null,
      aiJobIds: data.aiJobIds ?? [],
      jobs: data.jobs ?? [],
    };
  },

  /** Authorized Shoot search by property identifier or address (Req 4.2). */
  async searchShoots(query: string): Promise<StudioShootRef[]> {
    const response = await apiClient.get('/studio/shoots/search', { params: { q: query } });

    return unwrap<StudioShootRef[]>(response.data, []) ?? [];
  },

  /** Supported Source_Media for a Shoot and Workflow (Req 4.3). */
  async getShootMedia(shootId: number, workflow: WorkflowId): Promise<SourceMedia[]> {
    const response = await apiClient.get(`/studio/shoots/${shootId}/media`, {
      params: { workflow },
    });

    return unwrap<SourceMedia[]>(response.data, []) ?? [];
  },

  /**
   * Uploads files one request per file so per-file progress is reportable
   * (Req 4.8) and a single rejection never discards accepted files (Req 4.9).
   * Rejected files are returned with the violated constraint (Req 4.7).
   */
  async upload(
    files: File[],
    workflow: WorkflowId,
    onProgress?: UploadProgressHandler,
  ): Promise<UploadResult> {
    const accepted: UploadedMedia[] = [];
    const rejected: RejectedUpload[] = [];

    for (const [index, file] of files.entries()) {
      const clientFileId = uploadFileId(file, index);
      const formData = new FormData();
      formData.append('workflow', workflow);
      formData.append('files[]', file);

      try {
        const response = await apiClient.post('/studio/uploads', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event) => {
            const total = event.total ?? (file.size > 0 ? file.size : 0);
            if (!onProgress) return;
            onProgress(
              clientFileId,
              total > 0 ? clampProgress((event.loaded / total) * 100) : 0,
            );
          },
        });
        const data = response.data?.data ?? {};
        for (const media of (data.accepted ?? []) as UploadedMedia[]) {
          accepted.push({ ...media, clientFileId });
          onProgress?.(clientFileId, 100);
        }
        for (const item of (data.rejected ?? []) as RejectedUpload[]) {
          rejected.push({ ...item, clientFileId });
        }
      } catch (error) {
        const data = (error as { response?: { data?: Record<string, any> } }).response?.data;
        const serverRejected = (data?.data?.rejected ?? []) as RejectedUpload[];

        if (serverRejected.length > 0) {
          for (const item of serverRejected) {
            rejected.push({ ...item, clientFileId });
          }
        } else {
          rejected.push({
            filename: file.name,
            clientFileId,
            violations: [
              {
                constraint: 'request',
                message:
                  data?.message ??
                  (error instanceof Error ? error.message : 'The upload failed.'),
              },
            ],
          });
        }
      }
    }

    return { accepted, rejected };
  },

  /** Templates within the Authorized_Scope (Req 13.9). */
  async listTemplates(): Promise<Template[]> {
    const response = await apiClient.get('/studio/templates');

    return unwrap<Template[]>(response.data, []) ?? [];
  },

  /**
   * Creates a Template when `id` is absent, otherwise updates it using the
   * committed `version` for optimistic concurrency (Req 13.18, 10.9, 16.8).
   */
  async saveTemplate(template: TemplateInput): Promise<Template> {
    const body: Record<string, unknown> = {
      name: template.name,
      workflowId: template.workflowId,
      config: template.config ?? {},
    };

    if (template.id) {
      const response = await apiClient.put(`/studio/templates/${template.id}`, {
        ...body,
        version: template.version,
      });

      return unwrap<Template>(response.data, {} as Template);
    }

    const response = await apiClient.post('/studio/templates', body);

    return unwrap<Template>(response.data, {} as Template);
  },

  async deleteTemplate(id: string, version: number): Promise<void> {
    await apiClient.delete(`/studio/templates/${id}`, { data: { version } });
  },

  /** Latest committed Brand_State for the team (Req 13.19). */
  async getBrand(): Promise<BrandState> {
    const response = await apiClient.get('/studio/brand');

    return unwrap<BrandState>(response.data, {} as BrandState);
  },

  /** Persists Brand_State, rejecting stale versions server-side (Req 13.11, 16.8). */
  async saveBrand(brand: BrandStateInput): Promise<BrandState> {
    const response = await apiClient.put('/studio/brand', {
      version: brand.version,
      settings: brand.settings ?? {},
    });

    return unwrap<BrandState>(response.data, {} as BrandState);
  },
};
