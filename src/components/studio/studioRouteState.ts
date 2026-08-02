/**
 * Studio route state (ai-editing-studio-revamp, task 10.1).
 *
 * The active Studio_Destination lives in URL query state so it is visible,
 * shareable, and restorable through browser history (Req 1.10):
 *
 *   /ai-editing?d={destinationId}&rec={recordType}:{recordId}&wf={workflowId}
 *
 * This module reads and writes only those params. `resolveDestination`, the
 * Studio_Deep_Link encode/decode pair, record authorization, and `popstate`
 * restoration live in `studioDeepLink.ts` / `useStudioDestinationRoute` and build
 * on top of these helpers.
 *
 * Pure module (no React, no DOM) so property tests can import it directly.
 *
 * Requirements: 1.1, 1.7, 1.10
 */

import type { StudioRecordType } from '@/services/studioService';

import {
  DEFAULT_STUDIO_DESTINATION,
  isStudioDestinationId,
  isStudioWorkflowId,
  type StudioDestinationId,
  type WorkflowId,
} from './destinations';

/** Query param holding the active destination id. */
export const STUDIO_DESTINATION_PARAM = 'd';

/** Query param holding the selected record, as `{recordType}:{recordId}`. */
export const STUDIO_RECORD_PARAM = 'rec';

/**
 * Query param holding the Workflow preselected by the link, used by
 * project/AI_Job deep-links that must restore "the latest relevant Workflow"
 * (Req 9.4, 14.2, 14.3).
 */
export const STUDIO_WORKFLOW_PARAM = 'wf';

/** Record types a Studio_Deep_Link may reference. */
export const STUDIO_RECORD_TYPES: readonly StudioRecordType[] = [
  'project',
  'shoot',
  'template',
  'workflow',
  'ai_job',
];

/** A record selection carried alongside the destination. */
export interface StudioRecordRef {
  recordType: StudioRecordType;
  recordId: string;
}

export interface StudioRouteState {
  destination: StudioDestinationId;
  /** True when the URL carried no recognised destination and the default applied. */
  isDefaultDestination: boolean;
  record: StudioRecordRef | null;
  /** Workflow named by `?wf=`, when it names a supported Workflow. */
  workflowId: WorkflowId | null;
}

export function isStudioRecordType(value: unknown): value is StudioRecordType {
  return (
    typeof value === 'string' && (STUDIO_RECORD_TYPES as readonly string[]).includes(value)
  );
}

/**
 * `"project:42"` → `{ recordType: 'project', recordId: '42' }`; `null` when the
 * value is missing, malformed, or names an unknown record type. Only the first
 * `:` separates the parts, so namespaced ids (`ai_job:photo-12`, `project:p:1`)
 * survive intact.
 */
export function parseStudioRecordRef(
  value: string | null | undefined,
): StudioRecordRef | null {
  if (!value) return null;

  const separator = value.indexOf(':');
  if (separator <= 0) return null;

  const recordType = value.slice(0, separator).trim();
  const recordId = value.slice(separator + 1).trim();

  if (!isStudioRecordType(recordType) || recordId.length === 0) return null;

  return { recordType, recordId };
}

/** Inverse of `parseStudioRecordRef`. */
export function formatStudioRecordRef(record: StudioRecordRef): string {
  return `${record.recordType}:${record.recordId}`;
}

/**
 * Reads the destination + record selection out of query params. An absent or
 * unrecognised destination resolves to the Command_Center (Req 1.1).
 */
export function readStudioRouteState(params: URLSearchParams | string): StudioRouteState {
  const search = typeof params === 'string' ? new URLSearchParams(params) : params;
  const raw = search.get(STUDIO_DESTINATION_PARAM);
  const known = isStudioDestinationId(raw);
  const workflow = search.get(STUDIO_WORKFLOW_PARAM);

  return {
    destination: known ? raw : DEFAULT_STUDIO_DESTINATION,
    isDefaultDestination: !known,
    record: parseStudioRecordRef(search.get(STUDIO_RECORD_PARAM)),
    workflowId: isStudioWorkflowId(workflow) ? workflow : null,
  };
}

/**
 * Returns a copy of `params` with the Studio destination/record params set.
 * Unrelated params are preserved, and an omitted record clears `rec` so a stale
 * selection never leaks into a new destination.
 */
export function writeStudioRouteState(
  params: URLSearchParams | string,
  state: {
    destination: StudioDestinationId;
    record?: StudioRecordRef | null;
    workflowId?: WorkflowId | string | null;
  },
): URLSearchParams {
  const next = new URLSearchParams(typeof params === 'string' ? params : params.toString());

  next.set(STUDIO_DESTINATION_PARAM, state.destination);

  if (state.record) {
    next.set(STUDIO_RECORD_PARAM, formatStudioRecordRef(state.record));
  } else {
    next.delete(STUDIO_RECORD_PARAM);
  }

  if (isStudioWorkflowId(state.workflowId)) {
    next.set(STUDIO_WORKFLOW_PARAM, state.workflowId);
  } else {
    next.delete(STUDIO_WORKFLOW_PARAM);
  }

  return next;
}
