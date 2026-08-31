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

/**
 * Below this a text-clipped pill shows so few characters that it is no longer
 * worth the space, and the row drops to just the count chip.
 */
const MIN_ELLIPSIS_PILL_WIDTH = 40;

export type ServicePillItem = { label: string; type?: string; icon?: string };

interface ServicePillsProps {
  shootId: number | string;
  items: ServicePillItem[];
  /** `compact` is the stacked mobile card, `desktop` the three-column row. */
  variant: 'compact' | 'desktop';
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
  /** `"+3 more"` when there is room for it, `"+3"` when there is not. */
  chipForm: 'long' | 'short';
}

const SHOW_ALL: FitResult = { count: null, firstMaxWidth: null, chipForm: 'long' };

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
  // Truncation is confined to the band. Outside it, on either side, the row wraps
  // exactly as it always did and nothing is hidden. The compact card owns its full
  // width and is not part of the band at all.
  const shouldTruncate = inBand && !isCompact;

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

      const chipWidthFor = (form: 'long' | 'short') =>
        mirror.querySelector<HTMLElement>(`[data-chip-measure="${form}"]`)
          ?.getBoundingClientRect().width ?? 0;

      const budgetFor = (form: 'long' | 'short') => avail - chipWidthFor(form) - gap;

      const countWholePills = (budget: number) => {
        let used = 0;
        let count = 0;
        for (let i = 0; i < widths.length; i += 1) {
          const next = used + (count > 0 ? gap : 0) + widths[i];
          if (next > budget) break;
          used = next;
          count += 1;
        }
        return count;
      };

      // Prefer the readable "+N more" chip, and only fall back to the bare count
      // when spelling it out would leave no room for a pill.
      const forms: Array<'long' | 'short'> = ['long', 'short'];
      for (const form of forms) {
        const count = countWholePills(budgetFor(form));
        if (count > 0) {
          setFit({
            count: Math.min(count, widths.length - 1),
            firstMaxWidth: null,
            chipForm: form,
          });
          return;
        }
      }

      // Nothing fits whole. Keep one pill clipped to the space actually available
      // so its label ellipsises instead of the chip being cut off, and drop the
      // pill entirely once that space stops being readable.
      const budget = budgetFor('short');
      if (budget < MIN_ELLIPSIS_PILL_WIDTH) {
        setFit({ count: 0, firstMaxWidth: null, chipForm: 'short' });
        return;
      }
      setFit({ count: 1, firstMaxWidth: budget, chipForm: 'short' });
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

  if (items.length === 0) {
    return (
      <div className="flex text-xs text-muted-foreground">
        <span className={pillClass}>No services</span>
      </div>
    );
  }

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
          {fit.chipForm === 'long' ? `+${hiddenItems.length} more` : `+${hiddenItems.length}`}
        </span>
      )}

      {shouldTruncate && (
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute top-0 left-[-9999px] flex flex-nowrap"
        >
          {items.map((tag, index) => renderPill(tag, index, { forMeasure: true }))}
          <span data-chip-measure="long" className={pillClass}>
            +{items.length} more
          </span>
          <span data-chip-measure="short" className={pillClass}>
            +{items.length}
          </span>
        </div>
      )}
    </div>
  );
};
