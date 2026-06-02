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
          <TabsTrigger key={filter.value} value={filter.value} className="whitespace-nowrap px-2 text-xs sm:px-3 sm:text-sm">
            {filter.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

