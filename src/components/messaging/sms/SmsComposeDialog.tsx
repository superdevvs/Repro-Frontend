import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Send, Sparkles, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { getSmsGroups, getSmsRecipients, type SmsDirectoryRecipient } from '@/services/messaging';
import { SmsGroupsDialog, type SmsGroupDraftMember } from './SmsGroupsDialog';

export type SmsComposeRecipient = {
  key: string;
  label: string;
  phone: string;
  userId?: number | null;
};

export type SmsComposePayload = {
  to?: string;
  recipients?: Array<{ phone: string; name?: string; user_id?: number | null }>;
  group_ids?: number[];
  bodyText: string;
};

const phoneKey = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const isPlausiblePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

export const SmsComposeDialog = ({
  open,
  onOpenChange,
  onSend,
  sending,
  templates = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (payload: SmsComposePayload) => void;
  sending?: boolean;
  templates?: Array<{ id: string | number; name: string; body_text?: string }>;
}) => {
  const [recipients, setRecipients] = useState<SmsComposeRecipient[]>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [groupSeed, setGroupSeed] = useState<SmsGroupDraftMember[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(directorySearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [directorySearch]);

  const groupsQuery = useQuery({
    queryKey: ['sms-groups'],
    queryFn: getSmsGroups,
    enabled: open,
  });

  const directoryQuery = useQuery({
    queryKey: ['sms-directory', debouncedSearch],
    queryFn: () => getSmsRecipients({ search: debouncedSearch || undefined, limit: 20 }),
    enabled: open && directoryOpen,
  });

  const characterCount = bodyText.length;
  const segments = useMemo(() => {
    if (!characterCount) return 0;
    if (characterCount <= 160) return 1;
    return Math.ceil(characterCount / 153);
  }, [characterCount]);

  const groupedPeople = useMemo(() => {
    const people = directoryQuery.data ?? [];
    return {
      clients: people.filter((person) => person.kind === 'client'),
      users: people.filter((person) => person.kind === 'user'),
      contacts: people.filter((person) => person.kind === 'contact'),
    };
  }, [directoryQuery.data]);

  const selectedGroupCount = (groupsQuery.data ?? [])
    .filter((group) => groupIds.includes(group.id))
    .reduce((total, group) => total + group.member_count, 0);

  const reset = () => {
    setRecipients([]);
    setPhoneInput('');
    setPhoneError('');
    setBodyText('');
    setGroupIds([]);
    setDirectoryOpen(false);
    setDirectorySearch('');
    setGroupsOpen(false);
    setGroupSeed([]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (sending) return;
    onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };

  const addRecipient = (recipient: SmsComposeRecipient) => {
    setRecipients((current) => (
      current.some((item) => item.key === recipient.key) ? current : [...current, recipient]
    ));
    setPhoneInput('');
    setPhoneError('');
  };

  const addPhoneInput = () => {
    const value = phoneInput.trim();
    if (!value) return;
    if (!isPlausiblePhone(value)) {
      setPhoneError('Enter a valid phone number.');
      return;
    }
    addRecipient({ key: phoneKey(value), label: value, phone: value });
  };

  const addPerson = (person: SmsDirectoryRecipient) => {
    const key = phoneKey(person.phone);
    if (recipients.some((item) => item.key === key)) {
      setRecipients((current) => current.filter((item) => item.key !== key));
      return;
    }
    addRecipient({
      key,
      label: person.name,
      phone: person.phone,
      userId: person.user_id,
    });
  };

  const toggleGroup = (groupId: number) => {
    setGroupIds((current) => (
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    ));
  };

  const canSend = (recipients.length > 0 || groupIds.length > 0) && bodyText.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    const many = recipients.length > 1 || groupIds.length > 0;
    onSend({
      to: !many && recipients.length === 1 ? recipients[0].phone : undefined,
      recipients: many && recipients.length > 0
        ? recipients.map((recipient) => ({
          phone: recipient.phone,
          name: recipient.label,
          user_id: recipient.userId,
        }))
        : undefined,
      group_ids: groupIds.length > 0 ? groupIds : undefined,
      bodyText: bodyText.trim(),
    });
  };

  const audience = [
    recipients.length ? `${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}` : null,
    groupIds.length ? `${groupIds.length} ${groupIds.length === 1 ? 'group' : 'groups'}` : null,
  ].filter(Boolean).join(' and ');

  const directoryGroups = [
    groupedPeople.clients.length ? { heading: 'Clients', people: groupedPeople.clients } : null,
    groupedPeople.users.length ? { heading: 'Users', people: groupedPeople.users } : null,
    groupedPeople.contacts.length ? { heading: 'Contacts', people: groupedPeople.contacts } : null,
  ].filter((group): group is { heading: string; people: SmsDirectoryRecipient[] } => Boolean(group));

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[min(760px,calc(100dvh-2rem))] !w-[min(920px,calc(100vw-2rem))] !max-w-[min(920px,calc(100vw-2rem))] flex-col gap-5 overflow-hidden">
          <DialogHeader>
            <DialogTitle>New SMS</DialogTitle>
            <DialogDescription>Send one text to several people, or to a saved group.</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)]">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="sms-compose-to">To</Label>
                  <div className="flex items-center gap-1">
                    {recipients.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => {
                          setGroupSeed(recipients.map((recipient) => ({
                            key: recipient.key,
                            name: recipient.label,
                            phone: recipient.phone,
                            userId: recipient.userId,
                          })));
                          setGroupsOpen(true);
                        }}
                      >
                        Save as group
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant={directoryOpen ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-8"
                      disabled={sending}
                      onClick={() => setDirectoryOpen((open) => !open)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      People
                    </Button>
                  </div>
                </div>
                <div className="max-h-24 overflow-y-auto rounded-xl border border-border/70 bg-background px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {recipients.map((recipient) => (
                      <Badge key={recipient.key} variant="secondary" className="gap-1 rounded-full px-2.5 py-1 text-xs">
                        {recipient.label}
                        <button type="button" aria-label={`Remove ${recipient.label}`} onClick={() => setRecipients((current) => current.filter((item) => item.key !== recipient.key))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Input
                      id="sms-compose-to"
                      value={phoneInput}
                      onChange={(event) => {
                        setPhoneInput(event.target.value);
                        setPhoneError('');
                      }}
                      onBlur={addPhoneInput}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
                          event.preventDefault();
                          addPhoneInput();
                        }
                      }}
                      placeholder={recipients.length ? 'Add another' : 'Name or number'}
                      autoComplete="tel"
                      className="h-8 min-w-[8rem] flex-1 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>
                {phoneError && <p className="text-xs text-amber-600">{phoneError}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex h-8 items-center justify-between gap-3">
                  <Label>Groups</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setGroupSeed([]); setGroupsOpen(true); }}>
                    Manage
                  </Button>
                </div>
                {(groupsQuery.data ?? []).length === 0 ? (
                  <div className="flex h-10 items-center rounded-xl border border-dashed border-border/70 px-3 text-sm text-muted-foreground">
                    No groups yet
                  </div>
                ) : (
                  <div className="flex max-h-24 flex-wrap content-start gap-2 overflow-y-auto">
                    {(groupsQuery.data ?? []).map((group) => {
                      const selected = groupIds.includes(group.id);
                      return (
                        <Button
                          key={group.id}
                          type="button"
                          size="sm"
                          variant={selected ? 'default' : 'outline'}
                          className="h-8"
                          onClick={() => toggleGroup(group.id)}
                          disabled={sending}
                        >
                          {group.name}
                          <span className={selected ? 'ml-2 text-xs text-primary-foreground/80' : 'ml-2 text-xs text-muted-foreground'}>
                            {group.member_count}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                )}
                {selectedGroupCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedGroupCount} {selectedGroupCount === 1 ? 'person' : 'people'} in the selected groups
                  </p>
                )}
              </div>
            </div>

            {directoryOpen && (
              <Command className="rounded-xl border border-border/70">
                <CommandInput placeholder="Search users and contacts..." value={directorySearch} onValueChange={setDirectorySearch} />
                <CommandList className="max-h-52">
                  <CommandEmpty>No matching people with a phone number.</CommandEmpty>
                  {directoryGroups.map((group, index) => (
                    <div key={group.heading}>
                      {index > 0 && <CommandSeparator />}
                      <CommandGroup heading={group.heading}>
                        {group.people.map((person) => (
                          <CommandItem
                            key={person.id}
                            value={`${person.name} ${person.phone} ${person.subtitle ?? ''}`}
                            onSelect={() => addPerson(person)}
                          >
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate font-medium">{person.name}</span>
                              <span className="truncate text-xs text-muted-foreground">{person.subtitle || person.phone}</span>
                            </div>
                            {recipients.some((item) => item.key === phoneKey(person.phone)) && (
                              <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-primary" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </div>
                  ))}
                </CommandList>
              </Command>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="sms-compose-body">Message</Label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {characterCount} chars · {segments} {segments === 1 ? 'segment' : 'segments'}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" type="button" className="h-8" disabled={!templates.length || sending}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Template
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {templates.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onClick={() => {
                            if (template.body_text) setBodyText(template.body_text);
                          }}
                        >
                          {template.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <Textarea
                id="sms-compose-body"
                value={bodyText}
                onChange={(event) => setBodyText(event.target.value)}
                rows={5}
                placeholder="Write a message..."
                className="min-h-32 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending || !canSend}>
              {sending ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
              {audience ? `Send to ${audience}` : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SmsGroupsDialog
        open={groupsOpen}
        onOpenChange={setGroupsOpen}
        initialMembers={groupSeed}
      />
    </>
  );
};
