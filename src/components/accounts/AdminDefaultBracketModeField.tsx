import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import type { AccountFormController } from './useAccountFormController';

/**
 * The admin-side "Default HDR bracket mode" control on the account form.
 *
 * Extracted verbatim from `AccountFormView.tsx` to keep that component under the
 * repository file-size limit. Copy, ids, ARIA roles and change handling are
 * unchanged. Rendered only for the photographer role, exactly as before.
 */
export function AdminDefaultBracketModeField({
  control,
}: {
  control: AccountFormController['form']['control'];
}) {
  return (
    /* Photographer-only. A capture preference, not a rule: it seeds the
       execution value when a bracket-capable service is newly assigned, and
       a shoot that already recorded its own size keeps it. */
    <FormField
      control={control}
      name="defaultBracketMode"
      render={({ field }) => (
        <FormItem className="rounded-md border p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <FormLabel htmlFor="adminDefaultBracketMode">Default HDR bracket mode</FormLabel>
              <p className="text-sm text-muted-foreground">
                Used for new bracketed service assignments. Existing assigned shoots keep
                their current bracket size.
              </p>
            </div>
            <div
              id="adminDefaultBracketMode"
              role="radiogroup"
              aria-label="Default HDR bracket mode"
              className="flex shrink-0 items-center gap-1 rounded-md border bg-muted/40 p-1"
            >
              {[5, 3].map((mode) => {
                const isSelected = Number(field.value ?? 5) === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${mode}x`}
                    onClick={() => field.onChange(mode as 3 | 5)}
                    className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {mode}x
                  </button>
                );
              })}
            </div>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
