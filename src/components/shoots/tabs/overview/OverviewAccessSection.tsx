import { Key, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type PresenceOption = 'self' | 'other' | 'lockbox';

type OverviewAccessSectionProps = {
  isEditMode: boolean;
  propertyDetails: Record<string, any>;
  presenceOption: PresenceOption;
  setPresenceOption: (value: PresenceOption) => void;
  lockboxCode: string;
  setLockboxCode: (value: string) => void;
  lockboxLocation: string;
  setLockboxLocation: (value: string) => void;
  accessContactName: string;
  setAccessContactName: (value: string) => void;
  accessContactPhone: string;
  setAccessContactPhone: (value: string) => void;
};

export function OverviewAccessSection({
  isEditMode,
  propertyDetails,
  presenceOption,
  setPresenceOption,
  lockboxCode,
  setLockboxCode,
  lockboxLocation,
  setLockboxLocation,
  accessContactName,
  setAccessContactName,
  accessContactPhone,
  setAccessContactPhone,
}: OverviewAccessSectionProps) {
  return (
    <div className="p-2.5 border rounded-lg bg-card">
      <div className="flex items-center gap-1.5 mb-1.5">
        {presenceOption === 'lockbox' ? (
          <Key className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-[11px] font-semibold text-muted-foreground uppercase">
          Property Access
        </span>
      </div>
      {isEditMode ? (
        <div className="space-y-3 text-xs">
          <RadioGroup
            value={presenceOption}
            onValueChange={(value) => setPresenceOption(value as PresenceOption)}
            className="grid grid-cols-3 gap-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="self" id="presence-self" />
              <Label htmlFor="presence-self" className="text-xs cursor-pointer">Self</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="other" id="presence-other" />
              <Label htmlFor="presence-other" className="text-xs cursor-pointer">Other contact</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="lockbox" id="presence-lockbox" />
              <Label htmlFor="presence-lockbox" className="text-xs cursor-pointer">Lockbox</Label>
            </div>
          </RadioGroup>
          {presenceOption === 'lockbox' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Lockbox code</span>
                <Input
                  value={lockboxCode}
                  onChange={(event) => setLockboxCode(event.target.value)}
                  className="h-7 text-xs"
                  placeholder="####"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Location / instructions</span>
                <Input
                  value={lockboxLocation}
                  onChange={(event) => setLockboxLocation(event.target.value)}
                  className="h-7 text-xs"
                  placeholder="e.g., on the gate"
                />
              </div>
            </div>
          )}
          {presenceOption === 'other' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Contact name</span>
                <Input
                  value={accessContactName}
                  onChange={(event) => setAccessContactName(event.target.value)}
                  className="h-7 text-xs"
                  placeholder="Full name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Contact phone</span>
                <Input
                  value={accessContactPhone}
                  onChange={(event) => setAccessContactPhone(event.target.value)}
                  className="h-7 text-xs"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          )}
          {presenceOption === 'self' && (
            <p className="text-muted-foreground text-[11px]">Client will be present at the property.</p>
          )}
        </div>
      ) : (() => {
        const details = propertyDetails || {};
        const hasLockboxData = !!(details.lockboxCode || details.lockboxLocation);
        const hasAccessContactData = !!(details.accessContactName || details.accessContactPhone);
        if (!hasLockboxData && !hasAccessContactData) {
          return <div className="text-xs text-muted-foreground">No access details provided.</div>;
        }
        const isLockbox = hasLockboxData || details.presenceOption === 'lockbox';
        return (
          <div className="space-y-1 text-xs">
            {isLockbox ? (
              <>
                {details.lockboxCode && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Code:</span>
                    <span className="font-medium font-mono">{details.lockboxCode}</span>
                  </div>
                )}
                {details.lockboxLocation && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium text-right flex-1">{details.lockboxLocation}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {details.accessContactName && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">On-site Contact:</span>
                    <span className="font-medium">{details.accessContactName}</span>
                  </div>
                )}
                {details.accessContactPhone && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Contact Phone:</span>
                    <a href={`tel:${details.accessContactPhone}`} className="font-medium text-primary hover:underline">
                      {details.accessContactPhone}
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
