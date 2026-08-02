/**
 * Studio_Destination registry (ai-editing-studio-revamp, task 10.1).
 *
 * One registry enumerates every Studio_Destination reachable through
 * Integrated_Studio_Navigation, so navigation completeness is guaranteed by
 * construction (Req 1.5) and each entry carries what the shell and the nav need:
 * id, label, icon, kind, permission, media type, and the `view` mapping onto the
 * page's existing `activeSubtab`/capability model.
 *
 * The module is intentionally pure (no React, no route or DOM access) so the
 * later property tests (Properties 1, 2, 3) can import the registry and these
 * derivation helpers without rendering anything.
 *
 * Requirements: 1.1, 1.5, 1.6, 1.7, 1.10, 13.1
 */

import {
  BarChart3,
  Film,
  FolderOpen,
  Images,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  ListChecks,
  Palette,
  Sparkles,
  Sun,
  Video,
  type LucideIcon,
} from 'lucide-react';

import {
  STUDIO_DESTINATION_IDS,
  STUDIO_WORKFLOW_IDS,
  type StudioDestinationId,
  type WorkflowId,
} from '@/services/studioService';

import type {
  EnhancementModeId,
  PhotoCapability,
  RouteTarget,
  StudioShootRef,
  StudioSubtab,
  VideoCapability,
} from './types';

export { STUDIO_DESTINATION_IDS, STUDIO_WORKFLOW_IDS };
export type { StudioDestinationId, WorkflowId };

/**
 * How a destination behaves: the Command_Center overview, a data-management
 * destination (Projects/Queue/Metrics/Templates/Brand), or a launchable Workflow.
 */
export type StudioDestinationKind = 'overview' | 'management' | 'workflow';

/** Media a destination operates on; `none` for destinations without media. */
export type StudioDestinationMediaType = 'photo' | 'video' | 'mixed' | 'none';

/**
 * Permission required for a destination, in the `{ resource, action }` shape the
 * application's `usePermission().can(resource, action)` check expects.
 */
export interface StudioDestinationPermission {
  resource: string;
  action: string;
}

/** The Studio permission the server defines today (`backend/config/permissions.php`). */
export const STUDIO_VIEW_PERMISSION: StudioDestinationPermission = {
  resource: 'ai-editing',
  action: 'view',
};

/**
 * How a destination maps onto the page's existing in-page navigation state, so
 * the preserved photo/video panels keep working unchanged while the destination
 * remains the single source of truth (Req 1.7, 13.1).
 */
export interface StudioDestinationView {
  subtab: StudioSubtab;
  photoCapability?: PhotoCapability;
  videoCapability?: VideoCapability;
  /** Enhancement mode preselected when the destination opens. */
  photoMode?: EnhancementModeId;
}

export interface StudioDestinationEntry {
  id: StudioDestinationId;
  label: string;
  icon: LucideIcon;
  kind: StudioDestinationKind;
  permission: StudioDestinationPermission;
  mediaType: StudioDestinationMediaType;
  /** Short description for nav tooltips and destination headers. */
  description: string;
  /** Workflow id when `kind === 'workflow'`. */
  workflowId?: WorkflowId;
  view: StudioDestinationView;
}

/** Command_Center is the destination shown when no deep-link is present (Req 1.1). */
export const DEFAULT_STUDIO_DESTINATION: StudioDestinationId = 'command-center';

/** Alias kept for call sites that read as "…destination id". */
export const DEFAULT_STUDIO_DESTINATION_ID = DEFAULT_STUDIO_DESTINATION;

/** Registry entry alias. */
export type StudioDestination = StudioDestinationEntry;

/** Every Studio_Destination, in the order this document defines them. */
export const STUDIO_DESTINATIONS: readonly StudioDestinationEntry[] = [
  {
    id: 'command-center',
    label: 'Command Center',
    icon: LayoutGrid,
    kind: 'overview',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'mixed',
    description: 'Hero preview, metrics, workflows, live queue, and recent projects.',
    view: { subtab: 'studio' },
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderOpen,
    kind: 'management',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'mixed',
    description: 'Authorized AI media projects and their details.',
    view: { subtab: 'studio' },
  },
  {
    id: 'queue',
    label: 'Queue',
    icon: ListChecks,
    kind: 'management',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'mixed',
    description: 'Active and recently finished AI jobs.',
    view: { subtab: 'studio' },
  },
  {
    id: 'metrics',
    label: 'Metrics',
    icon: BarChart3,
    kind: 'management',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'none',
    description: 'Server-calculated Studio activity for the last 30 days.',
    view: { subtab: 'studio' },
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: LayoutTemplate,
    kind: 'management',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'mixed',
    description: 'Reusable workflow configurations shared across the team.',
    view: { subtab: 'studio' },
  },
  {
    id: 'brand',
    label: 'Brand',
    icon: Palette,
    kind: 'management',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'none',
    description: 'Approved brand assets and presentation options.',
    view: { subtab: 'studio' },
  },
  {
    id: 'photo-enhancement',
    label: 'Photo Enhancement',
    icon: Sparkles,
    kind: 'workflow',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'photo',
    description: 'Enhance exposure, colour, and verticals on property photos.',
    workflowId: 'photo-enhancement',
    view: { subtab: 'photo', photoCapability: 'workspace', photoMode: 'enhance' },
  },
  {
    id: 'twilight',
    label: 'Twilight',
    icon: Sun,
    kind: 'workflow',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'photo',
    description: 'Replace daytime skies with twilight skies.',
    workflowId: 'twilight',
    view: { subtab: 'photo', photoCapability: 'workspace', photoMode: 'sky_replace' },
  },
  {
    id: 'video-cleanup',
    label: 'Video Cleanup',
    icon: Video,
    kind: 'workflow',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'video',
    description: 'Stabilise and clean up walkthrough footage.',
    workflowId: 'video-cleanup',
    view: { subtab: 'video', videoCapability: 'cleanup' },
  },
  {
    id: 'listing-video',
    label: 'Listing Video',
    icon: Film,
    kind: 'workflow',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'video',
    description: 'Build a narrated listing video from shoot media.',
    workflowId: 'listing-video',
    view: { subtab: 'video', videoCapability: 'listing' },
  },
  {
    id: 'reel-generator',
    label: 'Reel Generator',
    icon: Images,
    kind: 'workflow',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'video',
    description: 'Generate short social reels from property media.',
    workflowId: 'reel-generator',
    view: { subtab: 'video', videoCapability: 'reel' },
  },
  {
    id: 'batch-ai-jobs',
    label: 'Batch AI Jobs',
    icon: Layers,
    kind: 'workflow',
    permission: STUDIO_VIEW_PERMISSION,
    mediaType: 'photo',
    description: 'Submit up to 100 photos through one AI job batch.',
    workflowId: 'batch-ai-jobs',
    view: { subtab: 'photo', photoCapability: 'batch' },
  },
];

