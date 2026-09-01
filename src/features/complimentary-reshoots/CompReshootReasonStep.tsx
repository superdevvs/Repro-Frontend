import { ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  COMP_RESHOOT_REASON_OPTIONS,
  type CompReshootReasonCode,
} from './model';
import type { CompReshootBookingController } from './useCompReshootBooking';

type CompReshootReasonStepProps = {
  controller: CompReshootBookingController;
  onContinue: () => void;
};

export function CompReshootReasonStep({ controller, onContinue }: CompReshootReasonStepProps) {
  const serverOptions = controller.template?.reasonOptions ?? [];
  const options = serverOptions.length
    ? serverOptions.map((option) => ({
        value: option.code,
        label: option.label,
        description: COMP_RESHOOT_REASON_OPTIONS.find((fallback) => fallback.value === option.code)?.description ?? '',
      }))
    : COMP_RESHOOT_REASON_OPTIONS;
  const selected = options.find((option) => option.value === controller.reasonCode);
  const policy = controller.suggestedPolicy;

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card/40" aria-labelledby="comp-reason-heading">
      <div className="border-b border-border/70 px-4 py-3 sm:px-5">
        <h2 id="comp-reason-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          Why is a return visit needed?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">The reason suggests staff compensation and responsibility. You can confirm or change both on Review.</p>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="max-w-xl space-y-2">
          <Label htmlFor="comp-reshoot-reason">Reason</Label>
          <Select
            value={controller.reasonCode || undefined}
            onValueChange={(value) => controller.requestReasonChange(value as CompReshootReasonCode)}
            disabled={controller.isLoading || !controller.template}
          >
            <SelectTrigger id="comp-reshoot-reason" className="w-full">
              <SelectValue placeholder="Choose a reason" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected?.description && <p className="text-xs text-muted-foreground">{selected.description}</p>}
        </div>

        {controller.reasonCode === 'other' && (
          <div className="max-w-xl space-y-2">
            <Label htmlFor="comp-reshoot-other-reason">Internal reason</Label>
            <Input
              id="comp-reshoot-other-reason"
              value={controller.reasonNote}
              onChange={(event) => controller.setReasonNote(event.target.value)}
              placeholder="Describe why this return visit is complimentary"
            />
          </div>
        )}

        {policy && (
          <p className="text-xs text-muted-foreground" role="status">
            Suggested: photographer {policy.photographerMode ?? 'choose on Review'}; sales rep {policy.suggestedRepMode ?? 'choose on Review'}.
          </p>
        )}
      </div>
      <div className="flex justify-end border-t border-border/70 px-4 py-3 sm:px-5">
        <Button type="button" onClick={onContinue} disabled={!controller.reasonIsComplete || controller.isLoading}>
          Continue to services
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
