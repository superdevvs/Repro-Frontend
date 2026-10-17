import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SmsThreadFilter } from '@/types/messaging';

export type SmsThreadView = Exclude<SmsThreadFilter, 'clients'> | 'system';

interface SmsThreadFilterTabsProps {
  value: SmsThreadView;
  onValueChange: (value: SmsThreadView) => void;
  canViewSystem?: boolean;
  disabled?: boolean;
}

const filters: Array<{ value: SmsThreadView; label: string }> = [
  { value: 'all', label: 'Inbox' },
  { value: 'unanswered', label: 'Unanswered' },
  { value: 'my_recents', label: 'Mine' },
];

export const SmsThreadFilterTabs = ({ value, onValueChange, canViewSystem, disabled }: SmsThreadFilterTabsProps) => {
  const views = canViewSystem ? [...filters, { value: 'system' as const, label: 'System' }] : filters;
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as SmsThreadView)} className="mt-3">
      <TabsList aria-label="SMS views" className={`grid h-11 w-full ${canViewSystem ? 'grid-cols-4' : 'grid-cols-3'} gap-0 rounded-none bg-transparent p-0`}>
        {views.map((filter) => (
          <TabsTrigger
            key={filter.value}
            value={filter.value}
            disabled={disabled}
            className="h-11 min-w-0 rounded-none border-b-2 border-transparent px-1 !text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            {filter.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

