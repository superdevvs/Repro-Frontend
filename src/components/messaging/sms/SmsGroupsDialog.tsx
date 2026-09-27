import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Trash2, Users, X } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from '@/lib/sonner-toast';
import { deleteSmsGroup, getSmsGroups, getSmsRecipients, saveSmsGroup, type SmsDirectoryRecipient, type SmsGroupRecord } from '@/services/messaging';
import { getComposeErrorMessage } from '@/pages/messaging/emailComposeModel';

export type SmsGroupDraftMember = {
  key: string;
  name: string;
  phone: string;
  userId?: number | null;
};

const phoneKey = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const memberFromDirectory = (person: SmsDirectoryRecipient): SmsGroupDraftMember => ({
  key: phoneKey(person.phone),
  name: person.name,
  phone: person.phone,
  userId: person.user_id,
});

const ROLE_OPTIONS = [
  { role: 'photographer', label: 'All photographers' },
  { role: 'client', label: 'All clients' },
  { role: 'editor', label: 'All editors' },
];

export const SmsGroupsDialog = ({
  open,
  onOpenChange,
  initialMembers = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMembers?: SmsGroupDraftMember[];
}) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ id: number | null; name: string; members: SmsGroupDraftMember[] } | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeRoles, setActiveRoles] = useState<string[]>([]);
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const initialKey = initialMembers.map((member) => member.key).join('|');

  const groupsQuery = useQuery({
    queryKey: ['sms-groups'],
    queryFn: getSmsGroups,
    enabled: open,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const directoryQuery = useQuery({
    queryKey: ['sms-directory', debouncedSearch],
    queryFn: () => getSmsRecipients({ search: debouncedSearch || undefined, limit: 30 }),
    enabled: open && editing !== null,
  });

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setSearch('');
      setDebouncedSearch('');
      setPhoneInput('');
      setConfirmDelete(false);
      setActiveRoles([]);
      setRoleBusy(null);
      return;
    }
    if (initialMembers.length > 0) {
      setEditing({ id: null, name: '', members: initialMembers });
    }
  }, [open, initialKey, initialMembers]);

  const saveMutation = useMutation({
    mutationFn: saveSmsGroup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sms-groups'] });
      toast.success('Group saved');
      setEditing(null);
      setConfirmDelete(false);
    },
    onError: (error) => toast.error(getComposeErrorMessage(error, 'Unable to save group')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSmsGroup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sms-groups'] });
      toast.success('Group deleted');
      setEditing(null);
      setConfirmDelete(false);
    },
    onError: (error) => toast.error(getComposeErrorMessage(error, 'Unable to delete group')),
  });

  const selectedKeys = useMemo(() => new Set(editing?.members.map((member) => member.key) ?? []), [editing]);

  const startNew = () => {
    setConfirmDelete(false);
    setEditing({ id: null, name: '', members: [] });
  };

  const startEdit = (group: SmsGroupRecord) => {
    setConfirmDelete(false);
    setEditing({
      id: group.id,
      name: group.name,
      members: group.members.map((member) => ({
        key: phoneKey(member.phone),
        name: member.name || member.phone,
        phone: member.phone,
        userId: member.user_id,
      })),
    });
  };

  const addMember = (member: SmsGroupDraftMember) => {
    setEditing((current) => {
      if (!current || current.members.some((item) => item.key === member.key)) return current;
      return { ...current, members: [...current.members, member] };
    });
  };

  const toggleRole = async (role: string) => {
    if (!editing || roleBusy) return;
    setRoleBusy(role);
    try {
      const people = await getSmsRecipients({ role, limit: 100 });
      const incoming = people.map(memberFromDirectory);
      const incomingKeys = new Set(incoming.map((member) => member.key));
      if (activeRoles.includes(role)) {
        setEditing((current) => current ? {
          ...current,
          members: current.members.filter((member) => !incomingKeys.has(member.key)),
        } : current);
        setActiveRoles((current) => current.filter((item) => item !== role));
        return;
      }
      let added = 0;
      setEditing((current) => {
        if (!current) return current;
        const keys = new Set(current.members.map((member) => member.key));
        const next = incoming.filter((member) => !keys.has(member.key));
        added = next.length;
        return { ...current, members: [...current.members, ...next] };
      });
      const label = ROLE_OPTIONS.find((option) => option.role === role)?.label.replace(/^All /, '') ?? 'people';
      if (people.length === 0) {
        toast.error(`No ${label} have a phone number on file.`);
        return;
      }
      setActiveRoles((current) => [...current, role]);
      toast.success(added === 0
        ? `Every ${label.replace(/s$/, '')} with a phone is already in this group.`
        : `Added ${added} ${label}.`);
    } catch (error) {
      toast.error(getComposeErrorMessage(error, 'Unable to load that group'));
    } finally {
      setRoleBusy(null);
    }
  };

  const addPhone = () => {
    const key = phoneKey(phoneInput);
    if (key.length < 10) return;
    addMember({ key, name: phoneInput.trim(), phone: phoneInput.trim() });
    setPhoneInput('');
  };

  const save = () => {
    if (!editing || !editing.name.trim() || editing.members.length === 0) return;
    saveMutation.mutate({
      id: editing.id ?? undefined,
      name: editing.name.trim(),
      members: editing.members.map((member) => ({
        user_id: member.userId,
        name: member.name,
        phone: member.phone,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex !h-auto max-h-[min(860px,calc(100dvh-2rem))] !w-[min(960px,calc(100vw-2rem))] !max-w-[min(960px,calc(100vw-2rem))] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>SMS groups</DialogTitle>
          <DialogDescription>Save people you text together, then send to the whole group.</DialogDescription>
        </DialogHeader>

        {!editing && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {groupsQuery.data?.length ? `${groupsQuery.data.length} saved` : 'No groups yet'}
              </p>
              <Button type="button" size="sm" onClick={startNew}>
                <Users className="mr-2 h-4 w-4" />
                New group
              </Button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {(groupsQuery.data ?? []).map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-left hover:bg-muted/40"
                  onClick={() => startEdit(group)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{group.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {group.member_count} {group.member_count === 1 ? 'person' : 'people'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {editing && (
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:overflow-hidden">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sms-group-name">Name</Label>
                <Input
                  id="sms-group-name"
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  placeholder="Weekend crew"
                />
              </div>

              <div className="space-y-2">
                <Label>Add a role</Label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((option) => {
                    const selected = activeRoles.includes(option.role);
                    return (
                      <Button
                        key={option.role}
                        type="button"
                        size="sm"
                        variant={selected ? 'default' : 'outline'}
                        disabled={roleBusy !== null}
                        onClick={() => void toggleRole(option.role)}
                      >
                        {roleBusy === option.role ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> : null}
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Selects everyone in that role who has a phone number.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sms-group-phone">Phone number</Label>
                <div className="flex gap-2">
                  <Input
                    id="sms-group-phone"
                    value={phoneInput}
                    onChange={(event) => setPhoneInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addPhone();
                      }
                    }}
                    placeholder="Add a phone number"
                    autoComplete="tel"
                  />
                  <Button type="button" variant="outline" onClick={addPhone} disabled={phoneKey(phoneInput).length < 10}>
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <Label>People</Label>
                <span className="text-xs text-muted-foreground">
                  {editing.members.length} {editing.members.length === 1 ? 'person' : 'people'}
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-border/70 p-3 md:max-h-40">
                <div className="flex flex-wrap gap-2">
                  {editing.members.map((member) => (
                    <Badge key={member.key} variant="secondary" className="gap-1 rounded-full px-3 py-1">
                      {member.name}
                      <button
                        type="button"
                        className="rounded-full text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${member.name}`}
                        onClick={() => {
                          setActiveRoles([]);
                          setEditing({
                            ...editing,
                            members: editing.members.filter((item) => item.key !== member.key),
                          });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {editing.members.length === 0 && (
                    <p className="text-sm text-muted-foreground">Add a role, search for someone, or enter a phone number.</p>
                  )}
                </div>
              </div>

              <Command className="min-h-0 rounded-xl border border-border/70 md:flex-1">
                <CommandInput placeholder="Search users and contacts..." value={search} onValueChange={setSearch} />
                <CommandList className="max-h-52 md:max-h-none md:flex-1">
                  <CommandEmpty>No matching people with a phone number.</CommandEmpty>
                  <CommandGroup>
                    {(directoryQuery.data ?? []).map((person) => (
                      <CommandItem
                        key={person.id}
                        value={`${person.name} ${person.phone} ${person.subtitle ?? ''}`}
                        onSelect={() => addMember(memberFromDirectory(person))}
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{person.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{person.subtitle || person.phone}</span>
                        </div>
                        {selectedKeys.has(phoneKey(person.phone)) && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {editing ? (
            <>
              <div>
                {editing.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (!confirmDelete) {
                        setConfirmDelete(true);
                        return;
                      }
                      deleteMutation.mutate(editing.id as number);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {confirmDelete ? 'Delete group?' : 'Delete'}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={save}
                  disabled={saveMutation.isPending || !editing.name.trim() || editing.members.length === 0}
                >
                  Save group
                </Button>
              </div>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
