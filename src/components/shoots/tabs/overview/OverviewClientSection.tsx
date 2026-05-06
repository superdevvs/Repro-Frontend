import { ArrowUpDown, Check, UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ShootData } from '@/types/shoots';
import type { ClientOption } from './useShootOverviewEditor';

type OverviewClientSectionProps = {
  shoot: ShootData;
  isEditMode: boolean;
  isAdmin: boolean;
  isRep: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  shouldHideClientDetails: boolean;
  clients: ClientOption[];
  selectedClientId: string;
  clientSearchOpen: boolean;
  setClientSearchOpen: (open: boolean) => void;
  setSelectedClientId: (clientId: string) => void;
  updateField: (field: string, value: unknown) => void;
};

export function OverviewClientSection({
  shoot,
  isEditMode,
  isAdmin,
  isRep,
  isPhotographer,
  isEditor,
  isClient,
  shouldHideClientDetails,
  clients,
  selectedClientId,
  clientSearchOpen,
  setClientSearchOpen,
  setSelectedClientId,
  updateField,
}: OverviewClientSectionProps) {
  if ((!shoot.client && !isEditMode) || isPhotographer || isEditor || isClient || shouldHideClientDetails) {
    return null;
  }

  const rep = shoot.client?.rep || shoot.rep || null;
  const repName = typeof rep === 'string' ? rep : rep?.name;

  return (
    <div className="p-2.5 border rounded-lg bg-card">
      <div className="flex items-center gap-1.5 mb-1.5">
        <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Client</span>
      </div>
      {isEditMode ? (
        <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen} modal={false}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={clientSearchOpen}
              className="w-full justify-between h-8 text-xs font-normal"
            >
              {selectedClientId
                ? clients.find((client) => client.id === selectedClientId)?.name || 'Select client...'
                : 'Select client...'}
              <ArrowUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] max-w-[300px] p-0 shadow-lg z-[200] max-h-[250px]"
            align="start"
            sideOffset={4}
            side="bottom"
            onOpenAutoFocus={(event) => event.preventDefault()}
            style={{ pointerEvents: 'auto' }}
          >
            <Command className="rounded-lg flex flex-col" shouldFilter={true}>
              <CommandInput placeholder="Search clients..." className="h-9 flex-shrink-0 border-b" />
              <CommandList className="max-h-[200px] overflow-y-auto overflow-x-hidden">
                <CommandEmpty>No client found.</CommandEmpty>
                <CommandGroup>
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={`${client.name} ${client.email} ${client.company || ''}`}
                      onSelect={() => {
                        setSelectedClientId(client.id);
                        updateField('client', {
                          id: client.id,
                          name: client.name,
                          email: client.email,
                          company: client.company,
                        });
                        setClientSearchOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{client.name}</span>
                        {client.email && (
                          <span className="text-[10px] text-muted-foreground">{client.email}</span>
                        )}
                      </div>
                      {selectedClientId === client.id && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <div className="flex items-start justify-between">
          <div className="space-y-1 text-xs">
            <div className="font-medium">{shoot.client?.name || 'Unknown'}</div>
            {shoot.client?.email && (
              <div className="text-muted-foreground truncate">{shoot.client.email}</div>
            )}
            {(isAdmin || isRep) && shoot.client?.phone && (
              <div className="text-muted-foreground truncate">{shoot.client.phone}</div>
            )}
          </div>
          {isAdmin && (
            <div className="text-xs text-right">
              <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Rep</div>
              {repName ? (
                <div className="font-medium">{repName}</div>
              ) : (
                <div className="text-muted-foreground">No rep</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
