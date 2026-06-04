import { Info, MapPin, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * SidebarEmptyState renders the Sidebar_Region empty / low-data states for the Map Tab.
 *
 * Per-kind content (Requirements 7.1, 7.2, 7.3):
 *
 * - 'no-mapped'  (R7.1 + R7.2): No Mapped_Listing exists but listings do exist.
 *     Heading note: "Nearby listings will appear here"
 *     Help text lines (both rendered verbatim):
 *       - "Click a marker to preview listing details."
 *       - "Use filters to narrow private properties."
 *
 * - 'low-data'   (R7.2): Few mapped listings (low-data). Same content as 'no-mapped':
 *     the "Nearby listings will appear here" heading plus the two help-text lines.
 *
 * - 'no-listings' (R7.3): No Listing exists in the current view.
 *     A NON-AGGRESSIVE prompt to add a listing — a calm message plus a quiet
 *     ghost/secondary button ("Add a listing") wired to onAddListing, never a
 *     loud primary CTA. The two help-text lines are intentionally omitted here
 *     because there are no markers/properties to interact with yet.
 */
export type SidebarEmptyStateKind = 'no-mapped' | 'low-data' | 'no-listings'

export interface SidebarEmptyStateProps {
  kind: SidebarEmptyStateKind
  onAddListing?: () => void
  className?: string
}

/** Exact help-text strings asserted by the empty-state RTL test (task 15.8). */
const HELP_TEXT_LINES = [
  'Click a marker to preview listing details.',
  'Use filters to narrow private properties.',
] as const

/** The note shown for the no-mapped / low-data states (R7.1). */
const NEARBY_NOTE = 'Nearby listings will appear here'

function HelpText() {
  return (
    <ul className="mt-4 space-y-2 text-left">
      {HELP_TEXT_LINES.map((line) => (
        <li key={line} className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}

export function SidebarEmptyState({ kind, onAddListing, className }: SidebarEmptyStateProps) {
  if (kind === 'no-listings') {
    // R7.3 — non-aggressive add prompt (calm secondary/ghost button, not a loud CTA).
    return (
      <Card
        className={cn(
          'rounded-2xl border-border bg-card text-card-foreground shadow-sm',
          className,
        )}
      >
        <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No listings in this view yet</p>
            <p className="text-xs text-muted-foreground">
              When you add a private listing, it will show up here.
            </p>
          </div>
          {onAddListing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={onAddListing}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a listing
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  // R7.1 + R7.2 — 'no-mapped' and 'low-data' share the styled "Nearby listings"
  // card with the two help-text lines.
  return (
    <Card
      className={cn(
        'rounded-2xl border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
    >
      <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <MapPin className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">{NEARBY_NOTE}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {kind === 'low-data'
            ? 'Only a few listings are mapped so far.'
            : 'None of your listings are mapped yet.'}
        </p>
        <HelpText />
      </CardContent>
    </Card>
  )
}

export default SidebarEmptyState
