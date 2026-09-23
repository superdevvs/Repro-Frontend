import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SmsThreadFilter } from '@/types/messaging';

interface SmsThreadFilterTabsProps {
  value: SmsThreadFilter;
  onValueChange: (value: SmsThreadFilter) => void;
}

const filters: Array<{ value: SmsThreadFilter; label: string }> = [
  { value: 'unanswered', label: 'Unanswered' },
  { value: 'my_recents', label: 'Recent' },
  { value: 'clients', label: 'Clients' },
  { value: 'all', label: 'All' },
];

export const SmsThreadFilterTabs = ({ value, onValueChange }: SmsThreadFilterTabsProps) => {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as SmsThreadFilter)} className="mt-3">
      <TabsList className="grid h-11 w-full grid-cols-4 gap-0 rounded-none bg-transparent p-0">
        {filters.map((filter) => (
          <TabsTrigger
            key={filter.value}
            value={filter.value}
            className="h-11 min-w-0 rounded-none border-b-2 border-transparent px-1 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none lg:text-sm"
          >
            {filter.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

