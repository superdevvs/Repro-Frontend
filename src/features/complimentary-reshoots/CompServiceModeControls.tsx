import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useId } from 'react';
import {
  COMP_RESHOOT_REASON_OPTIONS,
  type CompReshootReasonCode,
} from './model';

type CompServiceModeControlsProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  reasonCode: CompReshootReasonCode | '';
  onReasonCodeChange: (reason: CompReshootReasonCode) => void;
  reasonNote: string;
  onReasonNoteChange: (note: string) => void;
  payPhotographer: boolean;
  onPayPhotographerChange: (enabled: boolean) => void;
  paySalesRep: boolean;
  onPaySalesRepChange: (enabled: boolean) => void;
  clientPays: boolean;
  onClientPaysChange: (enabled: boolean) => void;
  hasSalesRep: boolean;
};

export function CompServiceModeControls({
  enabled,
  onEnabledChange,
  reasonCode,
  onReasonCodeChange,
  reasonNote,
  onReasonNoteChange,
  payPhotographer,
  onPayPhotographerChange,
  paySalesRep,
  onPaySalesRepChange,
  clientPays,
  onClientPaysChange,
  hasSalesRep,
}: CompServiceModeControlsProps) {
  const controlId = useId();
  return (
    <div
      className="service-picker-comp shrink-0 border-b border-border/70 p-4"
      data-enabled={enabled}
      data-testid="comp-service-mode-controls"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-h-8 shrink-0 items-center gap-2 sm:w-auto">
          <Label htmlFor={`${controlId}-comp-service-mode`} className="whitespace-nowrap text-xs font-medium">
            Comp mode
          </Label>
          <Switch
            id={`${controlId}-comp-service-mode`}
            aria-label="Comp mode"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
          {enabled && (
            <span className="whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium text-[var(--picker-accent)]">
              {clientPays ? 'Client billed' : 'Client $0'}
            </span>
          )}
        </div>

        {enabled && (
          <>
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-[250px]">
              <Label htmlFor={`${controlId}-comp-service-reason`} className="shrink-0 text-xs text-muted-foreground">
                Reason
              </Label>
              <Select
                value={reasonCode || undefined}
                onValueChange={(value) => onReasonCodeChange(value as CompReshootReasonCode)}
              >
                <SelectTrigger
                  id={`${controlId}-comp-service-reason`}
                  className="h-9 min-w-0 flex-1 bg-background text-xs sm:h-8"
                >
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {COMP_RESHOOT_REASON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3"
              role="group"
              aria-label="Billing and staff pay"
            >
              <label className="flex min-h-8 cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-medium">
                Bill client
                <Switch
                  aria-label="Bill client for return visit"
                  checked={clientPays}
                  onCheckedChange={onClientPaysChange}
                />
              </label>
              <label className="flex min-h-8 cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-medium">
                Pay photographer
                <Switch
                  aria-label="Pay photographer"
                  checked={payPhotographer}
                  onCheckedChange={onPayPhotographerChange}
                />
              </label>
              {hasSalesRep ? <label className="flex min-h-8 cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-medium">
                Pay sales rep
                <Switch aria-label="Pay sales rep" checked={paySalesRep} onCheckedChange={onPaySalesRepChange} />
              </label> : <div className="flex min-h-8 items-center gap-2 whitespace-nowrap text-xs">
                <span>Pay sales rep</span>
                <span className="rounded-md border border-border bg-background px-2 py-1.5 text-muted-foreground">Not assigned</span>
              </div>}
            </div>
          </>
        )}
      </div>

      {enabled && reasonCode === 'other' && (
        <div className="mt-2 flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center">
          <Label htmlFor={`${controlId}-comp-service-reason-note`} className="shrink-0 text-xs text-muted-foreground">
            Internal note
          </Label>
          <Input
            id={`${controlId}-comp-service-reason-note`}
            value={reasonNote}
            onChange={(event) => onReasonNoteChange(event.target.value)}
            placeholder="Why is this return visit needed?"
            className="h-9 min-w-0 bg-background text-xs sm:h-8"
          />
        </div>
      )}
    </div>
  );
}
