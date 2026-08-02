/**
 * Workflow_Gallery data and pure logic (ai-editing-studio-revamp, task 13.1).
 *
 * The six Workflow_Cards are derived from the Studio_Destination registry
 * (`destinations.ts`), so the gallery lists exactly the six launchable workflows
 * by construction (Req 5.1) and each card's launch control routes to that
 * workflow's functional destination (Req 5.5).
 *
 * This module is intentionally pure (no React, no DOM) so filtering, availability
 * resolution, and the preview-asset mapping can be exercised directly by the
 * property tests in tasks 13.2–13.4.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8, 5.9
 */

import type { LucideIcon } from 'lucide-react';

import {
  STUDIO_WORKFLOW_DESTINATIONS,
  destinationToRouteTarget,
  type StudioDestinationEntry,
  type WorkflowId,
} from './destinations';
import type { RouteTarget } from './types';

/** Media a Workflow operates on — the primary Workflow_Filter dimension. */
export type WorkflowMediaType = 'photo' | 'video';

/** Capability category — the second Workflow_Filter dimension. */
export type WorkflowCategory = 'enhancement' | 'production' | 'batch';

export interface WorkflowGalleryItem {
  /** Workflow id, identical to its Studio_Destination id. */
  id: WorkflowId;
  /** Legacy Feature_Card id, preserved for existing call sites and tests. */
  cardId: string;
  title: string;
  /** Concise outcome description (Req 5.2). */
  description: string;
  mediaType: WorkflowMediaType;
  /** Human label for the supported media type (Req 5.2). */
  mediaTypeLabel: string;
  category: WorkflowCategory;
  categoryLabel: string;
  icon: LucideIcon;
  /** Alt text used for the preview image / placeholder. */
  previewAlt: string;
  /** Existing route target for the workflow's functional destination (Req 5.5). */
  target: RouteTarget;
}

const OUTCOME_DESCRIPTIONS: Record<WorkflowId, string> = {
  'photo-enhancement':
    'Brighten, balance, and polish listing photos with one-tap AI enhancement.',
  twilight: 'Convert daytime exteriors into striking twilight shots with sky replacement.',
  'video-cleanup': 'Stabilize and clean up walkthrough footage for a polished result.',
  'listing-video': 'Build a branded listing video from a shoot’s photos and clips.',
  'reel-generator': 'Generate short-form vertical reels from a shoot’s media in seconds.',
  'batch-ai-jobs': 'Run an enhancement across every photo in a shoot in a single batch.',
};

const LEGACY_CARD_IDS: Record<WorkflowId, string> = {
  'photo-enhancement': 'Photo_Enhancement_Card',
  twilight: 'Twilight_Card',
  'video-cleanup': 'Video_Cleanup_Card',
  'listing-video': 'Listing_Video_Card',
  'reel-generator': 'Reel_Generator_Card',
  'batch-ai-jobs': 'Batch_Jobs_Card',
};

const MEDIA_TYPES: Record<WorkflowId, WorkflowMediaType> = {
  'photo-enhancement': 'photo',
  twilight: 'photo',
  'video-cleanup': 'video',
  'listing-video': 'video',
  'reel-generator': 'video',
  'batch-ai-jobs': 'photo',
};

const CATEGORIES: Record<WorkflowId, WorkflowCategory> = {
  'photo-enhancement': 'enhancement',
  twilight: 'enhancement',
  'video-cleanup': 'enhancement',
  'listing-video': 'production',
  'reel-generator': 'production',
  'batch-ai-jobs': 'batch',
};

const MEDIA_TYPE_LABELS: Record<WorkflowMediaType, string> = {
  photo: 'Photo',
  video: 'Video',
};

const CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  enhancement: 'Enhancement',
  production: 'Video production',
  batch: 'Batch',
};

const PREVIEW_ALT: Record<WorkflowId, string> = {
  'photo-enhancement': 'Enhanced property interior preview for Photo Enhancement',
  twilight: 'Twilight exterior preview for the Twilight workflow',
  'video-cleanup': 'Stabilised walkthrough frame preview for Video Cleanup',
  'listing-video': 'Branded listing video frame preview for Listing Video',
  'reel-generator': 'Vertical property reel frame preview for Reel Generator',
  'batch-ai-jobs': 'Grid of enhanced property photos preview for Batch AI Jobs',
};

const toGalleryItem = (entry: StudioDestinationEntry): WorkflowGalleryItem => {
  const id = entry.workflowId as WorkflowId;
  const mediaType = MEDIA_TYPES[id];
  const category = CATEGORIES[id];

  return {
    id,
    cardId: LEGACY_CARD_IDS[id],
    title: entry.label,
    description: OUTCOME_DESCRIPTIONS[id],
    mediaType,
    mediaTypeLabel: MEDIA_TYPE_LABELS[mediaType],
    category,
    categoryLabel: CATEGORY_LABELS[category],
    icon: entry.icon,
    previewAlt: PREVIEW_ALT[id],
    target: destinationToRouteTarget(entry.id),
  };
};

/** The six Workflow_Cards, in destination-registry order (Req 5.1). */
export const WORKFLOW_GALLERY_ITEMS: readonly WorkflowGalleryItem[] =
  STUDIO_WORKFLOW_DESTINATIONS.map(toGalleryItem);

