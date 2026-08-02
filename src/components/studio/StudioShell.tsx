import React, { createContext, useContext, useMemo } from 'react';

import {
  useStudioDestinationRoute,
  type SetStudioDestinationOptions,
} from '@/hooks/useStudioDestinationRoute';

import { STUDIO_DESTINATIONS, type StudioDestinationEntry, type StudioDestinationId } from './destinations';
import type { StudioRecordRef } from './studioRouteState';
import type { PhotoCapability, RouteTarget, StudioSubtab, VideoCapability } from './types';
import type { StudioDeepLink } from '@/services/studioService';
import type {
  StudioDeepLinkErrorInfo,
  StudioDeepLinkStatus,
} from '@/hooks/useStudioDeepLinkRecord';

/**
 * StudioShell (ai-editing-studio-revamp, task 10.1).
 *
 * Wraps the existing AI Editing page state with the Studio shell: it owns the
 * active Studio_Destination as URL route state (`?d=...&rec=type:id`), derives the
 * page's existing `activeSubtab`/photo/video capability view model from it, and
 * publishes both — with the destination registry and any deep-linked record — to
 * descendants through context, so the destination is the single source of truth
 * (Req 1.1, 1.7, 1.10, 13.1).
 *
 * The shell renders **no chrome of its own** — no header, no sidebar — so the
 * existing `DashboardLayout` Application_Sidebar stays the only sidebar on the
 * Studio_Page (Req 1.2, 1.6).
 *
 * Seams intentionally left open:
 * - Task 10.2 adds `resolveDestination`, deep-link authorization, and `popstate`
 *   restoration on top of `studioRouteState` and `setDestination`.
 * - Task 10.3 adds `IntegratedStudioNav`, which renders one control per
 *   `destinations` entry and calls `setDestination`.
 */

export interface StudioShellContextValue {
  /** Active destination id (Command_Center when route state names none). */
  destination: StudioDestinationId;
  /** Registry entry for the active destination. */
  destinationEntry: StudioDestinationEntry;
  /** Record referenced by route state, when any. */
  record: StudioRecordRef | null;
  requestedRecord: StudioRecordRef | null;
  recordData: Record<string, unknown> | null;
  workflowId: string | null;
  deepLinkStatus: StudioDeepLinkStatus;
  deepLinkError: StudioDeepLinkErrorInfo | null;
  retryDeepLink: () => void;
  /** True when the default applied because route state named no destination. */
  isDefaultDestination: boolean;
  /** The full destination registry, so navigation is complete by construction. */
  destinations: readonly StudioDestinationEntry[];
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
  openDeepLink: (link: StudioDeepLink, options?: { replace?: boolean }) => void;
  /**
   * Selects the destination representing `subtab`, remembering the last
   * destination used inside it, so leaving and returning to Photo restores Batch
   * AI Jobs instead of resetting to the workspace.
   */
  setSubtab: (subtab: StudioSubtab, options?: SetStudioDestinationOptions) => void;
  /** Maps an existing card/template/recent-project `RouteTarget` to a destination. */
  setDestinationFromRouteTarget: (
    target: RouteTarget,
    options?: SetStudioDestinationOptions,
  ) => void;
}

const StudioShellContext = createContext<StudioShellContextValue | null>(null);

/** Shell context, or `null` when rendered outside a `StudioShell`. */
export function useOptionalStudioShell(): StudioShellContextValue | null {
  return useContext(StudioShellContext);
}

/** Shell context; throws when used outside a `StudioShell`. */
export function useStudioShell(): StudioShellContextValue {
  const context = useContext(StudioShellContext);
  if (!context) {
    throw new Error('useStudioShell must be used within a StudioShell');
  }

  return context;
}

export interface StudioShellProps {
  children: React.ReactNode;
}

export function StudioShell({ children }: StudioShellProps) {
  const route = useStudioDestinationRoute();

  const contextValue = useMemo<StudioShellContextValue>(
    () => ({
      destination: route.destinationId,
      destinationEntry: route.destination,
      record: route.record,
      requestedRecord: route.requestedRecord,
      recordData: route.recordData,
      workflowId: route.workflowId,
      deepLinkStatus: route.deepLinkStatus,
      deepLinkError: route.deepLinkError,
      retryDeepLink: route.retryDeepLink,
      isDefaultDestination: route.isDefaultDestination,
      destinations: STUDIO_DESTINATIONS,
      activeSubtab: route.activeSubtab,
      photoCapability: route.photoCapability,
      videoCapability: route.videoCapability,
      setDestination: route.setDestination,
      selectRecord: route.selectRecord,
      openDeepLink: route.openDeepLink,
      setSubtab: route.selectSubtab,
      setDestinationFromRouteTarget: route.selectRouteTarget,
    }),
    [
      route.destinationId,
      route.destination,
      route.record,
      route.requestedRecord,
      route.recordData,
      route.workflowId,
      route.deepLinkStatus,
      route.deepLinkError,
      route.retryDeepLink,
      route.isDefaultDestination,
      route.activeSubtab,
      route.photoCapability,
      route.videoCapability,
      route.setDestination,
      route.selectRecord,
      route.openDeepLink,
      route.selectSubtab,
      route.selectRouteTarget,
    ],
  );

  return (
    <StudioShellContext.Provider value={contextValue}>{children}</StudioShellContext.Provider>
  );
}

export default StudioShell;
