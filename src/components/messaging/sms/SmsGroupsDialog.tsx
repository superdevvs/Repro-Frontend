import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Trash2, Users } from 'lucide-react';
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
  const [phoneInput, setPhoneInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const initialKey = initialMembers.map((member) => member.key).join('|');

  const groupsQuery = useQuery({
    queryKey: ['sms-groups'],
    queryFn: getSmsGroups,
    enabled: open,
  });

  const directoryQuery = useQuery({
    queryKey: ['sms-directory', search],
    queryFn: () => getSmsRecipients({ search: search || undefined, limit: 20 }),
    enabled: open && editing !== null,
  });

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setSearch('');
      setPhoneInput('');
      setConfirmDelete(false);
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
      <DialogContent className="sm:max-w-lg">
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
              <Label>People</Label>
              <div className="flex flex-wrap gap-2">
                {editing.members.map((member) => (
                  <Badge key={member.key} variant="secondary" className="gap-1 rounded-full px-3 py-1">
                    {member.name}
                    <button
                      type="button"
                      aria-label={`Remove ${member.name}`}
                      onClick={() => setEditing({
                        ...editing,
                        members: editing.members.filter((item) => item.key !== member.key),
                      })}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                {editing.members.length === 0 && (
                  <p className="text-sm text-muted-foreground">Add people from the directory or a phone number.</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Input
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

            <Command className="rounded-xl border border-border/70">
              <CommandInput placeholder="Search users and contacts..." value={search} onValueChange={setSearch} />
              <CommandList className="max-h-40">
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
                      {selectedKeys.has(phoneKey(person.phone)) && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
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