export const WORKFLOW_GALLERY_ITEM_BY_ID = WORKFLOW_GALLERY_ITEMS.reduce(
  (map, item) => {
    map[item.id] = item;

    return map;
  },
  {} as Record<WorkflowId, WorkflowGalleryItem>,
);

/**
 * Preview images assigned to each Workflow_Card.
 *
 * Every value stays `null` until the Asset_Integration_Process (task 19) stores
 * the Generated_Property_Images in application-controlled asset storage; the card
 * renders its media-type placeholder in the meantime (Req 5.8, 17.x). When an
 * asset lands, its value must be an application asset path — never a remote
 * temporary URL.
 */
export const WORKFLOW_PREVIEW_ASSETS: Record<WorkflowId, string | null> = {
  'photo-enhancement': null,
  twilight: null,
  'video-cleanup': null,
  'listing-video': null,
  'reel-generator': null,
  'batch-ai-jobs': null,
};

/** Preview source for a workflow, honoring a caller-supplied override map. */
export function resolveWorkflowPreview(
  id: WorkflowId,
  overrides?: Partial<Record<WorkflowId, string | null>>,
): string | null {
  const override = overrides?.[id];
  if (override !== undefined) return override;

  return WORKFLOW_PREVIEW_ASSETS[id] ?? null;
}

/** A selectable Workflow_Filter criterion (Req 5.3). */
export type WorkflowFilterId =
  | 'media:photo'
  | 'media:video'
  | 'category:enhancement'
  | 'category:production'
  | 'category:batch';

export interface WorkflowFilterOption {
  id: WorkflowFilterId;
  label: string;
  group: 'media' | 'category';
}

export const WORKFLOW_FILTER_OPTIONS: readonly WorkflowFilterOption[] = [
  { id: 'media:photo', label: 'Photo', group: 'media' },
  { id: 'media:video', label: 'Video', group: 'media' },
  { id: 'category:enhancement', label: 'Enhancement', group: 'category' },
  { id: 'category:production', label: 'Video production', group: 'category' },
  { id: 'category:batch', label: 'Batch', group: 'category' },
];

export const WORKFLOW_FILTER_IDS: readonly WorkflowFilterId[] = WORKFLOW_FILTER_OPTIONS.map(
  (option) => option.id,
);

export function isWorkflowFilterId(value: unknown): value is WorkflowFilterId {
  return typeof value === 'string' && (WORKFLOW_FILTER_IDS as readonly string[]).includes(value);
}

/** Whether one card satisfies one filter criterion. */
export function workflowMatchesFilter(
  item: WorkflowGalleryItem,
  filter: WorkflowFilterId,
): boolean {
  switch (filter) {
    case 'media:photo':
      return item.mediaType === 'photo';
    case 'media:video':
      return item.mediaType === 'video';
    case 'category:enhancement':
      return item.category === 'enhancement';
    case 'category:production':
      return item.category === 'production';
    case 'category:batch':
      return item.category === 'batch';
    default:
      return false;
  }
}

/**
 * Cards that satisfy **every** selected criterion (Req 5.3). With no filter
 * selected the full authorized set is returned unchanged (Req 5.4).
 */
export function filterWorkflowItems(
  items: readonly WorkflowGalleryItem[],
  filters: readonly WorkflowFilterId[],
): WorkflowGalleryItem[] {
  if (filters.length === 0) return [...items];

  return items.filter((item) => filters.every((filter) => workflowMatchesFilter(item, filter)));
}

/** Toggles one criterion in a selection, preserving filter-option order. */
export function toggleWorkflowFilter(
  filters: readonly WorkflowFilterId[],
  filter: WorkflowFilterId,
): WorkflowFilterId[] {
  const next = filters.includes(filter)
    ? filters.filter((entry) => entry !== filter)
    : [...filters, filter];

  return WORKFLOW_FILTER_IDS.filter((id) => next.includes(id));
}

/** Availability of a Workflow to the requesting Client (Req 5.9, 3.6). */
export interface WorkflowAvailability {
  available: boolean;
  /** Server-provided reason, present when `available` is false (Req 5.9). */
  reason: string | null;
}

export type WorkflowAvailabilityMap = Partial<Record<WorkflowId, WorkflowAvailability>>;

/**
 * Used only when the server supplied no reason for an unavailable workflow, so a
 * card never shows "Unavailable" without an explanation.
 */
export const DEFAULT_WORKFLOW_UNAVAILABLE_REASON =
  'Your role doesn’t include AI editing access for this workflow.';

export interface ResolveWorkflowAvailabilityOptions {
  /** Server-provided availability per workflow; takes precedence when present. */
  availability?: WorkflowAvailabilityMap;
  /** Existing role gate used when the server supplied no per-workflow state. */
  canLaunch?: boolean;
  /** Reason shown when an unavailable workflow carries no server reason. */
  fallbackReason?: string;
}

export function resolveWorkflowAvailability(
  id: WorkflowId,
  {
    availability,
    canLaunch = false,
    fallbackReason = DEFAULT_WORKFLOW_UNAVAILABLE_REASON,
  }: ResolveWorkflowAvailabilityOptions = {},
): WorkflowAvailability {
  const provided = availability?.[id];
  const available = provided ? provided.available : canLaunch;

  if (available) return { available: true, reason: null };

  const reason = provided?.reason?.trim();

  return { available: false, reason: reason && reason.length > 0 ? reason : fallbackReason };
}
