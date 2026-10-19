import { useMemo, type ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const commonTimezones = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto',
  'America/Vancouver', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
];

function availableTimezones(): string[] {
  // Older browsers may lack this API. Always offer common zones and the saved value.
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };
  try {
    return intl.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
}

type TimezoneSelectProps = Omit<ComponentProps<'select'>, 'value' | 'children'> & {
  value: string;
  containerClassName?: string;
};

export function TimezoneSelect({ value, className, containerClassName, ...props }: TimezoneSelectProps) {
  const timezones = useMemo(() => {
    // Keep aliases and other persisted identifiers exactly as received, even if
    // the browser's timezone catalog omits them. Rendering must never change a draft.
    const zones = new Set([...commonTimezones, ...availableTimezones(), value]);
    zones.delete('');
    zones.delete('UTC');
    return ['UTC', ...Array.from(zones).sort()];
  }, [value]);

  return (
    <span className={cn('relative block min-w-0 w-full', containerClassName)}>
      <select
        {...props}
        value={value}
        className={cn(
          'peer h-10 min-w-0 w-full max-w-full appearance-none rounded-md border border-input bg-background py-2 pl-3 text-base text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm [color-scheme:light] dark:[color-scheme:dark]',
          className,
          'pr-10',
        )}
      >
        {value === '' && <option value="" disabled>Select a timezone</option>}
        {timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground peer-disabled:opacity-50" />
    </span>
  );
}
