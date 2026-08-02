import { useCallback, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';

import {
  studioService,
  type CreateProjectInput,
  type CreateProjectResult,
  type QueueRecord,
  type WorkflowId,
} from '@/services/studioService';

/**
 * React Query hooks for the revamped AI Editing Studio (ai-editing-studio-revamp).
 *
 * Follows the existing `useStudioMetrics` conventions: a shared query-key map,
 * plain `useQuery` usage, and a pure, result-driven `refetchInterval` helper for
 * the polled endpoint. `getStudioQueueRefetchInterval` extends
 * `getActiveQueueRefetchInterval` by deciding on Queue_Record *status* instead of
 * list length, so polling runs while any record is non-terminal and stops once
 * every displayed record is terminal (Req 7.3, 7.4, 7.5).
 *
 * Mutations carry an idempotency key, refuse duplicate submissions while a
 * submission is in flight, and invalidate the affected server-backed sections on
 * success (Req 12.7, 12.8).
 */

export const STUDIO_QUERY_KEYS = {
  queue: () => ['studio-queue'] as const,
  queueRecord: (id: string) => ['studio-queue-record', id] as const,
  metricsSummary: () => ['studio-metrics-summary'] as const,
  search: (query: string) => ['studio-search', query] as const,
  projects: () => ['studio-projects'] as const,
  project: (id: string) => ['studio-project', id] as const,
  templates: () => ['studio-templates'] as const,
  brand: () => ['studio-brand'] as const,
};

/** Terminal AI_Job states — a Queue_Record in one of these needs no polling. */
export const TERMINAL_QUEUE_STATUSES = ['completed', 'failed', 'cancelled'] as const;

/**
 * Live_Queue poll interval. Requirement 7.4 caps the interval at 15s; we keep the
 * 8s cadence already used by `ACTIVE_QUEUE_POLL_INTERVAL` so the revamped queue
 * refreshes no slower than the existing one.
 */
export const STUDIO_QUEUE_POLL_INTERVAL = 8000;

/** Hard upper bound from Requirement 7.4, asserted by the polling property test. */
export const STUDIO_QUEUE_MAX_POLL_INTERVAL = 15000;

/** True when an AI_Job status is a Terminal_Status (Req 7.5). */
export function isTerminalQueueStatus(status: string | null | undefined): boolean {
  if (!status) return false;

  return (TERMINAL_QUEUE_STATUSES as readonly string[]).includes(status.toLowerCase());
}

/**
 * Pure helper deciding the Live_Queue `refetchInterval`: a positive interval no
 * greater than `STUDIO_QUEUE_MAX_POLL_INTERVAL` while at least one Queue_Record
 * is non-terminal, and `false` when every displayed record is terminal (or none
 * has loaded yet) (Req 7.4, 7.5).
 */
export function getStudioQueueRefetchInterval(
  records: QueueRecord[] | undefined,
): number | false {
  const hasActive = (records ?? []).some((record) => !isTerminalQueueStatus(record.status));

  return hasActive ? STUDIO_QUEUE_POLL_INTERVAL : false;
}

/** Query keys refreshed after a Project/workflow submission succeeds (Req 12.8). */
export const CREATE_PROJECT_INVALIDATE_KEYS: readonly (readonly unknown[])[] = [
  STUDIO_QUERY_KEYS.projects(),
  STUDIO_QUERY_KEYS.queue(),
  STUDIO_QUERY_KEYS.metricsSummary(),
  // Existing Studio Landing queries backed by the same server records.
  ['studio-hero-stats'],
  ['studio-recent-projects'],
  ['studio-active-queue'],
];

const invalidateStudioQueries = (
  queryClient: QueryClient,
  keys: readonly (readonly unknown[])[],
) => {
  for (const queryKey of keys) {
    queryClient.invalidateQueries({ queryKey });
  }
};

/** Fresh idempotency key for a submission (sent as `request_id`) (Req 16.11). */
export function createIdempotencyKey(): string {
  return uuidv4();
}

/**
 * Duplicate-submit guard (Req 12.7). A submission id may only be claimed once
 * until it is released, so a second submit while the server has not responded is
 * rejected instead of creating a duplicate mutation.
 */
export class SubmissionGuard {
  private readonly pending = new Set<string>();

  /** Claims `id`; returns false when a submission for `id` is already pending. */
  claim(id: string): boolean {
    if (this.pending.has(id)) return false;
    this.pending.add(id);

    return true;
  }

  /** Releases `id` once the server responded (success or failure). */
  release(id: string): void {
    this.pending.delete(id);
  }

  /** True when `id` (or any submission, when omitted) is pending. */
  isPending(id?: string): boolean {
    return id === undefined ? this.pending.size > 0 : this.pending.has(id);
  }
}

export const DEFAULT_SUBMISSION_ID = 'studio-submission';

export function useStudioQueue(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.queue(),
    queryFn: () => studioService.getQueue(),
    enabled: options?.enabled ?? true,
    refetchInterval: (query) =>
      getStudioQueueRefetchInterval(query.state.data as QueueRecord[] | undefined),
  });
}

