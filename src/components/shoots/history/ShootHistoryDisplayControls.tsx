import { CalendarDays, Grid3X3, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ShootHistoryDisplayMode } from './shootHistoryUtils'

type Props = {
  view: ShootHistoryDisplayMode
  onViewChange: (view: ShootHistoryDisplayMode) => void
  gridColumns: 3 | 4
  onGridColumnsChange: (columns: 3 | 4) => void
  allowCalendar?: boolean
}

export function ShootHistoryDisplayControls({ view, onViewChange, gridColumns, onGridColumnsChange, allowCalendar = true }: Props) {
  const nextView = view === 'grid' ? 'list' : 'grid'
  const viewLabel = `Switch to ${nextView} view`
  return (
    <>
      {view === 'grid' && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Grid layout" title="Grid layout">
            <Grid3X3 className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Grid layout</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={String(gridColumns)} onValueChange={value => onGridColumnsChange(Number(value) as 3 | 4)}>
            <DropdownMenuRadioItem value="3">3 columns</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="4">4 columns</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>}
      {allowCalendar && <Button
        variant={view === 'calendar' ? 'secondary' : 'ghost'} size="icon"
        aria-label="Calendar view" title="Calendar view" aria-pressed={view === 'calendar'}
        onClick={() => onViewChange('calendar')}
      >
        <CalendarDays className="h-4 w-4" />
      </Button>}
      <Button
        variant={view === 'map' || view === 'calendar' ? 'ghost' : 'secondary'} size="sm" className="gap-2"
        aria-label={viewLabel} title={viewLabel} data-shoot-view-toggle={view}
        onClick={() => onViewChange(nextView)}
      >
        {nextView === 'list' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
        {nextView === 'list' ? 'List' : 'Grid'}
      </Button>
    </>
  )
}
