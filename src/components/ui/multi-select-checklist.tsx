import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type MultiSelectChecklistOption = {
  id: string;
  label: string;
  description?: string;
  meta?: string;
};

interface MultiSelectChecklistProps {
  options: MultiSelectChecklistOption[];
  value: string[];
  onChange: (value: string[]) => void;
  emptyMessage?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelectChecklist({
  options,
  value,
  onChange,
  emptyMessage = 'No options available.',
  placeholder = 'No items selected.',
  disabled = false,
  className,
}: MultiSelectChecklistProps) {
  const selectedIds = React.useMemo(() => new Set(value), [value]);
  const selectedOptions = React.useMemo(
    () => options.filter((option) => selectedIds.has(option.id)),
    [options, selectedIds],
  );

  const toggleValue = (id: string, checked: boolean) => {
    if (disabled) return;

    if (checked) {
      onChange(Array.from(new Set([...value, id])));
      return;
    }

    onChange(value.filter((item) => item !== id));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="min-h-8 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2">
        {selectedOptions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedOptions.map((option) => (
              <Badge key={option.id} variant="secondary">
                {option.label}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{placeholder}</p>
        )}
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
        {options.length > 0 ? (
          options.map((option) => {
            const isChecked = selectedIds.has(option.id);

            return (
              <label
                key={option.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                  isChecked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <Checkbox
                  checked={isChecked}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggleValue(option.id, checked === true)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-5">{option.label}</p>
                    {option.meta ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{option.meta}</span>
                    ) : null}
                  </div>
                  {option.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                  ) : null}
                </div>
              </label>
            );
          })
        ) : (
          <p className="px-2 py-4 text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
