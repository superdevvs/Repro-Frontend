import type { Control } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { PHOTOGRAPHER_PROPERTY_TYPES } from '@/utils/photographerCapabilities';
import type { AccountFormValues } from './accountFormModel';

type CategoryOption = { id: string; label: string; services: { id: string }[] };

export function AccountPhotographerCapabilityFields({ control, categories, isLoading, canManage }: {
  control: Control<AccountFormValues>;
  categories: CategoryOption[];
  isLoading: boolean;
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {!canManage && <p className="text-sm text-muted-foreground">Specialties and property experience are managed by an admin.</p>}
      <FormField control={control} name="specialties" render={({ field }) => {
        const selectedValues = Array.isArray(field.value) ? field.value : [];
        const toggle = (category: CategoryOption) => {
          if (!canManage) return;
          const relatedIds = new Set([category.id, ...category.services.map((service) => service.id)]);
          const selected = selectedValues.some((id) => relatedIds.has(id));
          const retained = selectedValues.filter((id) => !relatedIds.has(id));
          field.onChange(selected ? retained : [...retained, category.id]);
        };
        return (
          <FormItem>
            <FormLabel>Service Capabilities</FormLabel>
            <p className="text-xs text-muted-foreground">Select categories this photographer can shoot.</p>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading categories...</p> : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories configured. Add services in Scheduling Settings.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((category) => {
                  const active = selectedValues.includes(category.id) || category.services.some((service) => selectedValues.includes(service.id));
                  return (
                    <button key={category.id} type="button" disabled={!canManage} aria-pressed={active}
                      onClick={() => toggle(category)} title={`${category.services.length} services`}
                      className={cn('rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-default', active
                        ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                        : 'border-border/70 bg-background text-muted-foreground enabled:hover:bg-muted/60')}>
                      {category.label}
                    </button>
                  );
                })}
              </div>
            )}
            <FormMessage />
          </FormItem>
        );
      }} />
      <FormField control={control} name="propertyTypes" render={({ field }) => {
        const selected = Array.isArray(field.value) ? field.value : [];
        const options = Array.from(new Set([...PHOTOGRAPHER_PROPERTY_TYPES, ...selected]));
        return (
          <FormItem>
            <FormLabel>Property Experience</FormLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((propertyType) => (
                <label key={propertyType} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.includes(propertyType)} disabled={!canManage}
                    onChange={(event) => {
                      if (canManage) field.onChange(event.target.checked ? [...selected, propertyType] : selected.filter((value) => value !== propertyType));
                    }} />
                  {propertyType}
                </label>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        );
      }} />
    </div>
  );
}
