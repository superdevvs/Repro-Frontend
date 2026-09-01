import { RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
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
  return (
    <div
      className="border-b border-border/70 bg-muted/20 px-3 py-2 sm:px-5"
      data-testid="comp-service-mode-controls"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-h-9 w-full shrink-0 items-center gap-2 sm:w-auto">
          <RotateCcw
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              enabled ? 'text-primary' : 'text-muted-foreground',
            )}
            aria-hidden="true"
          />
          <Label htmlFor="comp-service-mode" className="whitespace-nowrap text-xs font-semibold">
            Comp mode
          </Label>
          <Switch
            id="comp-service-mode"
            aria-label="Comp mode"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
          {enabled && (
            <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {clientPays ? 'Client billed' : 'Client $0'}
            </span>
          )}
        </div>

        {enabled && (
          <>
            <div className="flex w-full min-w-0 flex-[1_1_14rem] items-center gap-2 sm:w-auto">
              <Label htmlFor="comp-service-reason" className="shrink-0 text-xs text-muted-foreground">
                Reason
              </Label>
              <Select
                value={reasonCode || undefined}
                onValueChange={(value) => onReasonCodeChange(value as CompReshootReasonCode)}
              >
                <SelectTrigger
                  id="comp-service-reason"
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
              className="flex w-full min-w-0 flex-[1_1_27rem] flex-wrap items-center gap-x-3 gap-y-1 sm:w-auto"
              role="group"
              aria-label="Billing and staff pay"
            >
              <label className="flex min-h-9 min-w-[8.5rem] flex-1 cursor-pointer items-center justify-between gap-2 whitespace-nowrap px-1 text-xs font-medium sm:min-h-8">
                Bill client
                <Switch
                  aria-label="Bill client for return visit"
                  checked={clientPays}
                  onCheckedChange={onClientPaysChange}
                />
              </label>
              <label className="flex min-h-9 min-w-[9.5rem] flex-1 cursor-pointer items-center justify-between gap-2 whitespace-nowrap px-1 text-xs font-medium sm:min-h-8">
                Pay photographer
                <Switch
                  aria-label="Pay photographer"
                  checked={payPhotographer}
                  onCheckedChange={onPayPhotographerChange}
                />
              </label>
              <label
                className={cn(
                  'flex min-h-9 min-w-[9.5rem] flex-1 items-center justify-between gap-2 px-1 text-xs font-medium sm:min-h-8',
                  hasSalesRep ? 'cursor-pointer' : 'cursor-not-allowed text-muted-foreground',
                )}
              >
                <span>
                  Pay sales rep
                  {!hasSalesRep && <span className="block text-[10px] font-normal">None assigned</span>}
                </span>
                <Switch
                  aria-label="Pay sales rep"
                  checked={paySalesRep}
                  onCheckedChange={onPaySalesRepChange}
                  disabled={!hasSalesRep}
                />
              </label>
            </div>
          </>
        )}
      </div>

      {enabled && reasonCode === 'other' && (
        <div className="mt-2 flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center">
          <Label htmlFor="comp-service-reason-note" className="shrink-0 text-xs text-muted-foreground">
            Internal note
          </Label>
          <Input
            id="comp-service-reason-note"
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
