import { useState } from 'react'
import { ChevronsUpDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export const MultiSelectFilter = ({
  label,
  options,
  values,
  onChange,
}: {
  label: string
  options: string[]
  values: string[]
  onChange: (next: string[]) => void
}) => {
  const [search, setSearch] = useState('')
  const filteredOptions = options.filter(option => option.toLowerCase().includes(search.trim().toLowerCase()))
  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((entry) => entry !== value))
    } else {
      onChange([...values, value])
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <Popover onOpenChange={() => setSearch('')}>
        <PopoverTrigger asChild>
          <Button variant="outline" aria-label={label} className="justify-between w-full font-normal">
            <span className="truncate">{values.length === 1 ? values[0] : values.length ? `${values.length} selected` : `All ${label.toLowerCase()}`}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-60 max-w-[calc(100vw-2rem)] p-0" align="start">
          <div className="relative border-b p-2">
            <Search className="absolute left-4 top-5 h-4 w-4 text-muted-foreground" />
            <Input aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={event => setSearch(event.target.value)} className="h-9 pl-8" />
          </div>
          <div className="max-h-56 overflow-y-auto overscroll-contain p-2" data-service-filter-list>
          {filteredOptions.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-1">No matching services</p>
          )}
          {filteredOptions.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted cursor-pointer"
            >
              <Checkbox
                checked={values.includes(option)}
                onCheckedChange={() => toggleValue(option)}
              />
              <span>{option}</span>
            </label>
          ))}
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>{values.length ? `${values.length} selected` : 'All services'}</span>
            <Button variant="ghost" size="sm" className="h-7" disabled={!values.length} onClick={() => onChange([])}>Clear selection</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
