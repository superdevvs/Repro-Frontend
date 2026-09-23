import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SmsThreadFilter } from '@/types/messaging';

interface SmsThreadFilterTabsProps {
  value: SmsThreadFilter;
  onValueChange: (value: SmsThreadFilter) => void;
}

const filters: Array<{ value: SmsThreadFilter; label: string }> = [
  { value: 'unanswered', label: 'Unanswered' },
  { value: 'my_recents', label: 'My recents' },
  { value: 'clients', label: 'Clients' },
  { value: 'all', label: 'All' },
];

export const SmsThreadFilterTabs = ({ value, onValueChange }: SmsThreadFilterTabsProps) => {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as SmsThreadFilter)} className="mt-4">
      <TabsList className="flex w-full justify-start overflow-x-auto p-1 sm:grid sm:grid-cols-4">
        {filters.map((filter) => (
          <TabsTrigger key={filter.value} value={filter.value} className="min-h-10 whitespace-nowrap px-3 text-sm lg:min-h-0 lg:px-3 lg:text-sm">
            {filter.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

