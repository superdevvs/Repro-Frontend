import { CheckCircle2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import type { EmailComposeRecipient } from '@/types/messaging';
import type { RecipientField } from './emailComposeModel';

type Group = { heading: string; people: EmailComposeRecipient[] };

export function ComposeDirectoryButton({
  field,
  compact,
  disabled,
  open,
  search,
  onSearch,
  onOpenChange,
  groups,
  selectedEmails,
  onPick,
}: {
  field: RecipientField;
  compact: boolean;
  disabled: boolean;
  open: boolean;
  search: string;
  onSearch: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
  selectedEmails: Set<string>;
  onPick: (email: string) => void;
}) {
  const title = field === 'to' ? 'Choose To' : field === 'cc' ? 'Add Cc' : 'Add Bcc';
  const browser = (
    <Command>
      <CommandInput placeholder="Search contacts, clients, and users..." value={search} onValueChange={onSearch} />
      <CommandList>
        <CommandEmpty>No matching recipients found.</CommandEmpty>
        {groups.map((group, index) => (
          <div key={group.heading}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={group.heading}>
              {group.people.map((recipient) => (
                <CommandItem
                  key={recipient.id}
                  value={`${recipient.name ?? ''} ${recipient.email} ${recipient.subtitle ?? ''}`}
                  onSelect={() => onPick(recipient.email)}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{recipient.name || recipient.email}</span>
                    <span className="truncate text-xs text-muted-foreground">{recipient.subtitle || recipient.email}</span>
                  </div>
                  {selectedEmails.has(recipient.email) && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </Command>
  );
  const trigger = (
    <Button type="button" variant="outline" size="sm" className="h-11 px-3" disabled={disabled}>
      <Users className="mr-2 h-4 w-4" />
      Browse
    </Button>
  );

  if (compact) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[78dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{browser}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">{browser}</PopoverContent>
    </Popover>
  );
}
