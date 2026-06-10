/**
 * Shared types for the Studio Landing components (ai-editing-default-page).
 *
 * These mirror the navigation model defined in `frontend/src/pages/AiEditing.tsx`
 * so the Studio shell can pass `routeToCapability` and the active-subtab state
 * down to the landing without coupling the components to the page module.
 */

// Enhancement modes preselectable from a feature card / template.
export type EnhancementModeId =
  | 'enhance'
  | 'sky_replace'
  | 'vertical_correction'
  | 'window_pull';

// Top-level Studio shell selector.
export type StudioSubtab = 'studio' | 'photo' | 'video';

// Which capability is active within a Subtab when arriving from a card/template.
export type PhotoCapability = 'workspace' | 'batch'; // batch = Batch_Jobs_Feature
export type VideoCapability = 'listing' | 'cleanup' | 'reel'; // reel = Reel_Generator_Feature

/**
 * A minimal shoot reference used for Recent Projects deep-links. Kept loose so
 * it stays compatible with the richer `ShootWithEditing` shape used by the page.
 */
export interface StudioShootRef {
  id: number;
  address: string;
  [key: string]: unknown;
}

// Centralized routing target for card/template/recent-project navigation.
export interface RouteTarget {
  subtab: StudioSubtab;
  photoMode?: EnhancementModeId; // preselect enhancement (enhance | sky_replace | ...)
  photoCapability?: PhotoCapability; // 'batch' opens Batch_Jobs_Feature
  videoCapability?: VideoCapability; // 'reel' | 'cleanup' | 'listing'
  shoot?: StudioShootRef; // used by Recent Projects deep-link
}

export type RouteToCapability = (target: RouteTarget) => void;