export function useStudioQueueRecord(recordId: string | null) {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.queueRecord(recordId ?? ''),
    queryFn: () => studioService.getQueueRecord(recordId!),
    enabled: Boolean(recordId),
  });
}

export function useStudioMetricsSummary() {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.metricsSummary(),
    queryFn: () => studioService.getMetricsSummary(),
  });
}

/** Studio-scoped search; idle (no request) until a non-empty query is submitted. */
export function useStudioSearch(query: string, options?: { enabled?: boolean }) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.search(trimmed),
    queryFn: () => studioService.search(trimmed),
    enabled: (options?.enabled ?? true) && trimmed.length > 0,
  });
}

export function useStudioProjects() {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.projects(),
    queryFn: () => studioService.listProjects(),
  });
}

export function useStudioProject(projectId: string | null) {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.project(projectId ?? ''),
    queryFn: () => studioService.getProject(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useStudioTemplates() {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.templates(),
    queryFn: () => studioService.listTemplates(),
  });
}

export function useStudioBrand() {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.brand(),
    queryFn: () => studioService.getBrand(),
  });
}

export interface CreateProjectVariables {
  input: CreateProjectInput;
  /**
   * Stable id for one logical submission. Retrying a failed submission with the
   * same id reuses its idempotency key so the server returns the original result
   * instead of creating duplicate AI_Jobs (Req 16.11).
   */
  submissionId?: string;
  /** Explicit idempotency key; generated when omitted. */
  idempotencyKey?: string;
}

/**
 * Creates a Project (and its AI_Jobs) from the Project_Launcher or a workflow
 * panel. `submit` is the guarded entry point: it returns `null` when a
 * submission for the same id is already in flight (Req 12.7) and resolves with
 * the created project + deep-link otherwise (Req 3.8, 13.14).
 */
export function useCreateProject() {
  const queryClient = useQueryClient();
  // One guard instance per hook instance keeps the pending set stable across
  // renders, so a re-render never lets a duplicate submission through.
  const guard = useMemo(() => new SubmissionGuard(), []);
  const keys = useRef(new Map<string, string>());

  const mutation = useMutation({
    mutationFn: ({ input, submissionId, idempotencyKey }: CreateProjectVariables) => {
      const id = submissionId ?? DEFAULT_SUBMISSION_ID;
      const existing = keys.current.get(id);
      const key = idempotencyKey ?? existing ?? createIdempotencyKey();
      keys.current.set(id, key);

      return studioService.createProject(input, key);
    },
    onSuccess: (_result, variables) => {
      // The submission committed, so the next retry must not reuse its key.
      keys.current.delete(variables.submissionId ?? DEFAULT_SUBMISSION_ID);
      invalidateStudioQueries(queryClient, CREATE_PROJECT_INVALIDATE_KEYS);
    },
  });

  const submit = useCallback(
    async (variables: CreateProjectVariables): Promise<CreateProjectResult | null> => {
      const id = variables.submissionId ?? DEFAULT_SUBMISSION_ID;
      if (!guard.claim(id)) return null;

      try {
        return await mutation.mutateAsync(variables);
      } finally {
        guard.release(id);
      }
    },
    [guard, mutation],
  );

  const isSubmitting = useCallback(
    (submissionId?: string) => guard.isPending(submissionId),
    [guard],
  );

  return { ...mutation, submit, isSubmitting, guard };
}

export interface SubmitWorkflowVariables extends Omit<CreateProjectVariables, 'input'> {
  input: Omit<CreateProjectInput, 'workflowId'>;
}

/**
 * Workflow-submit mutation: the same guarded, idempotent create path with the
 * Workflow fixed, used by the six workflow destinations (Req 13.2–13.7).
 */
export function useSubmitWorkflow(workflowId: WorkflowId) {
  const create = useCreateProject();

  const submitWorkflow = useCallback(
    (variables: SubmitWorkflowVariables) =>
      create.submit({
        ...variables,
        submissionId: variables.submissionId ?? `workflow:${workflowId}`,
        input: { ...variables.input, workflowId },
      }),
    [create, workflowId],
  );

  return { ...create, workflowId, submitWorkflow };
}
