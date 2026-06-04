import * as React from 'react'
import { Bookmark, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { SavedView } from '@/lib/listing-presentation/types'

export interface SavedViewsMenuProps {
  savedViews: SavedView[]
  onApplyView: (id: string) => void
  onSaveView: (name: string) => void
  onDeleteView: (id: string) => void
}

/**
 * SavedViewsMenu renders a "Saved views" trigger button that opens a menu to
 * list, apply, save, and delete Saved_Views.
 *
 * - Clicking a listed view applies it (R4.8).
 * - The input + "Save current view" button persists the current view (R4.7).
 * - An empty state is shown when no views exist (R4.9).
 */
export function SavedViewsMenu({
  savedViews,
  onApplyView,
  onSaveView,
  onDeleteView,
}: SavedViewsMenuProps) {
  const [name, setName] = React.useState('')

  const trimmedName = name.trim()
  const canSave = trimmedName.length > 0

  const handleSave = React.useCallback(() => {
    if (trimmedName.length === 0) return
    onSaveView(trimmedName)
    setName('')
  }, [trimmedName, onSaveView])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        handleSave()
      }
    },
    [handleSave],
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl border-border"
        >
          <Bookmark className="h-4 w-4" />
          <span>Saved views</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 rounded-xl border-border p-3"
      >
        <div className="space-y-3">
          {savedViews.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              No saved views yet
            </p>
          ) : (
            <ul className="space-y-1">
              {savedViews.map((view) => (
                <li
                  key={view.id}
                  className="group flex items-center gap-1 rounded-lg"
                >
                  <button
                    type="button"
                    onClick={() => onApplyView(view.id)}
                    className={cn(
                      'flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none transition-colors',
                      'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
                    )}
                  >
                    <Bookmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{view.name}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${view.name}`}
                    onClick={() => onDeleteView(view.id)}
                    className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="View name"
                aria-label="Saved view name"
                className="h-9 flex-1 rounded-xl border-border"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={!canSave}
                className="rounded-xl"
              >
                <Plus className="h-4 w-4" />
                <span>Save</span>
              </Button>
            </div>
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              Save current view
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default SavedViewsMenu
