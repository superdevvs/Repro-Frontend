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
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="justify-between w-full">
            {values.length ? `${values.length} selected` : 'All'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 space-y-1" align="start">
          {options.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-1">No options available</p>
          )}
          {options.map((option) => (
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
        </PopoverContent>
      </Popover>
    </div>
  )
}
