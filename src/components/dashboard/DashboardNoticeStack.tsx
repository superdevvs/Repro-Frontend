import React, {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

/**
 * Stacks the dashboard header notices (upload / needs-submission, cancellations
 * pending, email verification, ...) into a single deck instead of laying them
 * out side by side.
 *
 * Behaviour:
 * - 0 or 1 visible notice  -> renders inline exactly like before (no chrome).
 * - 2+ visible notices     -> only the front notice is fully shown, the rest sit
 *                             behind it, auto-advancing every 7s. Hovering or
 *                             focusing pauses the rotation, the mouse wheel and
 *                             the dot rail move through the deck manually.
 *
 * Children that render nothing (a component returning `null`, a falsy branch, or
 * a component that only renders fixed/portal overlays) are detected at runtime
 * and never take a slot in the deck.
 */

const DEFAULT_ROTATE_MS = 7000;
/** Wheel delta that has to accumulate before the deck advances one card. */
const WHEEL_STEP_THRESHOLD = 18;
/** Minimum gap between two wheel-driven steps, keeps one flick from flying through the deck. */
const WHEEL_COOLDOWN_MS = 260;
/** Vertical peek of each card sitting behind the front one. */
const LAYER_OFFSET_PX = 7;
const LAYER_SCALE_STEP = 0.04;
/** Cards rendered behind the front card; deeper cards fade out completely. */
const MAX_PEEK_LAYERS = 2;

type LayerMetrics = {
  /** The child rendered actual DOM (survives `display: none` on the container). */
  hasContent: boolean;
  /** In-flow height. Zero for children that only render fixed/portal overlays. */
  height: number;
};

const EMPTY_METRICS: LayerMetrics = { hasContent: false, height: 0 };

const sameMetrics = (a: LayerMetrics[], b: LayerMetrics[]): boolean =>
  a.length === b.length &&
  a.every((entry, index) => entry.hasContent === b[index].hasContent && entry.height === b[index].height);

export interface DashboardNoticeStackProps {
  children: React.ReactNode;
  /** Accessible name for the deck, announced once two or more notices stack up. */
  label?: string;
  /** Auto-advance interval in milliseconds. */
  intervalMs?: number;
  /** Extra classes for the outer wrapper (replaces the old header action row). */
  className?: string;
  /** Deck footprint once two or more notices stack up. */
  stackWidthClassName?: string;
  /** Stretch every visible layer to the tallest notice without changing single-notice layouts. */
  equalizeLayerHeights?: boolean;
}

export const DashboardNoticeStack: React.FC<DashboardNoticeStackProps> = ({
  children,
  label = 'Dashboard notices',
  intervalMs = DEFAULT_ROTATE_MS,
  className,
  stackWidthClassName = 'w-full sm:w-[19rem]',
  equalizeLayerHeights = false,
}) => {
  // `Children.toArray` already drops null / false / undefined branches. Children
  // that *render* nothing are filtered later, from measurements.
  const items = useMemo(() => Children.toArray(children), [children]);
  const itemCount = items.length;

  const prefersReducedMotion = useReducedMotion();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const layerRefs = useRef<Array<HTMLDivElement | null>>([]);
  layerRefs.current.length = itemCount;

  const [metrics, setMetrics] = useState<LayerMetrics[]>(() => items.map(() => EMPTY_METRICS));
  const [activeItem, setActiveItem] = useState(0);
  const [paused, setPaused] = useState(false);

  const syncMetrics = useCallback(() => {
    setMetrics((previous) => {
      const next = layerRefs.current.map<LayerMetrics>((node) => {
        if (!node) return EMPTY_METRICS;
        const content = node.firstElementChild as HTMLElement | null;
        return {
          hasContent: node.childElementCount > 0 || Boolean(node.textContent?.trim()),
          height: Math.max(
            node.offsetHeight,
            node.scrollHeight,
            content?.offsetHeight ?? 0,
            content?.scrollHeight ?? 0,
          ),
        };
      });
      return sameMetrics(previous, next) ? previous : next;
    });
  }, []);

  // Re-measure on every commit of this component. Cheap, and bails out of the
  // state update when nothing moved.
  useLayoutEffect(() => {
    syncMetrics();
  });

  // Children re-render on their own (upload context, email health, ...) without
  // re-rendering this component, so observers do the heavy lifting.
  useEffect(() => {
    const nodes = layerRefs.current.filter((node): node is HTMLDivElement => Boolean(node));
    if (nodes.length === 0) return;

    const observers: Array<{ disconnect: () => void }> = [];

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => syncMetrics());
      nodes.forEach((node) => resizeObserver.observe(node));
      observers.push(resizeObserver);
    }

    // A collapsed deck is `display: none`, where ResizeObserver stays silent.
    // Watching the subtree catches content coming back.
    if (typeof MutationObserver !== 'undefined' && containerRef.current) {
      const mutationObserver = new MutationObserver(() => syncMetrics());
      mutationObserver.observe(containerRef.current, { childList: true, subtree: true });
      observers.push(mutationObserver);
    }

    return () => observers.forEach((observer) => observer.disconnect());
  }, [itemCount, syncMetrics]);

  const hasAnyContent = metrics.some((entry) => entry.hasContent);

  const presentIndices = useMemo(() => {
    const result: number[] = [];
    for (let index = 0; index < itemCount; index += 1) {
      const entry = metrics[index];
      if (entry?.hasContent && entry.height > 0) result.push(index);
    }
    return result;
  }, [itemCount, metrics]);

  const presentCount = presentIndices.length;
  const isDeck = presentCount > 1;
  // Candidate layers must be measured at their final deck width. Measuring
  // them side by side first makes responsive notices wrap, inflating the
  // remembered tallest height before the actual deck is composed.
  const usesLayerLayout = itemCount > 1;

  const presentIndicesRef = useRef(presentIndices);
  presentIndicesRef.current = presentIndices;

  const activeIndex = presentIndices.includes(activeItem) ? activeItem : (presentIndices[0] ?? 0);
  const activePosition = Math.max(0, presentIndices.indexOf(activeIndex));

  const step = useCallback((direction: number) => {
    setActiveItem((current) => {
      const list = presentIndicesRef.current;
      if (list.length < 2) return current;
      const currentPosition = list.indexOf(current);
      const basePosition = currentPosition === -1 ? 0 : currentPosition;
      const nextPosition = (basePosition + direction + list.length) % list.length;
      return list[nextPosition];
    });
  }, []);

  // Auto-advance. Reduced-motion users get a static deck they drive themselves.
  useEffect(() => {
    if (!isDeck || paused || prefersReducedMotion) return;
    const timer = window.setInterval(() => step(1), Math.max(1500, intervalMs));
    return () => window.clearInterval(timer);
  }, [isDeck, paused, prefersReducedMotion, intervalMs, step]);

  // Mouse wheel moves through the deck instead of scrolling the page.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !isDeck) return;

    let accumulated = 0;
    let lastStepAt = 0;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const now = Date.now();
      if (now - lastStepAt < WHEEL_COOLDOWN_MS) return;
      accumulated += Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(accumulated) < WHEEL_STEP_THRESHOLD) return;
      const direction = accumulated > 0 ? 1 : -1;
      accumulated = 0;
      lastStepAt = now;
      step(direction);
    };

    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [isDeck, step]);

  // Keep the cards behind the front one out of the tab order and off the
  // accessibility tree.
  useLayoutEffect(() => {
    layerRefs.current.forEach((node, index) => {
      if (!node) return;
      (node as HTMLDivElement & { inert: boolean }).inert = isDeck && index !== activeIndex;
    });
  });

  const peekLayers = Math.min(MAX_PEEK_LAYERS, Math.max(0, presentCount - 1));
  const tallestLayer = presentIndices.reduce(
    (tallest, index) => Math.max(tallest, metrics[index]?.height ?? 0),
    0,
  );
  const deckHeight = tallestLayer > 0 ? tallestLayer + peekLayers * LAYER_OFFSET_PX : undefined;

  const getLayerStyle = (index: number): React.CSSProperties | undefined => {
    if (!isDeck) return undefined;

    const position = presentIndices.indexOf(index);
    if (position === -1) {
      return { opacity: 0, zIndex: 0, pointerEvents: 'none' };
    }

    const depth = (position - activePosition + presentCount) % presentCount;
    const visualDepth = Math.min(depth, MAX_PEEK_LAYERS);

    return {
      transform: `translate3d(0, ${visualDepth * LAYER_OFFSET_PX}px, 0) scale(${1 - visualDepth * LAYER_SCALE_STEP})`,
      transformOrigin: 'top center',
      opacity: depth > MAX_PEEK_LAYERS ? 0 : 1 - visualDepth * 0.28,
      zIndex: presentCount - depth,
    };
  };

  const handleDotKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  };

  return (
    <div
      ref={containerRef}
      role={isDeck ? 'group' : undefined}
      aria-label={isDeck ? label : undefined}
      aria-roledescription={isDeck ? 'notice deck' : undefined}
      className={cn('flex items-center gap-1.5', !hasAnyContent && 'hidden', className)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className={cn(usesLayerLayout ? cn('relative min-w-0', stackWidthClassName) : 'flex min-w-0 items-center')}
        style={usesLayerLayout && deckHeight ? { height: deckHeight } : undefined}
      >
        {items.map((item, index) => (
          <div
            // Positional keys: `Children.toArray` already emits positional keys,
            // so this matches the identity React would use anyway.
            key={index}
            ref={(node) => {
              layerRefs.current[index] = node;
            }}
            aria-hidden={isDeck && index !== activeIndex ? true : undefined}
            className={cn(
              usesLayerLayout && 'absolute inset-x-0 top-0',
              isDeck && index !== activeIndex && 'pointer-events-none',
              isDeck && equalizeLayerHeights && '[&>*]:h-full',
              isDeck && !prefersReducedMotion && 'transition-[transform,opacity] duration-500 ease-out',
            )}
            style={{
              ...getLayerStyle(index),
              ...(isDeck && equalizeLayerHeights && tallestLayer > 0
                ? { height: tallestLayer }
                : {}),
            }}
          >
            {item}
          </div>
        ))}
      </div>

      {isDeck && (
        <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
          {presentIndices.map((itemIndex, position) => {
            const isActive = itemIndex === activeIndex;
            return (
              <button
                key={itemIndex}
                type="button"
                onClick={() => setActiveItem(itemIndex)}
                onKeyDown={handleDotKeyDown}
                aria-label={`Show notice ${position + 1} of ${presentCount}`}
                aria-current={isActive ? true : undefined}
                className="grid h-4 w-4 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    'block w-1.5 rounded-full transition-all duration-300',
                    isActive ? 'h-3 bg-primary' : 'h-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70',
                  )}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardNoticeStack;
