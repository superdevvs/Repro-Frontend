import { ArrowUpDown, Grid3X3, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SHOOT_HISTORY_SORT_OPTIONS, type ShootHistorySort } from './shootHistorySorting'

type Props = {
  view: 'grid' | 'list' | 'map'
  onViewChange: (view: 'grid' | 'list' | 'map') => void
  sort: ShootHistorySort
  onSortChange: (sort: ShootHistorySort) => void
  gridColumns: 3 | 4
  onGridColumnsChange: (columns: 3 | 4) => void
}

export function ShootHistoryDisplayControls({ view, onViewChange, sort, onSortChange, gridColumns, onGridColumnsChange }: Props) {
  const nextView = view === 'grid' ? 'list' : 'grid'
  const viewLabel = `Switch to ${nextView} view`
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Sort shoots" title="Sort shoots">
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Sort by date</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sort} onValueChange={value => onSortChange(value as ShootHistorySort)}>
            {SHOOT_HISTORY_SORT_OPTIONS.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {view === 'grid' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Grid layout</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={String(gridColumns)} onValueChange={value => onGridColumnsChange(Number(value) as 3 | 4)}>
                <DropdownMenuRadioItem value="3">3 columns</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="4">4 columns</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant={view === 'map' ? 'ghost' : 'secondary'} size="icon"
        aria-label={viewLabel} title={viewLabel} data-shoot-view-toggle={view}
        onClick={() => onViewChange(nextView)}
      >
        {view === 'list' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
      </Button>
    </>
  )
}
