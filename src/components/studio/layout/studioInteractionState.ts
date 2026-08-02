/**
 * Interaction state that must survive responsive reflow
 * (ai-editing-studio-revamp, task 16.1 — Req 11.7).
 *
 * Reflow between the `<768`, `768–1279`, and `>=1280` ranges is a *presentation*
 * change: it may only update `viewportWidth`/`layoutMode`. Active Workflow
 * filters, the selected Studio_Record, pending Source_Media, and Project_Launcher
 * state are held here — outside the responsive markup — so no breakpoint change
 * can clear them. The reducer is pure so the guarantee is directly testable.
 */

import { resolveStudioLayoutMode, type StudioLayoutMode } from './studioLayoutLogic';

/** Project_Launcher state preserved across reflow. */
export interface StudioLauncherState {
  isOpen: boolean;
  workflowId: string | null;
}

/** Studio interaction state preserved across reflow. */
export interface StudioInteractionState {
  viewportWidth: number;
  layoutMode: StudioLayoutMode;
  /** Active Workflow_Filter ids. */
  filters: readonly string[];
  /** Selected Studio_Record, as `type:id`, or `null`. */
  selectedRecordId: string | null;
  /** Ids of pending Source_Media not yet submitted. */
  pendingSourceMedia: readonly string[];
  launcher: StudioLauncherState;
}

/** Fields the reducer must never change on a viewport change (Req 11.7). */
export const STUDIO_PRESERVED_INTERACTION_KEYS = Object.freeze([
  'filters',
  'selectedRecordId',
  'pendingSourceMedia',
  'launcher',
] as const);

export type StudioInteractionAction =
  | { type: 'viewport/resize'; width: number }
  | { type: 'filters/set'; filters: readonly string[] }
  | { type: 'filters/clear' }
  | { type: 'record/select'; recordId: string | null }
  | { type: 'pendingMedia/set'; mediaIds: readonly string[] }
  | { type: 'pendingMedia/remove'; mediaId: string }
  | { type: 'launcher/open'; workflowId?: string | null }
  | { type: 'launcher/close' }
  | { type: 'launcher/selectWorkflow'; workflowId: string | null };

/** Initial state for a viewport width (defaults to a single-column viewport). */
export function createStudioInteractionState(viewportWidth = 0): StudioInteractionState {
  return {
    viewportWidth,
    layoutMode: resolveStudioLayoutMode(viewportWidth),
    filters: [],
    selectedRecordId: null,
    pendingSourceMedia: [],
    launcher: { isOpen: false, workflowId: null },
  };
}

export function studioInteractionReducer(
  state: StudioInteractionState,
  action: StudioInteractionAction,
): StudioInteractionState {
  switch (action.type) {
    case 'viewport/resize': {
      const layoutMode = resolveStudioLayoutMode(action.width);
      if (state.viewportWidth === action.width && state.layoutMode === layoutMode) {
        return state;
      }
      // Presentation-only: every preserved interaction field is carried over
      // by reference so reflow cannot reset it (Req 11.7).
      return { ...state, viewportWidth: action.width, layoutMode };
    }
    case 'filters/set':
      return { ...state, filters: [...action.filters] };
    case 'filters/clear':
      return state.filters.length === 0 ? state : { ...state, filters: [] };
    case 'record/select':
      return { ...state, selectedRecordId: action.recordId };
    case 'pendingMedia/set':
      return { ...state, pendingSourceMedia: [...action.mediaIds] };
    case 'pendingMedia/remove':
      return {
        ...state,
        pendingSourceMedia: state.pendingSourceMedia.filter((id) => id !== action.mediaId),
      };
    case 'launcher/open':
      return {
        ...state,
        launcher: {
          isOpen: true,
          workflowId: action.workflowId ?? state.launcher.workflowId,
        },
      };
    case 'launcher/close':
      return { ...state, launcher: { ...state.launcher, isOpen: false } };
    case 'launcher/selectWorkflow':
      return { ...state, launcher: { ...state.launcher, workflowId: action.workflowId } };
    default:
      return state;
  }
}

/** True when both states carry identical preserved interaction fields. */
export function hasSameStudioInteractionState(
  a: StudioInteractionState,
  b: StudioInteractionState,
): boolean {
  return (
    a.selectedRecordId === b.selectedRecordId &&
    a.launcher.isOpen === b.launcher.isOpen &&
    a.launcher.workflowId === b.launcher.workflowId &&
    a.filters.length === b.filters.length &&
    a.filters.every((filter, index) => filter === b.filters[index]) &&
    a.pendingSourceMedia.length === b.pendingSourceMedia.length &&
    a.pendingSourceMedia.every((media, index) => media === b.pendingSourceMedia[index])
  );
}
