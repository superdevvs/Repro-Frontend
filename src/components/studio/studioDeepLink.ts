/**
 * Studio_Deep_Link encode/decode and `resolveDestination`
 * (ai-editing-studio-revamp, task 10.2).
 *
 * A Studio_Deep_Link is `{ destination, recordType?, recordId?, workflowId? }`
 * carried in the Studio route state written by `studioRouteState`:
 *
 *   /ai-editing?d={destination}&rec={recordType}:{recordId}&wf={workflowId}
 *
 * `resolveDestination` is the single answer to "what should the Studio show for
 * this route state?": the referenced destination when the route state carries a
 * valid deep-link, and the Command_Center otherwise (Req 1.1, 1.8). It is the
 * function re-run on `popstate`, so browser history restores the destination the
 * resulting route state represents (Req 1.11).
 *
 * This module is intentionally pure — no React, no DOM, no network — so
 * Properties 1 and 4 can exercise it without rendering. Authorization of the
 * referenced record (`studioService.resolveDeepLink`) happens in
 * `useStudioDestinationRoute`; nothing here trusts or exposes record data.
 *
 * Requirements: 1.1, 1.8, 1.9, 1.11, 14.2, 14.3
 */

import type { StudioDeepLink, StudioRecordType } from '@/services/studioService';

import {
  DEFAULT_STUDIO_DESTINATION,
  getWorkflowDestination,
  isStudioDestinationId,
  isStudioWorkflowId,
  type StudioDestinationId,
  type WorkflowId,
} from './destinations';
import {
  STUDIO_DESTINATION_PARAM,
  STUDIO_RECORD_PARAM,
  STUDIO_WORKFLOW_PARAM,
  isStudioRecordType,
  readStudioRouteState,
  writeStudioRouteState,
  type StudioRecordRef,
  type StudioRouteState,
} from './studioRouteState';

export { STUDIO_DESTINATION_PARAM, STUDIO_RECORD_PARAM, STUDIO_WORKFLOW_PARAM };

/** Route of the Studio_Page, used when building shareable deep-link hrefs. */
export const STUDIO_PATH = '/ai-editing';

/** Anything `resolveDestination` can read a Studio route state out of. */
export type StudioRouteStateInput = StudioRouteState | URLSearchParams | string | null | undefined;

export interface ResolvedStudioDestination {
  /** Destination to display; Command_Center when no valid deep-link is present. */
  destination: StudioDestinationId;
  /**
   * Record the link references, *before* authorization. Callers must not select
   * it until `studioService.resolveDeepLink` confirms access (Req 1.8, 1.9).
   */
  record: StudioRecordRef | null;
  /** Workflow the link preselects, when it names one (Req 14.2, 14.3). */
  workflowId: WorkflowId | null;
  /** True when route state named no valid deep-link and the default applied. */
  isDefaultDestination: boolean;
  /** The normalized deep-link the route state represents, when it carries one. */
  deepLink: StudioDeepLink | null;
  /** True when the link references a record and therefore needs authorization. */
  requiresAuthorization: boolean;
}

/**
 * Validates and trims an arbitrary value into a Studio_Deep_Link, or returns
 * `null` when it does not name a known destination. A record part survives only
 * when both a known record type and a non-empty id are present, and a workflow
 * part only when it names a supported Workflow — so an encoded link never
 * carries a half-formed record reference.
 */
export function normalizeStudioDeepLink(link: unknown): StudioDeepLink | null {
  if (!link || typeof link !== 'object') return null;

  const candidate = link as Partial<StudioDeepLink>;
  if (!isStudioDestinationId(candidate.destination)) return null;

  const normalized: StudioDeepLink = { destination: candidate.destination };

  const recordId =
    typeof candidate.recordId === 'string'
      ? candidate.recordId.trim()
      : typeof candidate.recordId === 'number'
        ? String(candidate.recordId)
        : '';

  if (isStudioRecordType(candidate.recordType) && recordId.length > 0) {
    normalized.recordType = candidate.recordType;
    normalized.recordId = recordId;
  }

  if (isStudioWorkflowId(candidate.workflowId)) {
    normalized.workflowId = candidate.workflowId;
  }

  return normalized;
}

export function isValidStudioDeepLink(link: unknown): link is StudioDeepLink {
  return normalizeStudioDeepLink(link) !== null;
}

