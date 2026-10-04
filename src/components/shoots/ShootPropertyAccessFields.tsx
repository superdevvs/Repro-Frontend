import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { PropertyDetails } from './shootEditModalTypes';

export function ShootPropertyAccessFields({ details, onChange }: {
  details: PropertyDetails | null;
  onChange: (patch: Partial<PropertyDetails>) => void;
}) {
  const id = useId();
  const presence = String(details?.presenceOption ?? '');
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <Label id={`${id}-label`} className="text-xs font-semibold">Property access</Label>
      <RadioGroup aria-labelledby={`${id}-label`} value={presence}
        onValueChange={(presenceOption) => onChange({ presenceOption })}
        className="flex flex-wrap gap-3 text-xs">
        {([['self', 'Self / client'], ['other', 'Another contact'], ['lockbox', 'Lockbox']] as const).map(([value, label]) => (
          <div key={value} className="flex items-center gap-1.5">
            <RadioGroupItem id={`${id}-${value}`} value={value} />
            <Label htmlFor={`${id}-${value}`} className="text-xs font-normal">{label}</Label>
          </div>
        ))}
      </RadioGroup>
      {presence === 'other' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input aria-label="On-site contact name" placeholder="Contact name" className="h-8 text-xs"
            value={String(details?.accessContactName ?? '')} onChange={(e) => onChange({ accessContactName: e.target.value })} />
          <Input aria-label="On-site contact phone" placeholder="Contact phone" type="tel" className="h-8 text-xs"
            value={String(details?.accessContactPhone ?? '')} onChange={(e) => onChange({ accessContactPhone: e.target.value })} />
        </div>
      )}
      {presence === 'lockbox' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input aria-label="Lockbox code" placeholder="Lockbox code" className="h-8 text-xs"
            value={String(details?.lockboxCode ?? '')} onChange={(e) => onChange({ lockboxCode: e.target.value })} />
          <Input aria-label="Lockbox location" placeholder="Lockbox location" className="h-8 text-xs"
            value={String(details?.lockboxLocation ?? '')} onChange={(e) => onChange({ lockboxLocation: e.target.value })} />
        </div>
      )}
    </div>
  );
}
