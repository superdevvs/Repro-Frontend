import type { Control } from 'react-hook-form';

import { FormField } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type { PersonalInfoFormValues } from '@/pages/photographerAccountSchemas';

/**
 * The photographer's own "Default HDR bracket mode" preference control.
 *
 * Extracted verbatim from `PhotographerAccount.tsx` to keep that page under the
 * repository file-size limit. Copy, ids, ARIA roles and change handling are
 * unchanged.
 */
export function DefaultBracketModeField({
  control,
}: {
  control: Control<PersonalInfoFormValues>;
}) {
  return (
    /* Capture preference, not a rule. It seeds the execution value when a
       bracket-capable service is newly assigned; a service that already
       recorded its own size keeps it, so editing this never re-reads
       frames that are already stacked. */
    <FormField
      control={control}
      name="defaultBracketMode"
      render={({ field }) => (
        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="defaultBracketMode">Default HDR bracket mode</Label>
            <p className="text-sm text-muted-foreground">
              Exposures per final photo on new bracketed assignments. Existing shoots keep
              the size they were set to.
            </p>
          </div>
          <div
            id="defaultBracketMode"
            role="radiogroup"
            aria-label="Default HDR bracket mode"
            className="flex items-center gap-1 rounded-md border bg-muted/40 p-1"
          >
            {[5, 3].map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={field.value === mode}
                aria-label={`${mode}x`}
                onClick={() => field.onChange(mode as 3 | 5)}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  field.value === mode
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {mode}x
              </button>
            ))}
          </div>
        </div>
      )}
    />
  );
}
