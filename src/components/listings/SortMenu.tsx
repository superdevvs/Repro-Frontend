// SortMenu — dropdown of sort options for the Exclusive Listings Map Tab.
//
// Thin UI renderer over the pure `SORT_OPTIONS` table from
// `lib/listing-presentation/sorting.ts`. The trigger button shows the label of
// the currently active sort; opening the menu lists every option and selecting
// one calls `onSortChange(value)`. The active option is marked with a check.
//
// Requirements: 4.1 (sort control in the command bar), 4.6 (selecting a sort
// option reorders the displayed listings).

import { ArrowUpDown, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { SORT_OPTIONS } from '@/lib/listing-presentation/sorting'
import type { SortOption } from '@/lib/listing-presentation/types'

export interface SortMenuProps {
  /** The currently active sort option. */
  sort: SortOption
  /** Called with the newly selected sort option. */
  onSortChange: (s: SortOption) => void
}

/**
 * Resolve the human-readable label for a sort option, falling back to the raw
 * value if (defensively) the option is not present in `SORT_OPTIONS`.
 */
const labelFor = (value: SortOption): string =>
  SORT_OPTIONS.find((option) => option.value === value)?.label ?? value

export function SortMenu({ sort, onSortChange }: SortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-border gap-2"
          aria-label={`Sort: ${labelFor(sort)}`}
        >
          <ArrowUpDown className="h-4 w-4" />
          <span className="truncate">{labelFor(sort)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border-border min-w-[12rem]">
        {SORT_OPTIONS.map((option) => {
          const isActive = option.value === sort
          return (
            <DropdownMenuItem
              key={option.value}
              className="rounded-lg cursor-pointer"
              onSelect={() => onSortChange(option.value)}
            >
              <Check
                className={cn(
                  'mr-2 h-4 w-4',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
              />
              <span className={cn(isActive && 'font-medium')}>{option.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default SortMenu
