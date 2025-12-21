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
      <TabsList className="grid grid-cols-4">
        {filters.map((filter) => (
          <TabsTrigger key={filter.value} value={filter.value}>
            {filter.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