/** The record a deep-link references, when it references a complete one. */
export function studioDeepLinkRecord(link: StudioDeepLink | null): StudioRecordRef | null {
  const normalized = normalizeStudioDeepLink(link);
  if (!normalized?.recordType || !normalized.recordId) return null;

  return { recordType: normalized.recordType, recordId: normalized.recordId };
}

/**
 * Encodes a deep-link into Studio route state. Unrelated params in `base` are
 * preserved, so encoding a link never discards the rest of the URL.
 */
export function encodeStudioDeepLink(
  link: StudioDeepLink,
  base: URLSearchParams | string = '',
): URLSearchParams {
  const normalized = normalizeStudioDeepLink(link);
  const destination = normalized?.destination ?? DEFAULT_STUDIO_DESTINATION;

  return writeStudioRouteState(base, {
    destination,
    record: studioDeepLinkRecord(normalized),
    workflowId: normalized?.workflowId ?? null,
  });
}

/** `?d=…&rec=…` search string for a deep-link. */
export function studioDeepLinkSearch(link: StudioDeepLink): string {
  const encoded = encodeStudioDeepLink(link).toString();

  return encoded.length > 0 ? `?${encoded}` : '';
}

/** Shareable in-app href for a deep-link (`/ai-editing?d=…`). */
export function studioDeepLinkHref(link: StudioDeepLink, path: string = STUDIO_PATH): string {
  return `${path}${studioDeepLinkSearch(link)}`;
}

function toRouteState(input: StudioRouteStateInput): StudioRouteState {
  if (input && typeof input === 'object' && 'destination' in input) {
    return input as StudioRouteState;
  }

  const routeInput =
    input instanceof URLSearchParams
      ? input
      : typeof input === 'string'
        ? input.replace(/^\?/, '')
        : '';

  return readStudioRouteState(routeInput);
}

/**
 * Decodes the Studio_Deep_Link a route state carries, or `null` when it carries
 * none. Route state whose destination param is absent or unrecognised is not a
 * valid deep-link, so a stray record param alone never counts as one.
 */
export function decodeStudioDeepLink(input: StudioRouteStateInput): StudioDeepLink | null {
  const state = toRouteState(input);
  if (state.isDefaultDestination) return null;

  return normalizeStudioDeepLink({
    destination: state.destination,
    ...(state.record
      ? { recordType: state.record.recordType, recordId: state.record.recordId }
      : {}),
    ...(state.workflowId ? { workflowId: state.workflowId } : {}),
  });
}

/**
 * Resolves the destination a route state should display. With no valid
 * Studio_Deep_Link present this returns the Command_Center and no record
 * selection (Req 1.1); otherwise it returns the referenced destination plus the
 * record and workflow the link references, pending authorization (Req 1.8, 1.11).
 */
export function resolveDestination(input: StudioRouteStateInput): ResolvedStudioDestination {
  const deepLink = decodeStudioDeepLink(input);

  if (!deepLink) {
    return {
      destination: DEFAULT_STUDIO_DESTINATION,
      record: null,
      workflowId: null,
      isDefaultDestination: true,
      deepLink: null,
      requiresAuthorization: false,
    };
  }

  const record = studioDeepLinkRecord(deepLink);

  return {
    destination: deepLink.destination,
    record,
    workflowId: deepLink.workflowId && isStudioWorkflowId(deepLink.workflowId)
      ? deepLink.workflowId
      : null,
    isDefaultDestination: false,
    deepLink,
    requiresAuthorization: record !== null,
  };
}

/**
 * Deep-link for a record, defaulting the destination to the one that owns
 * `workflowId` when the caller supplies one (used by create/search results).
 */
export function studioDeepLinkFor(
  destination: StudioDestinationId,
  record?: { recordType: StudioRecordType; recordId: string } | null,
  workflowId?: WorkflowId | string | null,
): StudioDeepLink {
  const workflowDestination = getWorkflowDestination(workflowId);

  return {
    destination:
      isStudioDestinationId(destination) && destination !== DEFAULT_STUDIO_DESTINATION
        ? destination
        : (workflowDestination?.id ?? destination),
    ...(record?.recordType && record.recordId
      ? { recordType: record.recordType, recordId: record.recordId }
      : {}),
    ...(isStudioWorkflowId(workflowId) ? { workflowId } : {}),
  };
}
