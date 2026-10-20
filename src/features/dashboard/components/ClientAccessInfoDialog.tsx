import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PropertyAccessToggle } from '@/components/shoots/PropertyAccessToggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/sonner-toast';
import { updateShootAccessInfo, type ShootAccessInfo } from '@/services/shoots';
import { useShootMutationRefresh } from '@/hooks/useShootMutationRefresh';
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
  const refreshShootMutations = useShootMutationRefresh();

  const [presenceOption, setPresenceOption] = useState<PresenceOption | ''>('');
  const [lockboxCode, setLockboxCode] = useState('');
  const [lockboxLocation, setLockboxLocation] = useState('');
  const [accessContactName, setAccessContactName] = useState('');
  const [accessContactPhone, setAccessContactPhone] = useState('');

  // Prefill from the shoot whenever the dialog opens for a (new) record.
  useEffect(() => {
    if (!open) return;
    const existing = record?.data.propertyDetails ?? {};
    const presence = existing.presenceOption;
    setPresenceOption(presence === 'lockbox' || presence === 'other' || presence === 'self' ? presence : '');
    setLockboxCode(existing.lockboxCode ?? '');
    setLockboxLocation(existing.lockboxLocation ?? '');
    setAccessContactName(existing.accessContactName ?? '');
    setAccessContactPhone(existing.accessContactPhone ?? '');
  }, [open, record?.data.id, record?.data.propertyDetails]);

  const mutation = useMutation({
    mutationFn: (info: ShootAccessInfo) => updateShootAccessInfo(String(record!.data.id), info),
    onSuccess: () => {
      toast.success('Access info saved. Thanks — this helps your photographer arrive prepared.');
      refreshShootMutations(record?.data.id);
      onSaved?.();
      onOpenChange(false);
    },
    onError: () => toast.error('Unable to save access info. Please try again or contact support.'),
  });

  const handleSubmit = () => {
    if (!record) return;
    if (!presenceOption) {
      toast.error('Choose how the photographer will get into the property.');
      return;
    }
    if (presenceOption === 'lockbox' && !lockboxCode.trim()) {
      toast.error('Add the lockbox or gate code so the photographer can get in.');
      return;
    }
    if (presenceOption === 'other' && (!accessContactName.trim() || !accessContactPhone.trim())) {
      toast.error('Add a name and phone number for whoever will provide access.');
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
          <PropertyAccessToggle value={presenceOption} onChange={setPresenceOption} disabled={mutation.isPending} />
          {presenceOption === 'self' && <p className="text-sm text-muted-foreground">I will be at the property to let the photographer in.</p>}

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
