import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { FilterOption } from './shootHistoryUtils'

export function SearchablePersonFilter({ label, allLabel, options, value, onChange }: {
  label: string
  allLabel: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(option => String(option.id) === value)
  const select = (id: string) => { onChange(id); setOpen(false) }
  return (
    <div className="min-w-0 space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-label={label} aria-expanded={open} className="w-full justify-between font-normal">
            <span className="truncate">{selected?.name || (value ? `Selected ${label.toLowerCase()}` : allLabel)}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>No matches found.</CommandEmpty>
              <CommandGroup>
                <CommandItem value={allLabel} onSelect={() => select('')}><Check className={`mr-2 h-4 w-4 ${value ? 'opacity-0' : ''}`} />{allLabel}</CommandItem>
                {options.filter(option => option.id != null).map(option => (
                  <CommandItem key={String(option.id)} value={`${option.name} ${option.id}`} onSelect={() => select(String(option.id))}>
                    <Check className={`mr-2 h-4 w-4 ${String(option.id) === value ? '' : 'opacity-0'}`} />{option.name || 'Unknown'}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
