import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  defaultDestinationForSubtab,
  deriveActiveSubtab,
  derivePhotoCapability,
  deriveVideoCapability,
  getStudioDestination,
  routeTargetToDestination,
  type StudioDestinationEntry,
  type StudioDestinationId,
  type WorkflowId,
} from '@/components/studio/destinations';
import {
  normalizeStudioDeepLink,
  resolveDestination,
  studioDeepLinkRecord,
  type ResolvedStudioDestination,
} from '@/components/studio/studioDeepLink';
import {
  writeStudioRouteState,
  type StudioRecordRef,
} from '@/components/studio/studioRouteState';
import type {
  PhotoCapability,
  RouteTarget,
  StudioSubtab,
  VideoCapability,
} from '@/components/studio/types';
import {
  useStudioDeepLinkRecord,
  type StudioDeepLinkErrorInfo,
  type StudioDeepLinkStatus,
} from '@/hooks/useStudioDeepLinkRecord';
import type { StudioDeepLink } from '@/services/studioService';

/**
 * Owns the Studio_Destination route state for `StudioShell`
 * (ai-editing-studio-revamp, tasks 10.1 and 10.2).
 *
 * The active destination lives in URL query state (`?d=…&rec=type:id&wf=…`) using
 * the project's existing `useSearchParams` convention, and every render resolves
 * it through the pure `resolveDestination`, which falls back to the Command_Center
 * when the route state carries no valid Studio_Deep_Link (Req 1.1, 1.8). The
 * page's existing `activeSubtab` / photo & video capability values are *derived*
 * from the resolved destination, so the destination stays the single source of
 * truth (Req 1.7, 1.10) while the preserved photo/video panels keep working
 * unchanged (Req 14.2, 14.3).
 *
 * Resolution is re-run on `popstate`, so browser history restores the destination
 * the resulting route state represents (Req 1.11), and a deep-linked record is
 * only selected after `studioService.resolveDeepLink` authorizes it, with a
 * non-revealing Error_State otherwise (Req 1.8, 1.9).
 */

export interface SetStudioDestinationOptions {
  /** Record selection to write into `?rec=`; omitted/`null` clears it. */
  record?: StudioRecordRef | null;
  /** Workflow to preselect via `?wf=`; omitted/`null` clears it. */
  workflowId?: WorkflowId | null;
  /** Replace the history entry instead of pushing a new one. */
  replace?: boolean;
}

export interface StudioDestinationRoute {
  destinationId: StudioDestinationId;
  destination: StudioDestinationEntry;
  /** Authorized record selection; `null` until authorization succeeds. */
  record: StudioRecordRef | null;
  /** Record the current deep-link asked for, authorized or not. */
  requestedRecord: StudioRecordRef | null;
  /** Authorized record payload returned by the server, when any. */
  recordData: Record<string, unknown> | null;
  /** Workflow preselected by route state, when any. */
  workflowId: WorkflowId | null;
  /** Deep-link the current route state represents, when it carries one. */
  deepLink: StudioDeepLink | null;
  deepLinkStatus: StudioDeepLinkStatus;
  deepLinkError: StudioDeepLinkErrorInfo | null;
  /** Repeats a failed deep-link authorization request. */
  retryDeepLink: () => void;
  /** True when the URL named no valid deep-link and the default applied. */
  isDefaultDestination: boolean;
  /** Existing view model derived from the active destination. */
  activeSubtab: StudioSubtab;
  photoCapability: PhotoCapability;
  videoCapability: VideoCapability;
  setDestination: (
    destination: StudioDestinationId,
    options?: SetStudioDestinationOptions,
  ) => void;
  /** Keeps the active destination and selects (or clears) a record. */
  selectRecord: (record: StudioRecordRef | null) => void;
  /** Navigates to a Studio_Deep_Link (destination + record + workflow). */
  openDeepLink: (link: StudioDeepLink, options?: { replace?: boolean }) => void;
  /**
   * Selects the destination representing `subtab`, remembering the last
   * destination used inside it, so leaving and returning to Photo restores Batch
   * AI Jobs instead of resetting to the workspace.
   */
  selectSubtab: (subtab: StudioSubtab, options?: SetStudioDestinationOptions) => void;
  /** Maps an existing card/template/recent-project `RouteTarget` to a destination. */
  selectRouteTarget: (target: RouteTarget, options?: SetStudioDestinationOptions) => void;
}

