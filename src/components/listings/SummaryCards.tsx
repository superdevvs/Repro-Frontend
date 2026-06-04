// SummaryCards — the row of Map Tab summary statistic cards (R5.1, R5.2, R5.3).
//
// Renders five Summary_Cards (Total / Mapped / Unmapped / Private / Hidden)
// computed by `computeSummary`. This component is a thin renderer: it accepts a
// precomputed `Summary` produced by the coordinating hook so that the values
// recompute automatically whenever the loaded listing set or active filters
// change (R5.3). The hook owns the memoized `computeSummary(displayedListings)`
// call; this component only displays the result.
//
// Styling: every card shares a single corner radius within the 12-16px band
// (`rounded-xl`, R9.3) and one consistent border style (`border border-border`,
// R9.4), using theme tokens (`bg-card`, `text-card-foreground`,
// `text-muted-foreground`) for light/dark parity.

import * as React from 'react'
import { Building2, MapPin, MapPinOff, Lock, EyeOff, type LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Summary } from '@/lib/listing-presentation/types'

export interface SummaryCardsProps {
  /**
   * Precomputed summary, produced by `computeSummary` in the coordinating hook.
   * Driving the values from the hook keeps the cards in sync with the filtered
   * listing set without recomputing here (R5.3).
   */
  summary: Summary
  className?: string
}

interface SummaryCardConfig {
  key: keyof Summary
  label: string
  icon: LucideIcon
}

// One config entry per Summary_Card, in display order (R5.1). The `key` indexes
// the precomputed `Summary` so values stay arithmetically consistent with the
// hook's `computeSummary` output (Property 14).
const SUMMARY_CARDS: SummaryCardConfig[] = [
  { key: 'total', label: 'Total Listings', icon: Building2 },
  { key: 'mapped', label: 'Mapped', icon: MapPin },
  { key: 'unmapped', label: 'Unmapped', icon: MapPinOff },
  { key: 'private', label: 'Private', icon: Lock },
  { key: 'hidden', label: 'Hidden', icon: EyeOff },
]

/**
 * Renders the Total / Mapped / Unmapped / Private / Hidden summary cards in a
 * responsive grid. All cards share the same radius and border style (R9.3, R9.4).
 */
export function SummaryCards({ summary, className }: SummaryCardsProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5',
        className,
      )}
      data-testid="summary-cards"
    >
      {SUMMARY_CARDS.map(({ key, label, icon: Icon }) => (
        <Card
          key={key}
          // Shared radius (R9.3) + single border style (R9.4) + theme tokens.
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground"
          data-testid={`summary-card-${key}`}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p
              className="text-2xl font-semibold leading-tight tracking-tight"
              data-testid={`summary-value-${key}`}
            >
              {summary[key]}
            </p>
          </div>
        </Card>
      ))}
    </div>
  )
}

export default SummaryCards