/** Registry lookup by destination id. */
export const STUDIO_DESTINATION_BY_ID = STUDIO_DESTINATIONS.reduce(
  (map, entry) => {
    map[entry.id] = entry;

    return map;
  },
  {} as Record<StudioDestinationId, StudioDestinationEntry>,
);

/** The six launchable Workflow destinations, in registry order. */
export const STUDIO_WORKFLOW_DESTINATIONS: readonly StudioDestinationEntry[] =
  STUDIO_DESTINATIONS.filter((entry) => entry.kind === 'workflow');

export function isStudioDestinationId(value: unknown): value is StudioDestinationId {
  return (
    typeof value === 'string' &&
    (STUDIO_DESTINATION_IDS as readonly string[]).includes(value)
  );
}

/** Registry entry for `id`, falling back to the Command_Center entry. */
export function getStudioDestination(id: string | null | undefined): StudioDestinationEntry {
  if (isStudioDestinationId(id)) return STUDIO_DESTINATION_BY_ID[id];

  return STUDIO_DESTINATION_BY_ID[DEFAULT_STUDIO_DESTINATION];
}

export function isStudioWorkflowId(value: unknown): value is WorkflowId {
  return (
    typeof value === 'string' && (STUDIO_WORKFLOW_IDS as readonly string[]).includes(value)
  );
}

/** The destination that owns `workflowId`, when one exists. */
export function getWorkflowDestination(
  workflowId: string | null | undefined,
): StudioDestinationEntry | null {
  return (
    STUDIO_WORKFLOW_DESTINATIONS.find((entry) => entry.workflowId === workflowId) ?? null
  );
}

/** Existing shell subtab derived from the active destination. */
export function deriveActiveSubtab(id: string | null | undefined): StudioSubtab {
  return getStudioDestination(id).view.subtab;
}

/** Existing in-subtab photo capability derived from the active destination. */
export function derivePhotoCapability(id: string | null | undefined): PhotoCapability {
  return getStudioDestination(id).view.photoCapability ?? 'workspace';
}

/** Existing in-subtab video capability derived from the active destination. */
export function deriveVideoCapability(id: string | null | undefined): VideoCapability {
  return getStudioDestination(id).view.videoCapability ?? 'listing';
}

/**
 * Destination → existing `RouteTarget`, so card/template/recent-project routing
 * can keep speaking the page's established navigation shape.
 */
export function destinationToRouteTarget(
  id: string | null | undefined,
  shoot?: StudioShootRef,
): RouteTarget {
  const { view } = getStudioDestination(id);

  return {
    subtab: view.subtab,
    ...(view.photoMode ? { photoMode: view.photoMode } : {}),
    ...(view.photoCapability ? { photoCapability: view.photoCapability } : {}),
    ...(view.videoCapability ? { videoCapability: view.videoCapability } : {}),
    ...(shoot ? { shoot } : {}),
  };
}

/**
 * Existing `RouteTarget` → destination id. Photo/video targets map onto their
 * Workflow destination; a `studio` target maps onto the Command_Center, since the
 * management destinations (Projects/Queue/Metrics/Templates/Brand) render inside
 * the studio subtab and are not expressible as a legacy RouteTarget.
 */
export function routeTargetToDestination(target: RouteTarget): StudioDestinationId {
  if (target.subtab === 'photo') {
    if (target.photoCapability === 'batch') return 'batch-ai-jobs';

    return target.photoMode === 'sky_replace' ? 'twilight' : 'photo-enhancement';
  }

  if (target.subtab === 'video') {
    if (target.videoCapability === 'reel') return 'reel-generator';
    if (target.videoCapability === 'cleanup') return 'video-cleanup';

    return 'listing-video';
  }

  return DEFAULT_STUDIO_DESTINATION;
}

/** Alias of `routeTargetToDestination` for call sites that read id-first. */
export const destinationIdFromRouteTarget = routeTargetToDestination;

/**
 * Destination opened when a subtab is selected and the shell has no memory of a
 * destination for it. Mirrors the page's previous in-subtab defaults
 * (`photoCapability: 'workspace'`, `videoCapability: 'listing'`).
 */
export const DEFAULT_DESTINATION_BY_SUBTAB: Record<StudioSubtab, StudioDestinationId> = {
  studio: 'command-center',
  photo: 'photo-enhancement',
  video: 'listing-video',
};

export function defaultDestinationForSubtab(subtab: StudioSubtab): StudioDestinationId {
  return DEFAULT_DESTINATION_BY_SUBTAB[subtab] ?? DEFAULT_STUDIO_DESTINATION;
}
