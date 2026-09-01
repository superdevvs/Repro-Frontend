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
  hasSalesRep,
}: CompServiceModeControlsProps) {
  return (
    <div
      className={cn(
        'border-b border-border/70 px-3 py-2.5 transition-colors sm:px-6',
        enabled && 'bg-amber-50/70 dark:bg-amber-950/20',
      )}
      data-testid="comp-service-mode-controls"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <RotateCcw className={cn('h-3.5 w-3.5', enabled ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')} />
            <Label htmlFor="comp-service-mode" className="text-sm font-semibold">Comp Mode</Label>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Select services for a no-charge return visit.
          </p>
        </div>
        <Switch
          id="comp-service-mode"
          aria-label="Comp Mode"
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>

      {enabled && (
        <div className="mt-3 grid gap-3 border-t border-amber-200/70 pt-3 dark:border-amber-800/60 sm:grid-cols-[minmax(12rem,1fr)_minmax(16rem,1.25fr)] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="comp-service-reason" className="text-xs">Reason</Label>
            <Select
              value={reasonCode || undefined}
              onValueChange={(value) => onReasonCodeChange(value as CompReshootReasonCode)}
            >
              <SelectTrigger id="comp-service-reason" className="h-9 bg-background">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {COMP_RESHOOT_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground">Staff pay</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex min-h-9 items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs font-medium">
                Photographer
                <Switch
                  aria-label="Pay photographer"
                  checked={payPhotographer}
                  onCheckedChange={onPayPhotographerChange}
                />
              </label>
              <label className={cn(
                'flex min-h-9 items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs font-medium',
                !hasSalesRep && 'text-muted-foreground',
              )}>
                <span>
                  Sales rep
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
            <p className="mt-1 text-[11px] text-muted-foreground">
              {hasSalesRep
                ? 'Leave both off to pay neither; either or both may be enabled.'
                : 'No sales rep is assigned, so only photographer pay is available.'}
            </p>
          </div>

          {reasonCode === 'other' && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="comp-service-reason-note" className="text-xs">Internal reason</Label>
              <Input
                id="comp-service-reason-note"
                value={reasonNote}
                onChange={(event) => onReasonNoteChange(event.target.value)}
                placeholder="Describe why the return visit is complimentary"
                className="h-9 bg-background"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
