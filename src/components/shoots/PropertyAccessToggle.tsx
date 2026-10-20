import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type PropertyAccessOption = 'self' | 'other' | 'lockbox';

/** One access method at a time; clicking the active choice keeps it selected. */
export function PropertyAccessToggle({ value, onChange, disabled = false }: {
  value: PropertyAccessOption | '';
  onChange: (value: PropertyAccessOption) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup type="single" value={value} disabled={disabled} aria-label="Property access"
      onValueChange={(next) => {
        if (next === 'self' || next === 'other' || next === 'lockbox') onChange(next);
      }}
      className="grid w-full min-w-0 grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1">
      {([['self', 'Self / client'], ['other', 'Another contact'], ['lockbox', 'Lockbox']] as const).map(([option, label]) => (
        <ToggleGroupItem key={option} value={option}
          className="h-auto min-h-11 min-w-0 whitespace-normal px-2 py-2 text-xs leading-tight data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm">
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
