import { ArrowDownUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ACCOUNT_SORT_OPTIONS, getAccountSortValue, type AccountSort } from './accountSorting';

interface AccountsSortMenuProps {
  sort: AccountSort;
  onSortChange: (sort: AccountSort) => void;
}

export function AccountsSortMenu({ sort, onSortChange }: AccountsSortMenuProps) {
  const value = getAccountSortValue(sort);
  const selectedLabel = ACCOUNT_SORT_OPTIONS.find(option => option.value === value)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-9 shrink-0 gap-1.5 px-2.5', sort && 'border-primary/50 bg-primary/5 text-primary')}
          aria-label="Sort accounts"
          title={`Sort accounts: ${selectedLabel}`}
        >
          <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Sort</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70dvh] w-60 overflow-y-auto">
        <DropdownMenuLabel>Sort accounts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={nextValue => {
            const option = ACCOUNT_SORT_OPTIONS.find(item => item.value === nextValue);
            if (option) onSortChange(option.sort);
          }}
        >
          {ACCOUNT_SORT_OPTIONS.map(option => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
