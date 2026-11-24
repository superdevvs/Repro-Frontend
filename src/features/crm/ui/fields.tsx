import React, { useId } from 'react';
import { cn } from '@/lib/utils';

const control = 'h-8 w-full rounded-lg border border-input bg-background px-2.5 text-[13px] outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground aria-[invalid=true]:border-rose-500 max-md:h-10 max-md:text-[15px]';

/** A labelled field. Children receive the id for the label. */
export function Field({ label, required, hint, error, className, children }: {
  label: string; required?: boolean; hint?: React.ReactNode; error?: string | null; className?: string;
  children: (id: string, describedBy?: string) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium">{label}{required && <span className="crm-text-red"> *</span>}</label>
      {children(id, describedBy)}
      {error ? <p id={`${id}-error`} className="crm-text-red text-xs">{error}</p> : hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(control, className)} {...props} />
));
TextInput.displayName = 'TextInput';

export function TextArea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'h-auto min-h-[78px] py-2 leading-5', className)} {...props} />;
}

export function Select({ className, options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select className={cn(control, 'pr-7', className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** A compact filter dropdown like "Rep: All reps" in the designs. */
export function FilterSelect({ label, value, onChange, options, allLabel }: {
  label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; allLabel: string;
}) {
  const id = useId();
  return (
    <div className="relative flex h-8 items-center rounded-lg border bg-background pl-2.5 text-[13px] focus-within:ring-2 focus-within:ring-primary/25 max-md:h-10">
      <label htmlFor={id} className="shrink-0 text-muted-foreground">{label}:</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-full min-w-0 appearance-none bg-transparent pl-1 pr-6 font-medium outline-none">
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}

