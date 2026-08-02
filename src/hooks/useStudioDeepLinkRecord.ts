import { useCallback, useEffect, useMemo, useState } from 'react';

import type { StudioRecordRef } from '@/components/studio/studioRouteState';
import {
  studioService,
  type StudioDeepLink,
  type StudioDestinationId,
  type StudioRecordType,
} from '@/services/studioService';

/**
 * Authorizes the record a Studio_Deep_Link references before the Studio selects
 * it (ai-editing-studio-revamp, task 10.2).
 *
 * `resolveDestination` decides the destination from route state alone, but the
 * referenced Studio_Record is only *selected* once the server confirms it exists
 * and is inside the requester's Authorized_Scope via
 * `studioService.resolveDeepLink` (Req 1.8). A missing or unauthorized record
 * yields an Error_State whose copy is written here, keyed by the server error
 * code, so no restricted record data can reach the UI (Req 1.9, 15.5).
 *
 * Requirements: 1.8, 1.9, 14.2, 14.3
 */

export type StudioDeepLinkStatus = 'idle' | 'resolving' | 'authorized' | 'error';

export interface StudioDeepLinkErrorInfo {
  /** Server error code (`studio_record_not_found` / `studio_record_forbidden`). */
  code: string;
  /** Client-authored, non-revealing message for the Error_State. */
  message: string;
  recordType: StudioRecordType | null;
}

export interface StudioDeepLinkRecordState {
  status: StudioDeepLinkStatus;
  /** Record to select — populated only after authorization succeeds. */
  record: StudioRecordRef | null;
  /** Record the link asked for, whether or not it was authorized. */
  requestedRecord: StudioRecordRef | null;
  /** Authorized record payload returned by the server, when any. */
  data: Record<string, unknown> | null;
  error: StudioDeepLinkErrorInfo | null;
  /** Repeats the failed authorization request (Req 12.6). */
  retry: () => void;
}

/**
 * Error_State copy per server code. Deliberately generic: a deep-link to another
 * team's record must not reveal whether that record exists (Req 1.9, 15.5).
 */
const DEEP_LINK_ERROR_MESSAGES: Record<string, string> = {
  studio_record_not_found: 'That link points to a record that is no longer available.',
  studio_record_forbidden: 'You don’t have access to the record this link points to.',
};

const GENERIC_DEEP_LINK_ERROR = 'That link couldn’t be opened. Please try again.';

export function studioDeepLinkErrorMessage(code: string | null | undefined): string {
  if (!code) return GENERIC_DEEP_LINK_ERROR;

  return DEEP_LINK_ERROR_MESSAGES[code] ?? GENERIC_DEEP_LINK_ERROR;
}

interface InternalState {
  status: StudioDeepLinkStatus;
  record: StudioRecordRef | null;
  data: Record<string, unknown> | null;
  error: StudioDeepLinkErrorInfo | null;
}

const IDLE: InternalState = { status: 'idle', record: null, data: null, error: null };

export function useStudioDeepLinkRecord(
  link: StudioDeepLink | null,
): StudioDeepLinkRecordState {
  const destination = (link?.destination ?? null) as StudioDestinationId | null;
  const recordType = link?.recordType ?? null;
  const recordId = link?.recordId ?? null;

  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<InternalState>(IDLE);

  const requestedRecord = useMemo<StudioRecordRef | null>(
    () => (recordType && recordId ? { recordType, recordId } : null),
    [recordType, recordId],
  );

  useEffect(() => {
    if (!destination || !recordType || !recordId) {
      setState((previous) => (previous.status === 'idle' ? previous : IDLE));

      return;
    }

    let cancelled = false;
    setState({ status: 'resolving', record: null, data: null, error: null });

    studioService
      .resolveDeepLink({ destination, recordType, recordId })
      .then((resolution) => {
        if (cancelled) return;

        if (resolution.ok) {
          setState({
            status: 'authorized',
            record: { recordType, recordId },
            data: (resolution.record as Record<string, unknown> | null) ?? null,
            error: null,
          });

          return;
        }

        setState({
          status: 'error',
          record: null,
          data: null,
          error: {
            code: resolution.errorCode ?? 'studio_deep_link_unresolved',
            message: studioDeepLinkErrorMessage(resolution.errorCode),
            recordType,
          },
        });
      })
      .catch(() => {
        if (cancelled) return;

        setState({
          status: 'error',
          record: null,
          data: null,
          error: {
            code: 'studio_deep_link_request_failed',
            message: GENERIC_DEEP_LINK_ERROR,
            recordType,
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [destination, recordType, recordId, attempt]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return {
    status: state.status,
    record: state.record,
    requestedRecord,
    data: state.data,
    error: state.error,
    retry,
  };
}

export default useStudioDeepLinkRecord;
