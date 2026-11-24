import React, { useId } from 'react';
import {
  Select as DashboardSelect, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import './controls.css';

const control = 'crm-form-control h-8 w-full rounded-lg border border-input bg-background px-2.5 text-[13px] transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground aria-[invalid=true]:border-rose-500 max-md:h-10';

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

/** The Dashboard's listbox with a compact label in its trigger. */
export function FilterSelect({ label, value, onChange, options, allLabel }: {
  label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; allLabel: string;
}) {
  const allValue = useId();
  const selected = options.some((option) => option.value === value && value !== '') ? value : allValue;
  return (
    <DashboardSelect value={selected} onValueChange={(next) => onChange(next === allValue ? '' : next)}>
      <SelectTrigger aria-label={label} className="crm-filter-trigger">
        <span className="text-muted-foreground" aria-hidden="true">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" className="crm-filter-menu">
        <SelectItem value={allValue}>{allLabel}</SelectItem>
        {options.filter((option) => option.value !== '').map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </DashboardSelect>
  );
}

