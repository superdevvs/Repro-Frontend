import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  searchable?: boolean;
  searchPlaceholder?: string;
  summaryLimit?: number;
  maxHeightClassName?: string;
}

export function MultiSelectChecklist({
  options,
  value,
  onChange,
  emptyMessage = 'No options available.',
  placeholder = 'No items selected.',
  disabled = false,
  className,
  searchable = true,
  searchPlaceholder = 'Search options...',
  summaryLimit = 4,
  maxHeightClassName,
}: MultiSelectChecklistProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const selectedIds = React.useMemo(() => new Set(value), [value]);
  const selectedOptions = React.useMemo(
    () => options.filter((option) => selectedIds.has(option.id)),
    [options, selectedIds],
  );
  const visibleOptions = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) =>
      [option.label, option.description, option.meta]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(normalizedSearch)),
    );
  }, [options, searchTerm]);
  const summaryOptions = selectedOptions.slice(0, summaryLimit);
  const remainingCount = Math.max(0, selectedOptions.length - summaryOptions.length);

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
      <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Selected
          </p>
          <Badge variant="outline">{selectedOptions.length}</Badge>
        </div>
        {selectedOptions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {summaryOptions.map((option) => (
              <Badge key={option.id} variant="secondary">
                {option.label}
              </Badge>
            ))}
            {remainingCount > 0 ? <Badge variant="outline">+{remainingCount} more</Badge> : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{placeholder}</p>
        )}
      </div>

      {searchable && options.length > 6 ? (
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={searchPlaceholder}
          disabled={disabled}
        />
      ) : null}

      <div className={cn('max-h-56 space-y-2 overflow-y-auto rounded-md border p-2', maxHeightClassName)}>
        {visibleOptions.length > 0 ? (
          visibleOptions.map((option) => {
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
        ) : options.length > 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">No matches for your search.</p>
        ) : (
          <p className="px-2 py-4 text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
