import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { HoldNotificationOptions } from './useHoldNotifications';

export function HoldNotificationFields({ options, disabled = false }: { options: HoldNotificationOptions; disabled?: boolean }) {
  const id = useId();
  return <fieldset disabled={disabled} className="space-y-3 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">Notify about this hold</legend>
    <div className="flex flex-wrap gap-4">
      {(['email', 'sms'] as const).map((channel) => <div key={channel} className="flex items-center gap-2">
        <Checkbox id={`${id}-${channel}`} checked={options.channels.includes(channel)}
          disabled={disabled || (options.channels.length === 1 && options.channels.includes(channel))}
          onCheckedChange={(checked) => options.setChannel(channel, checked === true)} />
        <Label htmlFor={`${id}-${channel}`}>{channel === 'email' ? 'Email' : 'SMS'}</Label>
      </div>)}
    </div>
    <div className="flex items-start gap-2">
      <Checkbox id={`${id}-client`} checked={options.notifyClient} disabled={disabled || !options.clientAvailable}
        onCheckedChange={(checked) => options.setNotifyClient(checked === true)} />
      <div><Label htmlFor={`${id}-client`}>Notify agent / client</Label>
        {!options.clientAvailable && <p className="text-xs text-muted-foreground">No contact available for the selected channels.</p>}</div>
    </div>
    <div className="flex items-start gap-2">
      <Checkbox id={`${id}-photographer`} checked={options.notifyPhotographer} disabled={disabled || !options.photographerAvailable}
        onCheckedChange={(checked) => options.setNotifyPhotographer(checked === true)} />
      <div><Label htmlFor={`${id}-photographer`}>Notify assigned photographer(s)</Label>
        {!options.photographerAvailable && <p className="text-xs text-muted-foreground">No assigned photographer contact available for the selected channels.</p>}</div>
    </div>
    <p className="text-xs text-muted-foreground">Choose one or both channels. Uncheck both recipients to place the hold without email or SMS.</p>
  </fieldset>;
}
