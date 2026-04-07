import { ArrowUpDown, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type TourRealtorOption = {
  id: string;
  name: string;
  email?: string;
  company?: string;
};

type ShootTourRealtorPickerProps = {
  options: TourRealtorOption[];
  selectedClientId: string;
  selectedClient?: TourRealtorOption | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (clientId: string) => void;
  isLoading?: boolean;
  isSaving?: boolean;
  disabled?: boolean;
};

export function ShootTourRealtorPicker({
  options,
  selectedClientId,
  selectedClient,
  open,
  onOpenChange,
  onSelect,
  isLoading = false,
  isSaving = false,
  disabled = false,
}: ShootTourRealtorPickerProps) {
  const resolvedSelectedClient =
    selectedClient || options.find((client) => client.id === selectedClientId) || null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Realtor</Label>
        {isSaving ? <span className="text-xs text-blue-500">Saving...</span> : null}
      </div>
      <Popover open={open} onOpenChange={onOpenChange} modal={false}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between h-10 text-sm font-normal"
          >
            <span className="truncate text-left">
              {resolvedSelectedClient?.name || 'Select realtor'}
            </span>
            {isLoading ? (
              <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-70" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] max-w-[360px] p-0 shadow-lg z-[200] max-h-[320px]"
          align="start"
          sideOffset={4}
          side="bottom"
          onOpenAutoFocus={(event) => event.preventDefault()}
          style={{ pointerEvents: 'auto' }}
        >
          <Command className="rounded-lg flex flex-col" shouldFilter={true}>
            <CommandInput placeholder="Search clients..." className="h-9 flex-shrink-0 border-b" />
            <CommandList className="max-h-[260px] overflow-y-auto overflow-x-hidden">
              <CommandEmpty>
                {isLoading ? 'Loading clients...' : 'No client found.'}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="none clear remove"
                  onSelect={() => {
                    onSelect('');
                    onOpenChange(false);
                  }}
                  className="text-muted-foreground"
                >
                  <div className="flex items-center gap-2">
                    <X className="h-4 w-4" />
                    <span>Clear realtor</span>
                  </div>
                  {!selectedClientId ? <Check className="ml-auto h-4 w-4" /> : null}
                </CommandItem>
                {options.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`${client.name} ${client.email || ''} ${client.company || ''}`}
                    onSelect={() => {
                      onSelect(client.id);
                      onOpenChange(false);
                    }}
                  >
                    <div className="min-w-0 flex flex-col">
                      <span className="font-medium truncate">{client.name}</span>
                      {client.company ? (
                        <span className="text-[10px] text-muted-foreground truncate">{client.company}</span>
                      ) : null}
                      {client.email ? (
                        <span className="text-[10px] text-muted-foreground truncate">{client.email}</span>
                      ) : null}
                    </div>
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4',
                        selectedClientId === client.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        Branded tours will show this client&apos;s branding and contact info instead of the shoot owner.
      </p>
    </div>
  );
}
