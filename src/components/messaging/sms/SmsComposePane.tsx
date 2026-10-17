import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search, Send, Sparkles, SquarePen, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { getSmsGroups, getSmsRecipients, type SmsDirectoryRecipient } from '@/services/messaging';
import { SmsGroupsDialog, type SmsGroupDraftMember } from './SmsGroupsDialog';
import { useAuth } from '@/components/auth/AuthProvider';
import type { SmsNumberConfig } from '@/types/messaging';
import { SmsSenderSelect } from './SmsSenderSelect';

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
  smsNumberId?: number;
};

const phoneKey = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const isPlausiblePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

type SmsComposePaneProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (payload: SmsComposePayload) => void;
  sending?: boolean;
  templates?: Array<{ id: string | number; name: string; body_text?: string }>;
  senderNumbers?: SmsNumberConfig[];
  senderNumbersLoading?: boolean;
  senderNumbersError?: boolean;
  onRetrySenderNumbers?: () => void;
};

const EMPTY_SENDER_NUMBERS: SmsNumberConfig[] = [];

export const SmsComposePane = (props: SmsComposePaneProps) => {
  const { user, role } = useAuth();
  return <SmsComposeForActor key={`${user?.id}:${role}:${props.open}`} {...props} />;
};

const SmsComposeForActor = ({ open, onOpenChange, onSend, sending, templates = [], senderNumbers = EMPTY_SENDER_NUMBERS, senderNumbersLoading, senderNumbersError, onRetrySenderNumbers }: SmsComposePaneProps) => {
  const { user, role } = useAuth();
  const senderOptions = useMemo(() => senderNumbers.filter(number => Number.isInteger(number.id) && Number(number.id) > 0 && number.phone_number.trim()), [senderNumbers]);
  const defaultSenderId = senderOptions.find(number => number.is_default)?.id ?? senderOptions[0]?.id;
  const [selectedSenderId, setSelectedSenderId] = useState<number | undefined>(defaultSenderId);
  useEffect(() => {
    setSelectedSenderId(current => senderOptions.some(number => number.id === current) ? current : defaultSenderId);
  }, [senderOptions, defaultSenderId]);
  const [recipients, setRecipients] = useState<SmsComposeRecipient[]>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [browser, setBrowser] = useState<'people' | 'groups' | null>(null);
  const [directorySearch, setDirectorySearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [groupSeed, setGroupSeed] = useState<SmsGroupDraftMember[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(directorySearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [directorySearch]);

  const groupsQuery = useQuery({
    queryKey: ['sms-groups', user?.id, role],
    queryFn: getSmsGroups,
    enabled: Boolean(user?.id) && open,
  });

  const directoryQuery = useQuery({
    queryKey: ['sms-directory', user?.id, role, debouncedSearch, 20],
    queryFn: () => getSmsRecipients({ search: debouncedSearch || undefined, limit: 20 }),
    enabled: Boolean(user?.id) && open && browser === 'people',
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
    setBrowser(null);
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
    if (sending) return;
    setRecipients((current) => (
      current.some((item) => item.key === recipient.key) ? current : [...current, recipient]
    ));
    setPhoneInput('');
    setPhoneError('');
    setDirectorySearch('');
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
    if (sending) return;
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
    if (sending) return;
    setGroupIds((current) => (
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    ));
  };

  const validSender = senderOptions.some(number => number.id === selectedSenderId);
  const senderReady = role !== 'superadmin' || (validSender && !senderNumbersLoading && !senderNumbersError);
  const canSend = (recipients.length > 0 || groupIds.length > 0) && bodyText.trim().length > 0 && senderReady;

  const handleSend = () => {
    if (!canSend || sending) return;
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
      ...(role === 'superadmin' && validSender ? { smsNumberId: selectedSenderId } : {}),
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

  if (!open) return null;

  const selectedGroups = (groupsQuery.data ?? []).filter(group => groupIds.includes(group.id));
  const groupSearch = directorySearch.trim().toLowerCase();
  const matchingGroups = (groupsQuery.data ?? []).filter(group => group.name.toLowerCase().includes(groupSearch));

  return (
    <>
      <section aria-label="New SMS" className="flex h-full min-h-0 flex-1 flex-col bg-background">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <SquarePen className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight">New SMS</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">Send a text to a person or group.</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close new SMS" className="h-9 w-9 shrink-0 rounded-full" onClick={() => handleOpenChange(false)} disabled={sending}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
            <div className="shrink-0 rounded-2xl border border-border/70 bg-muted/15 px-3 sm:px-4">
              {role === 'superadmin' && <div className="border-b border-border/60 py-2.5">
                <SmsSenderSelect
                  compact
                  numbers={senderOptions}
                  value={selectedSenderId}
                  onChange={setSelectedSenderId}
                  disabled={sending}
                  loading={senderNumbersLoading}
                  error={senderNumbersError}
                  onRetry={onRetrySenderNumbers}
                  id="sms-compose-from"
                />
              </div>}
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 py-3">
                <Label htmlFor="sms-compose-to" className="pt-2 text-xs text-muted-foreground">To</Label>
                <div className="min-w-0">
                  <div className="flex max-h-32 flex-wrap items-center gap-1.5 overflow-y-auto">
                    {recipients.map(recipient => <Badge key={recipient.key} variant="secondary" className="max-w-full gap-1.5 rounded-lg border border-border/50 py-1.5 pl-2.5 pr-1.5 text-xs font-medium">
                      <span className="truncate">{recipient.label}</span>
                      <button type="button" aria-label={`Remove ${recipient.label}`} disabled={sending} className="rounded p-0.5 hover:bg-background disabled:opacity-50" onClick={() => setRecipients(current => current.filter(item => item.key !== recipient.key))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>)}
                    {selectedGroups.map(group => <Badge key={`group-${group.id}`} variant="secondary" className="max-w-full gap-1.5 rounded-lg border border-primary/15 bg-primary/10 py-1.5 pl-2.5 pr-1.5 text-xs font-medium text-foreground">
                      <Users className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                      <span className="truncate">{group.name}</span>
                      <button type="button" aria-label={`Remove group ${group.name}`} disabled={sending} className="rounded p-0.5 hover:bg-background disabled:opacity-50" onClick={() => toggleGroup(group.id)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>)}
                    <Input
                      id="sms-compose-to"
                      value={phoneInput}
                      disabled={sending}
                      onChange={event => {
                        setPhoneInput(event.target.value);
                        setDirectorySearch(event.target.value);
                        setPhoneError('');
                        setBrowser('people');
                      }}
                      onBlur={event => {
                        if (event.relatedTarget instanceof Element && event.relatedTarget.closest('#sms-compose-people')) return;
                        if (isPlausiblePhone(phoneInput)) addPhoneInput();
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
                          event.preventDefault();
                          addPhoneInput();
                        }
                        if (event.key === 'Escape') setBrowser(null);
                      }}
                      placeholder={recipients.length || groupIds.length ? 'Add another recipient' : 'Search a name or enter a number'}
                      autoComplete="off"
                      aria-expanded={browser === 'people'}
                      aria-controls={browser === 'people' ? 'sms-compose-people' : undefined}
                      className="h-8 min-w-[min(10rem,100%)] max-w-full basis-40 flex-1 border-none bg-transparent px-0 shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0"
                    />
                  </div>
                  {phoneError && <p role="alert" className="mt-1 text-xs text-destructive">{phoneError}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 py-2">
                <div className="relative min-w-0 basis-48 flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    aria-label="Search people and groups"
                    aria-expanded={browser !== null}
                    aria-controls={browser === 'people' ? 'sms-compose-people' : browser === 'groups' ? 'sms-compose-groups' : undefined}
                    value={directorySearch}
                    disabled={sending}
                    onChange={event => {
                      setDirectorySearch(event.target.value);
                      setBrowser(current => current ?? 'people');
                    }}
                    onFocus={() => setBrowser(current => current ?? 'people')}
                    onKeyDown={event => { if (event.key === 'Escape') setBrowser(null); }}
                    placeholder={browser === 'groups' ? 'Search groups…' : browser === 'people' ? 'Search people…' : 'Search people or groups…'}
                    autoComplete="off"
                    className="h-8 border-transparent bg-background/60 pl-8 pr-8 text-xs shadow-none placeholder:text-muted-foreground/80 focus-visible:border-border focus-visible:ring-1"
                  />
                  {directorySearch && <button type="button" aria-label="Clear recipient search" disabled={sending} onClick={() => setDirectorySearch('')} className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>}
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button type="button" variant={browser === 'people' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-1.5 px-2 text-xs" aria-expanded={browser === 'people'} aria-controls="sms-compose-people" disabled={sending} onClick={() => setBrowser(current => current === 'people' ? null : 'people')}>
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />People
                  </Button>
                  <Button type="button" variant={browser === 'groups' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-1.5 px-2 text-xs" aria-expanded={browser === 'groups'} aria-controls="sms-compose-groups" disabled={sending} onClick={() => setBrowser(current => current === 'groups' ? null : 'groups')}>
                    Groups<ChevronDown className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {browser === 'people' && <div id="sms-compose-people" aria-label="People" className="max-h-52 overflow-y-auto border-t border-border/60 py-2">
                {directoryQuery.isLoading || directorySearch.trim() !== debouncedSearch ? <div role="status" className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5" />Finding people…</div>
                  : directoryQuery.isError ? <div role="alert" className="flex flex-wrap items-center gap-2 px-2 py-3 text-xs text-destructive">Could not load people.<Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void directoryQuery.refetch()} disabled={sending}>Retry people</Button></div>
                    : directoryGroups.length === 0 ? <p className="px-2 py-4 text-xs text-muted-foreground">{isPlausiblePhone(phoneInput) ? 'Press Enter to add this number.' : 'No matching people. You can also enter a phone number.'}</p>
                      : directoryGroups.map(group => <div key={group.heading} className="py-1">
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.heading}</p>
                        {group.people.map(person => {
                          const selected = recipients.some(item => item.key === phoneKey(person.phone));
                          return <button key={person.id} type="button" disabled={sending} onClick={() => addPerson(person)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground" aria-hidden="true">{person.name.slice(0, 1).toUpperCase()}</span>
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{person.name}</span><span className="block truncate text-xs text-muted-foreground">{person.subtitle || person.phone}</span></span>
                            {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                          </button>;
                        })}
                      </div>)}
              </div>}

              {browser === 'groups' && <div id="sms-compose-groups" aria-label="Saved groups" className="border-t border-border/60 pb-3 pt-2">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saved groups</span>
                  <div className="ml-auto flex items-center gap-1">
                    {recipients.length > 0 && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" disabled={sending} onClick={() => {
                      setGroupSeed(recipients.map(recipient => ({ key: recipient.key, name: recipient.label, phone: recipient.phone, userId: recipient.userId })));
                      setGroupsOpen(true);
                    }}>Save as group</Button>}
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={sending} onClick={() => { setGroupSeed([]); setGroupsOpen(true); }}>Manage</Button>
                  </div>
                </div>
                {groupsQuery.isLoading ? <p role="status" className="px-2 py-3 text-xs text-muted-foreground">Loading groups…</p>
                  : groupsQuery.isError ? <div role="alert" className="flex flex-wrap items-center gap-2 px-2 py-3 text-xs text-destructive">Could not load groups.<Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void groupsQuery.refetch()} disabled={sending}>Retry groups</Button></div>
                    : (groupsQuery.data ?? []).length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">No groups yet. Create one in Manage.</p>
                      : matchingGroups.length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">No matching groups. Try another name or clear search.</p>
                        : <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto px-2 py-1">{matchingGroups.map(group => {
                        const selected = groupIds.includes(group.id);
                        return <Button key={group.id} type="button" variant={selected ? 'secondary' : 'outline'} size="sm" aria-label={`${group.name}, ${group.member_count} ${group.member_count === 1 ? 'person' : 'people'}`} aria-pressed={selected} className={`h-9 gap-2 rounded-lg text-xs ${selected ? 'border border-primary/30 bg-primary/10 text-foreground' : ''}`} disabled={sending} onClick={() => toggleGroup(group.id)}>
                          {selected ? <Check className="h-3.5 w-3.5 text-primary" /> : <Users className="h-3.5 w-3.5 text-muted-foreground" />}{group.name}<span className="text-muted-foreground">{group.member_count}</span>
                        </Button>;
                      })}</div>}
                {selectedGroupCount > 0 && <p className="mt-2 px-2 text-xs text-muted-foreground">{selectedGroupCount} {selectedGroupCount === 1 ? 'person' : 'people'} in selected groups</p>}
              </div>}
            </div>

            <div className="flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
                <Label htmlFor="sms-compose-body" className="text-sm font-medium">Message</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" type="button" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground" disabled={!templates.length || sending}><Sparkles className="h-3.5 w-3.5" />Template</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">{templates.map(template => <DropdownMenuItem key={template.id} onClick={() => { if (template.body_text && !sending) setBodyText(template.body_text); }}>{template.name}</DropdownMenuItem>)}</DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Textarea id="sms-compose-body" value={bodyText} disabled={sending} onFocus={() => setBrowser(null)} onChange={event => setBodyText(event.target.value)} rows={7} placeholder="Write a message…" className="min-h-40 flex-1 resize-none rounded-none border-0 bg-transparent p-4 text-sm leading-relaxed shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 sm:p-5" />
              <div className="flex shrink-0 items-center justify-end px-4 pb-3 text-[11px] text-muted-foreground" aria-live="polite">{characterCount} chars · {segments} {segments === 1 ? 'segment' : 'segments'}</div>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-border/70 bg-background px-4 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex w-full max-w-[712px] flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 text-xs text-muted-foreground">{audience ? `To ${audience}` : 'Choose who you’d like to message'}</p>
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => handleOpenChange(false)} disabled={sending}>Cancel</Button>
              <Button type="button" onClick={handleSend} disabled={sending || !canSend} aria-label={audience ? `Send to ${audience}` : 'Send'} className="gap-2 rounded-xl px-5 shadow-sm">
                {sending ? <Loader2 aria-hidden="true" className="h-4 w-4" /> : <Send aria-hidden="true" className="h-4 w-4" />}<span>{sending ? 'Sending…' : 'Send'}</span>
              </Button>
            </div>
          </div>
        </footer>
      </section>
      <SmsGroupsDialog open={groupsOpen} onOpenChange={setGroupsOpen} initialMembers={groupSeed} />
    </>
  );
};
