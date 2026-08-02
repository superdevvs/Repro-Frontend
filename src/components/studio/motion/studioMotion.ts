/**
 * Motion primitives for the Studio (ai-editing-studio-revamp, task 16.1 — Req 11.9).
 *
 * Studio sections describe motion by preset instead of hand-rolling Framer
 * Motion props. When a motion-reduction preference is active every non-essential
 * transition collapses to an immediate state change: no enter offset, no
 * duration, no delay — the element simply renders in its final state.
 */

import type { Transition } from 'framer-motion';

import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Non-essential entrance/state transitions used across the Studio. */
export type StudioMotionPreset = 'fade' | 'rise' | 'scale';

export interface StudioMotionProps {
  initial: false | Record<string, number>;
  animate: Record<string, number>;
  transition: Transition;
}

const PRESETS: Record<StudioMotionPreset, { from: Record<string, number>; to: Record<string, number> }> =
  {
    fade: { from: { opacity: 0 }, to: { opacity: 1 } },
    rise: { from: { opacity: 0, y: 8 }, to: { opacity: 1, y: 0 } },
    scale: { from: { opacity: 0, scale: 0.98 }, to: { opacity: 1, scale: 1 } },
  };

export interface StudioMotionOptions {
  /** Seconds the transition runs when motion is allowed. */
  duration?: number;
  /** Seconds before the transition starts when motion is allowed. */
  delay?: number;
}

/** A transition that is instantaneous when motion is reduced. */
export function studioTransition(
  prefersReducedMotion: boolean,
  { duration = 0.25, delay = 0 }: StudioMotionOptions = {},
): Transition {
  if (prefersReducedMotion) {
    return { duration: 0, delay: 0 };
  }
  return { duration, delay, ease: 'easeOut' };
}

/**
 * Framer Motion props for a preset. With reduced motion the element starts in
 * its final state (`initial: false`) and the transition has no duration, so the
 * change is applied immediately rather than animated.
 */
export function studioMotionProps(
  preset: StudioMotionPreset,
  prefersReducedMotion: boolean,
  options: StudioMotionOptions = {},
): StudioMotionProps {
  const { from, to } = PRESETS[preset];
  return {
    initial: prefersReducedMotion ? false : from,
    animate: to,
    transition: studioTransition(prefersReducedMotion, options),
  };
}

/** True when the motion props describe an immediate (non-animated) change. */
export function isImmediateMotion(props: StudioMotionProps): boolean {
  const transition = props.transition as { duration?: number; delay?: number };
  return props.initial === false && transition.duration === 0 && (transition.delay ?? 0) === 0;
}

/** Hook form of {@link studioMotionProps}, reading the live user preference. */
export function useStudioMotion(
  preset: StudioMotionPreset,
  options: StudioMotionOptions = {},
): StudioMotionProps {
  const prefersReducedMotion = useReducedMotion();
  return studioMotionProps(preset, prefersReducedMotion, options);
}
