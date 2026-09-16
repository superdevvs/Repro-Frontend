import type { ReactNode } from 'react';
import { ChevronsUpDown, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { FormControl } from '@/components/ui/form';
import { cn } from '@/lib/utils';

interface MobileClientPickerProps {
  open: boolean;
  selectedClientName?: string;
  disabled: boolean;
  invalidClassName?: string;
  clientList: ReactNode;
  onResetSearch: () => void;
  onOpenChange: (open: boolean) => void;
}

export function MobileClientPicker({
  open,
  selectedClientName,
  disabled,
  invalidClassName,
  clientList,
  onResetSearch,
  onOpenChange,
}: MobileClientPickerProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) onResetSearch();
    onOpenChange(nextOpen);
  };

  return (
    <>
      <FormControl>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-12 w-full justify-between px-3 text-sm font-normal', invalidClassName)}
          onClick={() => handleOpenChange(true)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={cn('truncate', !selectedClientName && 'text-muted-foreground')}>
              {selectedClientName || 'Search clients...'}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </FormControl>
      <Drawer shouldScaleBackground={false} open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="flex h-[85dvh] max-h-[85dvh] flex-col">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>Choose client</DrawerTitle>
            <DrawerDescription>Search and select the client for this shoot.</DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">{clientList}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
