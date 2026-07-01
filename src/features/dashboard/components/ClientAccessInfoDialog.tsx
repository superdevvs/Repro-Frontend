import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Key, UserRound, Home } from 'lucide-react';
import { toast } from '@/lib/sonner-toast';
import { updateShootAccessInfo, type ShootAccessInfo } from '@/services/shoots';
import type { ClientShootRecord } from '@/utils/dashboardDerivedUtils';

type PresenceOption = 'self' | 'other' | 'lockbox';

interface ClientAccessInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ClientShootRecord | null;
  onSaved?: () => void;
}

/**
 * Client-facing "Provide access info" form (lockbox-text-code-access-info path).
 *
 * Text/code only by design — there is intentionally NO photo/image upload here.
 * Uploading images for property access stays disabled until malware scanning is
 * available. Submissions persist to the shoot's property_details via the
 * client-scoped access-info allowlist on PATCH /shoots/{id}.
 */
export const ClientAccessInfoDialog = ({ open, onOpenChange, record, onSaved }: ClientAccessInfoDialogProps) => {
  const queryClient = useQueryClient();

  const [presenceOption, setPresenceOption] = useState<PresenceOption>('self');
  const [lockboxCode, setLockboxCode] = useState('');
  const [lockboxLocation, setLockboxLocation] = useState('');
  const [accessContactName, setAccessContactName] = useState('');
  const [accessContactPhone, setAccessContactPhone] = useState('');

  // Prefill from the shoot whenever the dialog opens for a (new) record.
  useEffect(() => {
    if (!open) return;
    const existing = record?.data.propertyDetails ?? {};
    const presence = existing.presenceOption;
    setPresenceOption(presence === 'lockbox' || presence === 'other' ? presence : 'self');
    setLockboxCode(existing.lockboxCode ?? '');
    setLockboxLocation(existing.lockboxLocation ?? '');
    setAccessContactName(existing.accessContactName ?? '');
    setAccessContactPhone(existing.accessContactPhone ?? '');
  }, [open, record?.data.id, record?.data.propertyDetails]);

  const mutation = useMutation({
    mutationFn: (info: ShootAccessInfo) => updateShootAccessInfo(String(record!.data.id), info),
    onSuccess: () => {
      toast.success('Access info saved. Thanks — this helps your photographer arrive prepared.');
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: () => toast.error('Unable to save access info. Please try again or contact support.'),
  });

  const handleSubmit = () => {
    if (!record) return;
    if (presenceOption === 'lockbox' && !lockboxCode.trim() && !lockboxLocation.trim()) {
      toast.error('Add the lockbox code or its location so the photographer can get in.');
      return;
    }
    if (presenceOption === 'other' && !accessContactName.trim() && !accessContactPhone.trim()) {
      toast.error('Add a name or phone number for whoever will provide access.');
      return;
    }
    mutation.mutate({
      presenceOption,
      lockboxCode,
      lockboxLocation,
      accessContactName,
      accessContactPhone,
    });
  };

  const addressLabel = record?.summary.addressLine || 'this shoot';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Provide access info</DialogTitle>
          <DialogDescription>
            Let us know how the photographer will get into {addressLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup
            value={presenceOption}
            onValueChange={(value) => setPresenceOption(value as PresenceOption)}
            className="grid gap-2"
          >
            <label
              htmlFor="access-self"
              className="flex items-center gap-2 rounded-lg border p-2.5 text-sm cursor-pointer hover:bg-muted/50"
            >
              <RadioGroupItem value="self" id="access-self" />
              <Home className="h-4 w-4 text-muted-foreground" />
              I (or someone) will be there to let them in
            </label>
            <label
              htmlFor="access-lockbox"
              className="flex items-center gap-2 rounded-lg border p-2.5 text-sm cursor-pointer hover:bg-muted/50"
            >
              <RadioGroupItem value="lockbox" id="access-lockbox" />
              <Key className="h-4 w-4 text-muted-foreground" />
              There's a lockbox / gate code
            </label>
            <label
              htmlFor="access-other"
              className="flex items-center gap-2 rounded-lg border p-2.5 text-sm cursor-pointer hover:bg-muted/50"
            >
              <RadioGroupItem value="other" id="access-other" />
              <UserRound className="h-4 w-4 text-muted-foreground" />
              Someone else will provide access
            </label>
          </RadioGroup>

          {presenceOption === 'lockbox' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-lockbox-code" className="text-xs text-muted-foreground">
                  Lockbox / gate code
                </Label>
                <Input
                  id="access-lockbox-code"
                  value={lockboxCode}
                  onChange={(event) => setLockboxCode(event.target.value)}
                  placeholder="####"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-lockbox-location" className="text-xs text-muted-foreground">
                  Location / instructions
                </Label>
                <Input
                  id="access-lockbox-location"
                  value={lockboxLocation}
                  onChange={(event) => setLockboxLocation(event.target.value)}
                  placeholder="e.g., on the front gate"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {presenceOption === 'other' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-contact-name" className="text-xs text-muted-foreground">
                  Contact name
                </Label>
                <Input
                  id="access-contact-name"
                  value={accessContactName}
                  onChange={(event) => setAccessContactName(event.target.value)}
                  placeholder="Who to meet"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-contact-phone" className="text-xs text-muted-foreground">
                  Contact phone
                </Label>
                <Input
                  id="access-contact-phone"
                  value={accessContactPhone}
                  onChange={(event) => setAccessContactPhone(event.target.value)}
                  placeholder="(555) 555-5555"
                  autoComplete="off"
                  inputMode="tel"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save access info'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
