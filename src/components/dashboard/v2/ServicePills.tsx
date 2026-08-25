import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getIconComponent } from '@/components/scheduling/IconPicker';
import { SERVICE_ICON_MAP, SERVICE_LABELS, getServiceKey } from './shootsTabsCardUtils';

/**
 * Viewport band where the dashboard centre column is narrow enough that the
 * service pills no longer fit on one line, but still wide enough that the row
 * has not collapsed to the stacked mobile card. Inside this band the pills
 * collapse to a single line with a "+N more" chip rather than wrapping.
 */
export const PILL_TRUNCATE_QUERY = '(min-width: 1420px) and (max-width: 1500px)';

/** Narrowest a text-clipped pill is allowed to get before it stops being readable. */
const MIN_ELLIPSIS_PILL_WIDTH = 64;

export type ServicePillItem = { label: string; type?: string; icon?: string };

interface ServicePillsProps {
  shootId: number | string;
  items: ServicePillItem[];
  /** `compact` is the stacked mobile card, `desktop` the three-column row. */
  variant: 'compact' | 'desktop';
  /**
   * Whether this row participates in the narrow-band truncation. The compact
   * card owns its full width, so it only needs the non-shrinking pills.
   */
  truncateInBand?: boolean;
  /**
   * The two card families disagree on label precedence: the shoots tabs card
   * prefers the mapped label, the upcoming card prefers the raw tag. Kept as a
   * flag so neither one's wording changes.
   */
  preferMappedLabel?: boolean;
}

interface FitResult {
  /** How many pills to render, or `null` for all of them. */
  count: number | null;
  /** Set when a single pill has to be text-clipped because none fit whole. */
  firstMaxWidth: number | null;
}

const SHOW_ALL: FitResult = { count: null, firstMaxWidth: null };

/**
 * Service tags for a shoot card.
 *
 * Pills are always `shrink-0 whitespace-nowrap`. Without that a pill wider than
 * the row shrinks and wraps its own label into a two-line blob, which is what
 * the narrow dashboard column used to produce.
 */
export const ServicePills: React.FC<ServicePillsProps> = ({
  shootId,
  items,
  variant,
  truncateInBand = true,
  preferMappedLabel = false,
}) => {
  const isCompact = variant === 'compact';
  // `gap-1.5` (6px) on the compact card, `gap-2` (8px) on the desktop row.
  const gap = isCompact ? 6 : 8;

  const [inBand, setInBand] = useState(
    () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(PILL_TRUNCATE_QUERY).matches,
  );
  const shouldTruncate = inBand && truncateInBand;

  const rowRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<FitResult>(SHOW_ALL);

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(PILL_TRUNCATE_QUERY);
    setInBand(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setInBand(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const labelSignature = useMemo(() => items.map((tag) => tag.label).join('|'), [items]);

  useLayoutEffect(() => {
    if (!shouldTruncate) {
      setFit(SHOW_ALL);
      return;
    }
    const row = rowRef.current;
    const mirror = mirrorRef.current;
    if (!row || !mirror) return;

    // Widths come from an off-screen mirror holding every pill plus the chip, so
    // the visible row never has to render all of them just to be measured.
    const measure = () => {
      const avail = row.clientWidth;
      if (!avail) return;
      const widths = Array.from(mirror.querySelectorAll<HTMLElement>('[data-pill-measure]')).map(
        (el) => el.getBoundingClientRect().width,
      );
      if (widths.length !== items.length) return;

      const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1);
      if (total <= avail) {
        setFit(SHOW_ALL);
        return;
      }

      const chipWidth = mirror.querySelector<HTMLElement>('[data-chip-measure]')
        ?.getBoundingClientRect().width ?? 0;
      const budget = avail - chipWidth - gap;

      let used = 0;
      let count = 0;
      for (let i = 0; i < widths.length; i += 1) {
        const next = used + (count > 0 ? gap : 0) + widths[i];
        if (next > budget) break;
        used = next;
        count += 1;
      }

      if (count === 0) {
        // Nothing fits whole. Keep one pill and let its label ellipsis rather
        // than hard-clipping it mid-word.
        setFit({ count: 1, firstMaxWidth: Math.max(MIN_ELLIPSIS_PILL_WIDTH, budget) });
        return;
      }
      setFit({ count: Math.min(count, widths.length - 1), firstMaxWidth: null });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [shouldTruncate, gap, items.length, labelSignature]);

  const pillClass = cn(
    'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border/70 font-semibold text-muted-foreground',
    isCompact ? 'px-2.5 py-1 bg-muted/30 text-[10px]' : 'px-3 py-1 bg-background text-[11px]',
  );

  const renderPill = (
    tag: ServicePillItem,
    index: number,
    options?: { forMeasure?: boolean; maxWidth?: number | null },
  ) => {
    const key = getServiceKey(tag.label, tag.type);
    const IconComp = tag.icon ? getIconComponent(tag.icon) : null;
    const icon = IconComp
      ? <IconComp className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      : (SERVICE_ICON_MAP[key] || <Camera size={isCompact ? 10 : 12} />);
    const label = preferMappedLabel
      ? (SERVICE_LABELS[key] || tag.label)
      : (tag.label || SERVICE_LABELS[key]);
    const clipped = typeof options?.maxWidth === 'number';
    return (
      <span
        key={`${shootId}-${key}-${index}${options?.forMeasure ? '-measure' : ''}`}
        {...(options?.forMeasure ? { 'data-pill-measure': 'true' } : {})}
        className={pillClass}
        style={clipped ? { maxWidth: options?.maxWidth as number } : undefined}
        title={clipped ? label : undefined}
      >
        <span className="shrink-0">{icon}</span>
        <span className={clipped ? 'min-w-0 truncate' : undefined}>{label}</span>
      </span>
    );
  };

  const shownItems = fit.count === null ? items : items.slice(0, fit.count);
  const hiddenItems = fit.count === null ? [] : items.slice(fit.count);

  return (
    <div
      ref={rowRef}
      className={cn(
        'relative flex text-xs text-muted-foreground',
        isCompact ? 'gap-1.5' : 'gap-2',
        // Clip for the whole band, not just once a count is known, so the first
        // paint can never show a wrapped row.
        shouldTruncate ? 'flex-nowrap overflow-hidden' : 'flex-wrap',
      )}
    >
      {shownItems.map((tag, index) =>
        renderPill(tag, index, { maxWidth: index === 0 ? fit.firstMaxWidth : null }),
      )}

      {hiddenItems.length > 0 && (
        <span
          className={pillClass}
          title={hiddenItems.map((tag) => tag.label).filter(Boolean).join(', ')}
        >
          +{hiddenItems.length} more
        </span>
      )}

      {shouldTruncate && (
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute top-0 left-[-9999px] flex flex-nowrap"
        >
          {items.map((tag, index) => renderPill(tag, index, { forMeasure: true }))}
          <span data-chip-measure="true" className={pillClass}>
            +{Math.max(1, items.length - 1)} more
          </span>
        </div>
      )}
    </div>
  );
};