/**
 * Search string resolution is re-run whenever the browser fires `popstate`, so a
 * Back/Forward navigation restores the destination its route state represents
 * even when the entry was not produced by an in-app navigation (Req 1.11). A
 * router-driven change supersedes the last `popstate` snapshot.
 */
function useStudioRouteSearch(searchParams: URLSearchParams): string {
  const routerSearch = searchParams.toString();
  const [historySearch, setHistorySearch] = useState<string | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      setHistorySearch(
        typeof window === 'undefined' ? null : window.location.search.replace(/^\?/, ''),
      );
    };

    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    setHistorySearch(null);
  }, [routerSearch]);

  return historySearch ?? routerSearch;
}

export function useStudioDestinationRoute(): StudioDestinationRoute {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = useStudioRouteSearch(searchParams);

  const resolved: ResolvedStudioDestination = useMemo(
    () => resolveDestination(search),
    [search],
  );
  const destinationId = resolved.destination;
  const destination = getStudioDestination(destinationId);

  const deepLink = useStudioDeepLinkRecord(resolved.deepLink);

  // Last destination used within each subtab, so subtab switching preserves the
  // in-subtab capability the way the page's previous local state did.
  const lastBySubtab = useRef<Partial<Record<StudioSubtab, StudioDestinationId>>>({});
  lastBySubtab.current[destination.view.subtab] = destinationId;

  const setDestination = useCallback(
    (next: StudioDestinationId, options?: SetStudioDestinationOptions) => {
      setSearchParams(
        (prev) =>
          writeStudioRouteState(prev, {
            destination: next,
            record: options?.record ?? null,
            workflowId: options?.workflowId ?? null,
          }),
        { replace: options?.replace ?? false },
      );
    },
    [setSearchParams],
  );

  const selectRecord = useCallback(
    (record: StudioRecordRef | null) => {
      setDestination(destinationId, {
        record,
        workflowId: resolved.workflowId,
        replace: true,
      });
    },
    [destinationId, resolved.workflowId, setDestination],
  );

  const openDeepLink = useCallback(
    (link: StudioDeepLink, options?: { replace?: boolean }) => {
      const normalized = normalizeStudioDeepLink(link);
      if (!normalized) return;

      setDestination(normalized.destination, {
        record: studioDeepLinkRecord(normalized),
        workflowId: (normalized.workflowId as WorkflowId | undefined) ?? null,
        replace: options?.replace ?? false,
      });
    },
    [setDestination],
  );

  const selectSubtab = useCallback(
    (subtab: StudioSubtab, options?: SetStudioDestinationOptions) => {
      setDestination(
        lastBySubtab.current[subtab] ?? defaultDestinationForSubtab(subtab),
        options,
      );
    },
    [setDestination],
  );

  const selectRouteTarget = useCallback(
    (target: RouteTarget, options?: SetStudioDestinationOptions) => {
      setDestination(routeTargetToDestination(target), options);
    },
    [setDestination],
  );

  return {
    destinationId,
    destination,
    record: deepLink.record,
    requestedRecord: resolved.record,
    recordData: deepLink.data,
    workflowId: resolved.workflowId,
    deepLink: resolved.deepLink,
    deepLinkStatus: deepLink.status,
    deepLinkError: deepLink.error,
    retryDeepLink: deepLink.retry,
    isDefaultDestination: resolved.isDefaultDestination,
    activeSubtab: deriveActiveSubtab(destinationId),
    photoCapability: derivePhotoCapability(destinationId),
    videoCapability: deriveVideoCapability(destinationId),
    setDestination,
    selectRecord,
    openDeepLink,
    selectSubtab,
    selectRouteTarget,
  };
}

export default useStudioDestinationRoute;
