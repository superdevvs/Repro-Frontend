import React, { useCallback, useMemo, useRef } from 'react';

import { cn } from '@/lib/utils';

import {
  STUDIO_DESTINATIONS,
  type StudioDestinationEntry,
  type StudioDestinationId,
} from './destinations';
import { useOptionalStudioShell } from './StudioShell';

/**
 * IntegratedStudioNav (ai-editing-studio-revamp, task 10.3).
 *
 * The single navigation mechanism for Studio_Destinations, rendered in the
 * Studio_Page header. It replaces the compact `[ Studio | Photo | Video ]` tabs
 * (Req 1.3, 1.4) and renders **exactly one control per destination-registry
 * entry**, so navigation completeness holds by construction rather than by
 * duplication (Req 1.5).
 *
 * Every control:
 * - reports the active destination through a visible selected state and
 *   `aria-selected` / `aria-current` (Req 1.10),
 * - carries an accessible name even when its text label is visually collapsed
 *   on narrow viewports (Req 12.10),
 * - activates its destination through `onSelect` (Req 1.7).
 *
 * The component renders no sidebar and no chrome beyond the nav row, so the
 * existing Application_Sidebar stays the only sidebar on the page (Req 1.6).
 *
 * It is controlled: the parent (or the surrounding `StudioShell`) owns the
 * active destination. When `activeDestination`/`onSelect` are omitted, they are
 * read from the shell context so the page can render `<IntegratedStudioNav />`
 * with no wiring.
 */

export interface IntegratedStudioNavProps {
  /**
   * Destinations to render. Defaults to the full registry — the reason
   * completeness is guaranteed by construction. Provided mainly for tests.
   */
  destinations?: readonly StudioDestinationEntry[];
  /** Active destination id; falls back to the shell context. */
  activeDestination?: StudioDestinationId;
  /** Destination activation handler; falls back to the shell context. */
  onSelect?: (destination: StudioDestinationId) => void;
  /** Optional per-destination unavailability reason (disables the control). */
  unavailableReasons?: Partial<Record<StudioDestinationId, string>>;
  className?: string;
}

/** Group order used to separate the overview, data, and workflow destinations. */
const GROUP_ORDER: readonly StudioDestinationEntry['kind'][] = [
  'overview',
  'management',
  'workflow',
];

export function IntegratedStudioNav({
  destinations = STUDIO_DESTINATIONS,
  activeDestination,
  onSelect,
  unavailableReasons,
  className,
}: IntegratedStudioNavProps) {
  const shell = useOptionalStudioShell();
  const buttonRefs = useRef(new Map<StudioDestinationId, HTMLButtonElement>());

  const active = activeDestination ?? shell?.destination ?? destinations[0]?.id;
  const select = onSelect ?? shell?.setDestination;

  if (!select) {
    throw new Error(
      'IntegratedStudioNav requires an onSelect handler or a surrounding StudioShell',
    );
  }

  // Registry order, grouped so related destinations sit together while the set
  // of rendered controls stays exactly the set of registry entries.
  const ordered = useMemo(
    () =>
      GROUP_ORDER.flatMap((kind) => destinations.filter((entry) => entry.kind === kind)).concat(
        destinations.filter((entry) => !GROUP_ORDER.includes(entry.kind)),
      ),
    [destinations],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const step =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0;

      let nextIndex: number | null = null;
      if (step !== 0) {
        nextIndex = (index + step + ordered.length) % ordered.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = ordered.length - 1;
      }

      if (nextIndex === null) return;

      event.preventDefault();
      const next = ordered[nextIndex];
      if (!next) return;
      buttonRefs.current.get(next.id)?.focus();
      if (!unavailableReasons?.[next.id]) select(next.id);
    },
    [ordered, select, unavailableReasons],
  );

  return (
    <nav aria-label="Studio destinations" className={cn('w-full', className)}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1"
      >
        {ordered.map((entry, index) => {
          const { id, label, description, icon: Icon, kind } = entry;
          const isActive = id === active;
          const unavailableReason = unavailableReasons?.[id];
          const isPreviousGroupBoundary =
            index > 0 && ordered[index - 1]?.kind !== kind;

          return (
            <span key={id} className="contents">
              {isPreviousGroupBoundary && (
                <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:block" />
              )}
              <button
                ref={(node) => {
                  if (node) buttonRefs.current.set(id, node);
                  else buttonRefs.current.delete(id);
                }}
                type="button"
                role="tab"
                id={`studio-destination-tab-${id}`}
                data-destination-id={id}
                data-active={isActive ? 'true' : 'false'}
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                aria-label={label}
                aria-disabled={unavailableReason ? true : undefined}
                disabled={Boolean(unavailableReason)}
                tabIndex={isActive ? 0 : -1}
                title={unavailableReason ?? description}
                onClick={() => {
                  if (!unavailableReason) select(id);
                }}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  unavailableReason && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4 flex-shrink-0" />
                <span>{label}</span>
              </button>
            </span>
          );
        })}
      </div>
    </nav>
  );
}

export default IntegratedStudioNav;
