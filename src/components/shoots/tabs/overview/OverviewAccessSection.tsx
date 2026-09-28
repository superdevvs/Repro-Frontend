import { Key, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type PresenceOption = 'self' | 'other' | 'lockbox';

type OverviewAccessSectionProps = {
  unitAccessNotes?: string;
  isEditMode: boolean;
  propertyDetails: Record<string, unknown>;
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

const accessText = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

function getSavedAccess(propertyDetails: Record<string, unknown>) {
  const code = accessText(propertyDetails.lockboxCode);
  const instructions = accessText(propertyDetails.lockboxLocation);
  const contactName = accessText(propertyDetails.accessContactName);
  const contactPhone = accessText(propertyDetails.accessContactPhone);
  const mode = propertyDetails.presenceOption === 'self'
    ? 'self'
    : code || instructions || propertyDetails.presenceOption === 'lockbox'
      ? 'lockbox'
      : contactName || contactPhone || propertyDetails.presenceOption === 'other'
        ? 'other'
        : 'unavailable';
  return { mode, code, instructions, contactName, contactPhone };
}

export function OverviewAccessDescription({
  propertyDetails = {},
  unitAccessNotes,
}: {
  propertyDetails?: Record<string, unknown>;
  unitAccessNotes?: string;
}) {
  const access = getSavedAccess(propertyDetails);
  const instructions = access.mode === 'lockbox' ? access.instructions : '';
  const unitNotes = accessText(unitAccessNotes);
  if (!instructions && !unitNotes) return null;

  return (
    <div aria-label="Access instructions" className="min-w-0 space-y-1.5 border-t p-2.5 text-xs">
      {instructions && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"><span className="font-medium text-muted-foreground">Access: </span>{instructions}</p>}
      {unitNotes && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"><span className="font-medium text-muted-foreground">Unit access: </span>{unitNotes}</p>}
    </div>
  );
}

export function OverviewAccessSection({
  unitAccessNotes,
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
  if (!isEditMode) {
    const access = getSavedAccess(propertyDetails);
    const isLockbox = access.mode === 'lockbox';
    const Icon = isLockbox ? Key : UserCheck;
    return (
      <div className="min-w-0 p-2.5" aria-label="Property access">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
          <span className="text-[11px] font-semibold uppercase">
            <span className="sm:hidden">{isLockbox ? 'Lockbox' : 'Access'}</span>
            <span className="hidden sm:inline">{isLockbox ? 'Lockbox code' : 'Property access'}</span>
          </span>
        </div>
        <div className="break-words text-xs [overflow-wrap:anywhere]">
          {isLockbox ? (
            <span className={access.code ? 'font-mono font-semibold' : 'text-muted-foreground'}>{access.code || 'Not provided'}</span>
          ) : access.mode === 'self' ? (
            <span>Client present</span>
          ) : access.mode === 'other' ? (
            <div className="space-y-0.5">
              <div className="font-medium">{access.contactName || 'Other contact'}</div>
              {access.contactPhone && <a href={`tel:${access.contactPhone}`} className="block text-primary hover:underline">{access.contactPhone}</a>}
              {!access.contactName && !access.contactPhone && <span className="text-muted-foreground">Details not provided</span>}
            </div>
          ) : <span className="text-muted-foreground">Unavailable</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-2.5 border rounded-lg bg-card h-full">
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
        <div className="space-y-3 text-xs">
          <RadioGroup
            value={presenceOption}
            onValueChange={(value) => setPresenceOption(value as PresenceOption)}
            className="grid grid-cols-1 gap-1.5"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="self" id="presence-self" />
              <Label htmlFor="presence-self" className="text-xs cursor-pointer">Self</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="other" id="presence-other" />
              <Label htmlFor="presence-other" className="text-xs cursor-pointer whitespace-nowrap">Other contact</Label>
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
      {accessText(unitAccessNotes) && <p className="mt-2 whitespace-pre-wrap break-words border-t pt-2 text-xs"><span className="font-medium">Unit access: </span>{accessText(unitAccessNotes)}</p>}
    </div>
  );
}
